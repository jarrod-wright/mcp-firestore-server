// task-MCP-MERGE T-M1/T-M2 — heavy-collection default projection.
//
// Self-contained fake Firestore query double: query_collection's handler only needs
// collection().select()/orderBy()/limit()/get() (plus doc().get() for the pagination
// cursor path, unused here since no startAfter is passed).

import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "../../src/tools/query-collection.js";

const HEAVY_ARTIFACT_FIELDS = {
  artifact_id: "art-",
  source_doc_ref: "src-doc-1",
  client_id: "client-1",
  privacy_level: "internal",
  provenance: "ckge",
  quality_score: 0.9,
  valid_time: "2026-07-01T00:00:00Z",
  transaction_time: "2026-07-01T00:00:00Z",
  session_title: "session",
  participants: ["a", "b"],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

function makeArtifactDoc(id) {
  return {
    ...HEAVY_ARTIFACT_FIELDS,
    artifact_id: id,
    // ~19KB compiled_layers string + a 2048-dim embedding, per constants.js HEAVY_COLLECTIONS comment.
    compiled_layers: "x".repeat(19000),
    embedding: Array.from({ length: 2048 }, (_, i) => i / 2048),
  };
}

class FakeQuery {
  constructor(docs, selected = null) {
    this._docs = docs;
    this._selected = selected;
  }
  select(...fields) {
    return new FakeQuery(this._docs, fields);
  }
  orderBy() {
    return this;
  }
  startAfter() {
    return this;
  }
  limit(n) {
    return new FakeQuery(this._docs.slice(0, n), this._selected);
  }
  async get() {
    const selected = this._selected;
    return {
      docs: this._docs.map((d) => ({
        id: d.id,
        data: () =>
          selected
            ? Object.fromEntries(selected.map((f) => [f, d.data[f]]))
            : d.data,
      })),
    };
  }
}

class FakeCollectionRef {
  constructor(docs) {
    this._docs = docs;
  }
  select(...fields) {
    return new FakeQuery(this._docs).select(...fields);
  }
  orderBy(...args) {
    return new FakeQuery(this._docs).orderBy(...args);
  }
  limit(n) {
    return new FakeQuery(this._docs).limit(n);
  }
  get() {
    return new FakeQuery(this._docs).get();
  }
  doc(id) {
    const doc = this._docs.find((d) => d.id === id);
    return { get: async () => ({ exists: !!doc, data: () => doc && doc.data }) };
  }
}

class FakeDb {
  constructor(collections) {
    this._collections = collections;
  }
  collection(name) {
    const docs = this._collections[name] || [];
    return new FakeCollectionRef(docs);
  }
}

test("heavy-collection query_collection() default projection (T-M1/T-M2)", async () => {
  const docs = ["art-1", "art-2", "art-3"].map((id) => ({
    id,
    data: makeArtifactDoc(id),
  }));
  const db = new FakeDb({ compilation_artifacts: docs });

  const result = await handler({ collection: "compilation_artifacts" }, db);

  assert.ok(result.documents.length > 0, "expected at least one document returned");

  for (const doc of result.documents) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(doc.data, "compiled_layers"),
      false,
      "compiled_layers must be stripped by default projection on compilation_artifacts",
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(doc.data, "embedding"),
      false,
      "embedding must be stripped by default projection on compilation_artifacts",
    );
  }

  assert.ok(result._meta, "expected a _meta block on heavy-collection responses");
  assert.ok(result._meta.cursor, "expected a pagination cursor in _meta");

  const byteLength = Buffer.byteLength(JSON.stringify(result), "utf8");
  assert.ok(
    byteLength <= 40000,
    `expected response byte-capped to <= 40000, got ${byteLength}`,
  );
});

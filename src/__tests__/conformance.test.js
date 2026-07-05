/**
 * BLD-560 Epic B - Task B6 -- cross-language conformance replay.
 *
 * Drives the JS OverrideEngine through every vector in conformance_vectors.json (emitted
 * by the Python oracle) and asserts the JS projection reproduces each expectation -- most
 * critically v06's engine-minted id BYTE-IDENTICALLY and v07's reject-BEFORE-mint ordering.
 * The vectors file is blob-pinned in-test so a silent drift of the contract fails loudly.
 *
 * Runs under `node --test` with an in-memory store (no firebase-admin, no network).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  OverrideEngine, InMemoryFakeStore, mintEntityId, WriteToolError,
} from "../override-engine.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const VECTORS_PATH = join(HERE, "..", "..", "conformance", "conformance_vectors.json");
const PINNED_VECTORS_BLOB = "d89f54c9280fce1edddb73f8835f5e0664e1bf32";

function gitBlobSha(bytes) {
  const h = createHash("sha1");
  h.update("blob " + bytes.length + "\0");
  h.update(bytes);
  return h.digest("hex");
}

const RAW = readFileSync(VECTORS_PATH);
const DOC = JSON.parse(RAW.toString("utf8"));
const SALT = DOC.salt;
const V = Object.fromEntries(DOC.vectors.map(v => [v.vector_id, v]));

function engine() { return new OverrideEngine(new InMemoryFakeStore(), SALT); }

test("vectors file matches the pinned oracle blob (no silent contract drift)", () => {
  assert.equal(gitBlobSha(RAW), PINNED_VECTORS_BLOB);
});

test("v01 field-level AUTO -> active with deterministic override_id", async () => {
  const e = engine();
  const ev = await e.recordOverride(V.v01.args);
  assert.equal(ev.status, V.v01.expect.status);
  assert.equal(ev.override_id, V.v01.expect.override_id);
  assert.deepEqual(Object.keys(ev).sort(), V.v01.expect.schema_fields);
});

test("v02 field-level GATED -> pending", async () => {
  const e = engine();
  const ev = await e.recordOverride(V.v02.args);
  assert.equal(ev.status, "pending");
  assert.equal(ev.override_id, V.v02.expect.override_id);
});

test("v03 confirm flips pending -> active", async () => {
  const e = engine();
  await e.recordOverride(V.v02.args);
  await e.confirm(V.v03.args.override_id);
  assert.ok((await e.eventsFor(V.v03.args.override_id)).some(x => x.status === "active"));
});

test("v04 retract -> no active", async () => {
  const e = engine();
  await e.recordOverride(V.v02.args);
  await e.retract(V.v04.args.override_id);
  assert.ok((await e.eventsFor(V.v04.args.override_id)).every(x => x.status !== "active"));
});

test("v05 identity.merge existing ids -> pending, full schema + value", async () => {
  const e = engine();
  const ev = await e.recordIdentityMerge(V.v05.args);
  assert.equal(ev.status, "pending");
  assert.equal(ev.override_id, V.v05.expect.override_id);
  assert.deepEqual(Object.keys(ev).sort(), V.v05.expect.schema_fields);
  assert.deepEqual(ev.value, V.v05.expect.value);
});

test("v06 identity.split -> pending + engine-minted id BYTE-IDENTICAL to oracle", async () => {
  const e = engine();
  const ev = await e.recordIdentitySplit(V.v06.args);
  assert.equal(ev.status, "pending");
  assert.equal(ev.override_id, V.v06.expect.override_id);
  assert.equal(ev.value.minted_entity_id, V.v06.expect.minted_entity_id);
});

test("v07 split with agent-supplied new id THROWS before mint (ordering)", async () => {
  const e = engine();
  // reject-before-mint: an agent id refusal must precede any minting. We prove ordering
  // by using an INVALID partition_rule that mintEntityId would reject -- the agent-id
  // rejection must fire first (WriteToolError about the id, not the rule).
  await assert.rejects(
    async () => { await e.recordIdentitySplit({ ...V.v07.args, partition_rule: "", agent_supplied_new_id: "attacker-id" }); },
    err => err instanceof WriteToolError && /split-product entity id/.test(err.message),
  );
});

test("v08 mint determinism + anchor", () => {
  const a = mintEntityId("entity-A", "split-by-email-domain", SALT);
  const b = mintEntityId("entity-A", "split-by-email-domain", SALT);
  const c = mintEntityId("entity-A", "other-rule", SALT);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a, V.v08.expect.minted_AB);
});

test("v09 confidence.pin -> active + human-verified", async () => {
  const e = engine();
  const ev = await e.recordOverride(V.v09.args);
  assert.equal(ev.status, "active");
  assert.equal(ev.confidence_effect, "human-verified");
  assert.equal(ev.override_id, V.v09.expect.override_id);
});

test("v10 supersede: prior superseded, new active", async () => {
  const e = engine();
  await e.recordOverride({ entity_id: "entity-A", override_type: "claim.correct", field_path: "claim.value",
    value: "v1", stated_at: "2026-07-01T16:00:00Z", recorded_at: "2026-07-01T16:00:01Z",
    provenance: { directed_by: "coach", session_ref: "sess-vec" } });
  await e.recordOverride({ entity_id: "entity-A", override_type: "claim.correct", field_path: "claim.value",
    value: "v2", stated_at: "2026-07-01T17:00:00Z", recorded_at: "2026-07-01T17:00:01Z",
    provenance: { directed_by: "coach", session_ref: "sess-vec" } });
  const events = await e.eventsFor(V.v10.args.override_id);
  assert.equal(events.filter(x => x.status === "superseded").length, V.v10.expect.superseded_count);
  assert.deepEqual(events.filter(x => x.status === "active").map(x => x.value), V.v10.expect.active_value);
});

test("v11 opaque-id negative: no supplied-value substring in ids", async () => {
  const e = engine();
  const name = V.v11.args.name_token;
  const ev = await e.recordOverride({ entity_id: "entity-A", override_type: "identity.rename",
    field_path: "identity.display_name", value: name, stated_at: "2026-07-01T16:00:00Z",
    recorded_at: "2026-07-01T16:00:01Z", provenance: { directed_by: "coach", session_ref: "sess-vec" } });
  const sp = await e.recordIdentitySplit({ source_entity_id: "entity-A", partition_rule: "by-" + name,
    stated_at: "2026-07-01T16:00:00Z", recorded_at: "2026-07-01T16:00:01Z",
    provenance: { directed_by: "coach", session_ref: "sess-vec" } });
  assert.ok(!ev.override_id.includes(name));
  assert.ok(!sp.value.minted_entity_id.includes(name));
});

test("v12 agent-supplied override_id rejected", async () => {
  const e = engine();
  await assert.rejects(async () => { await e.recordOverride(V.v12.args); }, err => err instanceof WriteToolError);
});

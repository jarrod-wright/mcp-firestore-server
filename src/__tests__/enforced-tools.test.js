/**
 * BLD-560 Epic B - Task B3 -- enforced crm_overrides tool handlers (offline).
 *
 * Proves the handler-layer half of AC4 + the opaque-id boundary:
 *   - the collection is HARDWIRED to crm_overrides (a spy db shows no other collection is
 *     ever accessed, even when args try to smuggle one),
 *   - an agent-supplied override_id / split new id is rejected,
 *   - record -> confirm -> retract lifecycle works through an injected store,
 *   - identity.split mints the v06 anchor byte-identically,
 *   - the three tools are registered and dispatchable.
 * Uses an injected in-memory store (no firebase-admin). Salt pinned via env.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryFakeStore, WriteToolError } from "../override-engine.js";
import * as recordOverride from "../tools/record-override.js";
import * as confirmOverride from "../tools/confirm-override.js";
import * as retractOverride from "../tools/retract-override.js";
import { getHandler } from "../tools/index.js";

process.env.TENANT_MINT_SALT = "test-mint-salt-epicb";

// A spy db that records every collection() access, and a shared injected store.
function spyEnv() {
  const accessed = [];
  const db = { collection: (name) => { accessed.push(name); return { _name: name }; } };
  const shared = new InMemoryFakeStore();
  const factory = (d) => { if (d && d.collection) d.collection("crm_overrides"); return shared; };
  return { db, accessed, shared, factory };
}

const TS = { stated_at: "2026-07-01T16:00:00Z", recorded_at: "2026-07-01T16:00:01Z",
             provenance: { directed_by: "coach", session_ref: "sess-vec" } };

test("record_override hardwires crm_overrides even when args smuggle a collection", async () => {
  const { db, accessed, factory } = spyEnv();
  await recordOverride.handler(
    { override_type: "claim.correct", entity_id: "entity-A", field_path: "claim.value",
      value: "corrected", collection: "hermes-staging", ...TS }, db, factory);
  assert.deepEqual([...new Set(accessed)], ["crm_overrides"]);
});

test("record_override rejects an agent-supplied override_id", async () => {
  const { db, factory } = spyEnv();
  await assert.rejects(
    () => recordOverride.handler(
      { override_type: "claim.correct", entity_id: "entity-A", field_path: "claim.value",
        value: "x", agent_supplied_override_id: "attacker", ...TS }, db, factory),
    (e) => e instanceof WriteToolError);
});

test("identity.split via handler mints the v06 anchor byte-identically", async () => {
  const { db, shared, factory } = spyEnv();
  const r = await recordOverride.handler(
    { override_type: "identity.split", source_entity_id: "entity-A",
      partition_rule: "split-by-email-domain", ...TS }, db, factory);
  assert.equal(r.status, "pending");
  const [ev] = await shared.eventsFor("identity.split:entity-A");
  assert.equal(ev.value.minted_entity_id, "ent-9557971de41c2ac7155510b7");
});

test("identity.split rejects an agent-supplied new id (reject-before-mint)", async () => {
  const { db, factory } = spyEnv();
  await assert.rejects(
    () => recordOverride.handler(
      { override_type: "identity.split", source_entity_id: "entity-A",
        partition_rule: "split-by-email-domain", agent_supplied_new_id: "attacker", ...TS }, db, factory),
    (e) => e instanceof WriteToolError);
});

test("record (GATED) -> confirm -> retract lifecycle through injected store", async () => {
  const { db, factory } = spyEnv();
  const rec = await recordOverride.handler(
    { override_type: "identity.merge", canonical_entity_id: "entity-A",
      merged_entity_ids: ["entity-B"], ...TS }, db, factory);
  assert.equal(rec.status, "pending");
  const conf = await confirmOverride.handler({ override_id: rec.override_id }, db, factory);
  assert.equal(conf.status, "active");
  const ret = await retractOverride.handler({ override_id: rec.override_id }, db, factory);
  assert.equal(ret.status, "retracted");
});

test("the three enforced tools are registered and dispatchable", () => {
  assert.equal(typeof getHandler("record_override"), "function");
  assert.equal(typeof getHandler("confirm_override"), "function");
  assert.equal(typeof getHandler("retract_override"), "function");
});

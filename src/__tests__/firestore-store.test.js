/**
 * BLD-562 Epic C T1 -- RED/GREEN behaviour test for the Firestore-backed CrmOverridesStore
 * (S2). Drives the store directly (no OverrideEngine involvement -- the engine is still
 * sync until T4) against the FakeFirestore double (S4), instrumented to record every
 * collection()/txn.get/txn.set/txn.update/txn.delete call so each S2 assertion is a
 * programmatic gate, not a "looks right".
 *
 * Asserts (per job spec T1 a-f):
 *  (a) db.collection called with exactly "crm_overrides" and no other collection.
 *  (b) eventsFor issues txn.get on a where("override_id","==",...) query.
 *  (c) append flushes as txn.set at docId `${override_id}#${seq}`.
 *  (d) a status mutation flushes as txn.update(ref,{status}) -- STATUS KEY ONLY.
 *  (e) persist-across-restart: a second store instance over the same backing Map sees
 *      the first instance's events.
 *  (f) INV-C: txn.delete is never invoked; no update payload ever carries a content field.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeFirestore, QueryRef } from "./helpers/fake-firestore.js";
import { CrmOverridesStore, ENFORCED_COLLECTION, makeCrmOverridesStore } from "../tools/crm-overrides-store.js";

// Wraps a FakeFirestore in a spy db: records every collection() name, and instruments the
// txn handed to the transaction callback so get/set/update/delete calls are observable.
function spyDb(backingMap = new Map()) {
  const real = new FakeFirestore(backingMap);
  const calls = { collections: [], gets: [], sets: [], updates: [], deletes: [] };
  const db = {
    collection(name) {
      calls.collections.push(name);
      const realRef = real.collection(name);
      const wrappedFirestore = {
        runTransaction(fn) {
          return real.runTransaction((txn) => fn({
            get: async (target) => {
              calls.gets.push(target);
              return txn.get(target);
            },
            set: (ref, data) => {
              calls.sets.push({ ref, data });
              return txn.set(ref, data);
            },
            update: (ref, partial) => {
              calls.updates.push({ ref, partial });
              return txn.update(ref, partial);
            },
            delete: (...args) => {
              calls.deletes.push(args);
              return txn.delete(...args);
            },
          }));
        },
      };
      return {
        _name: realRef._name,
        firestore: wrappedFirestore,
        where: realRef.where.bind(realRef),
        doc: realRef.doc.bind(realRef),
      };
    },
  };
  return { db, calls, backingMap };
}

test("(a) db.collection is called with exactly crm_overrides and no other collection", () => {
  const { db, calls } = spyDb();
  makeCrmOverridesStore(db);
  assert.deepEqual(calls.collections, [ENFORCED_COLLECTION]);
});

test("(b) eventsFor issues txn.get on a where(override_id,==,...) query", async () => {
  const { db, calls } = spyDb();
  const store = makeCrmOverridesStore(db);
  await store.runTransaction(async () => {
    await store.eventsFor("entity-A:claim.correct:claim.value");
  });
  assert.equal(calls.gets.length, 1);
  const q = calls.gets[0];
  assert.ok(q instanceof QueryRef);
  assert.equal(q.field, "override_id");
  assert.equal(q.op, "==");
  assert.equal(q.value, "entity-A:claim.correct:claim.value");
});

test("(c) append flushes as txn.set at docId `${override_id}#${seq}`", async () => {
  const { db, calls } = spyDb();
  const store = makeCrmOverridesStore(db);
  const oid = "entity-A:claim.correct:claim.value";
  await store.runTransaction(async () => {
    const existing = await store.eventsFor(oid);
    const seq = existing.length + 1;
    const event = { event_id: `${oid}#${seq}`, override_id: oid, status: "active", value: "v1" };
    store.append(event);
    return event;
  });
  assert.equal(calls.sets.length, 1);
  assert.equal(calls.sets[0].ref.id, `${oid}#1`);
  assert.deepEqual(calls.sets[0].data, { event_id: `${oid}#1`, override_id: oid, status: "active", value: "v1" });
});

test("(d) a status mutation flushes as txn.update(ref,{status}) -- status key only", async () => {
  const { db, calls } = spyDb();
  const store = makeCrmOverridesStore(db);
  const oid = "entity-A:identity.merge";
  await store.runTransaction(async () => {
    const event = { event_id: `${oid}#1`, override_id: oid, status: "pending", value: { a: 1 } };
    store.append(event);
  });
  calls.updates.length = 0;

  await store.runTransaction(async () => {
    const [event] = await store.eventsFor(oid);
    event.status = "active";
  });

  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].ref.id, `${oid}#1`);
  assert.deepEqual(Object.keys(calls.updates[0].partial), ["status"]);
  assert.equal(calls.updates[0].partial.status, "active");
});

test("(e) persist-across-restart: a second store instance sees the first instance's events", async () => {
  const backingMap = new Map();
  const { db: db1 } = spyDb(backingMap);
  const store1 = makeCrmOverridesStore(db1);
  const oid = "entity-A:claim.retract";
  await store1.runTransaction(async () => {
    const event = { event_id: `${oid}#1`, override_id: oid, status: "active", value: "gone" };
    store1.append(event);
  });

  const { db: db2 } = spyDb(backingMap);
  const store2 = makeCrmOverridesStore(db2);
  const events = await store2.runTransaction(async () => store2.eventsFor(oid));
  assert.equal(events.length, 1);
  assert.equal(events[0].event_id, `${oid}#1`);
  assert.equal(events[0].value, "gone");
});

test("(f) INV-C: txn.delete is never invoked; update payloads never carry a content field", async () => {
  const { db, calls } = spyDb();
  const store = makeCrmOverridesStore(db);
  const oid = "entity-A:record.suppress";
  await store.runTransaction(async () => {
    const event = { event_id: `${oid}#1`, override_id: oid, status: "pending", value: "suppressed", extra_field: "z" };
    store.append(event);
  });
  await store.runTransaction(async () => {
    const [event] = await store.eventsFor(oid);
    event.status = "active";
  });

  assert.equal(calls.deletes.length, 0);
  for (const { partial } of calls.updates) {
    assert.deepEqual(Object.keys(partial), ["status"]);
  }
});

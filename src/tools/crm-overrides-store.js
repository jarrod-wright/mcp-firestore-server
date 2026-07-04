/**
 * BLD-560 Epic B -- crm_overrides store adapter (engine seam -> Firestore collection).
 *
 * Hardwires the collection to 'crm_overrides'. The collection name is a MODULE CONSTANT
 * and is NEVER taken from tool arguments -- this is the handler-layer half of AC4 (the
 * allowlist Invariant-5 extension is the other half). Binding calls db.collection(
 * ENFORCED_COLLECTION) at construction so a spy db can prove no other collection is
 * touched.
 *
 * SCOPE (Epic B offline): the engine seam (eventsFor/append/runTransaction) is backed by
 * an in-process event list so the enforcement + conformance logic is provable offline
 * without firebase-admin or a live tenant. The live Firestore-transaction backing
 * (real append-only writes + optimistic transaction) is Epic C (BLD-520-gated live wiring).
 */
export const ENFORCED_COLLECTION = "crm_overrides";

export class CrmOverridesStore {
  constructor(db) {
    // Bind to the hardwired collection. On a real Firestore db this returns a
    // CollectionReference; on a spy db it records the access. Never uses caller input.
    this._collectionRef = db && typeof db.collection === "function"
      ? db.collection(ENFORCED_COLLECTION) : null;
    this._events = [];
  }
  eventsFor(overrideId) { return this._events.filter(e => e.override_id === overrideId); }
  append(event) { this._events.push(event); }
  runTransaction(fn) { return fn(); }
}

export function makeCrmOverridesStore(db) {
  return new CrmOverridesStore(db);
}

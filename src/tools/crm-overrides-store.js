/**
 * BLD-562 Epic C S2 -- crm_overrides store adapter (engine seam -> live Firestore txn).
 *
 * Hardwires the collection to 'crm_overrides'. The collection name is a MODULE CONSTANT
 * and is NEVER taken from tool arguments -- this is the handler-layer half of AC4 (the
 * allowlist Invariant-5 extension is the other half). Binding calls db.collection(
 * ENFORCED_COLLECTION) at construction so a spy db can prove no other collection is
 * touched.
 *
 * Real async Firestore transaction backing (Director-ratified D-CRM-OVERRIDE-STORE-
 * BACKING-01, Option A). Doc id = event.event_id (`${override_id}#${seq}`). The ONLY
 * write to an existing doc is a `status` transition (txn.update(ref, {status})); new
 * events are txn.set. Never calls .delete (INV-C, append-only).
 */
export const ENFORCED_COLLECTION = "crm_overrides";

export class CrmOverridesStore {
  constructor(db) {
    // Bind to the hardwired collection. On a real Firestore db this returns a
    // CollectionReference; on a spy db it records the access. Never uses caller input.
    this._collectionRef = db && typeof db.collection === "function"
      ? db.collection(ENFORCED_COLLECTION) : null;
    this._txn = null;
    this._readSnap = null;
    this._appends = null;
  }

  async runTransaction(fn) {
    return this._collectionRef.firestore.runTransaction(async (txn) => {
      this._txn = txn;
      this._readSnap = new Map();
      this._appends = [];
      const result = await fn();
      await this._flush();
      this._txn = null;
      return result;
    });
  }

  async eventsFor(overrideId) {
    const q = await this._txn.get(this._collectionRef.where("override_id", "==", overrideId));
    return q.docs.map((doc) => {
      const obj = { ...doc.data() };
      this._readSnap.set(obj, { ref: doc.ref, obj, status0: obj.status });
      return obj;
    });
  }

  append(event) {
    this._appends.push(event);
  }

  async _flush() {
    for (const { ref, obj, status0 } of this._readSnap.values()) {
      if (obj.status !== status0) {
        await this._txn.update(ref, { status: obj.status });
      }
    }
    for (const event of this._appends) {
      await this._txn.set(this._collectionRef.doc(event.event_id), event);
    }
  }
}

export function makeCrmOverridesStore(db) {
  return new CrmOverridesStore(db);
}

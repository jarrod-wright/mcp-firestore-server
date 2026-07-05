/**
 * BLD-562 Epic C S4 -- in-process FakeFirestore test double.
 *
 * Dependency-free stand-in for firebase-admin's Firestore client, scoped to exactly the
 * surface CrmOverridesStore uses: collection()/where()/doc()/runTransaction() with a
 * txn.get/set/update seam. Backing store is a caller-supplied Map<docId, data> so a second
 * FakeFirestore instance constructed over the SAME Map proves persist-across-restart
 * (S1 T1-e). `txn.delete` is a hard throw -- the append-only guard (INV-C) is enforced by
 * the double itself, not just by the store's own discipline.
 */

export class DocRef {
  constructor(collectionRef, id) {
    this._collectionRef = collectionRef;
    this.id = id;
  }
}

export class QueryRef {
  constructor(collectionRef, field, op, value) {
    this._collectionRef = collectionRef;
    this.field = field;
    this.op = op;
    this.value = value;
  }
}

export class CollectionRef {
  constructor(firestore, name) {
    this.firestore = firestore;
    this._name = name;
  }
  where(field, op, value) {
    return new QueryRef(this, field, op, value);
  }
  doc(id) {
    return new DocRef(this, id);
  }
}

export class FakeFirestore {
  constructor(backingMap = new Map()) {
    this._map = backingMap;
    this._collectionsAccessed = [];
  }

  collection(name) {
    this._collectionsAccessed.push(name);
    return new CollectionRef(this, name);
  }

  async runTransaction(fn) {
    const map = this._map;
    const pending = new Map();
    const readCurrent = (id) => (pending.has(id) ? pending.get(id) : map.get(id));

    const txn = {
      async get(target) {
        if (target instanceof QueryRef) {
          if (target.op !== "==") {
            throw new Error(`FakeFirestore: unsupported query operator ${target.op}`);
          }
          const docs = [];
          for (const id of map.keys()) {
            const data = readCurrent(id);
            if (data !== undefined && data[target.field] === target.value) {
              docs.push({ id, ref: new DocRef(target._collectionRef, id), data: () => data });
            }
          }
          return { docs };
        }
        if (target instanceof DocRef) {
          const data = readCurrent(target.id);
          return { exists: data !== undefined, ref: target, data: () => data };
        }
        throw new Error("FakeFirestore: txn.get() target must be a QueryRef or DocRef");
      },
      set(ref, data) {
        pending.set(ref.id, { ...data });
      },
      update(ref, partial) {
        const base = readCurrent(ref.id);
        if (base === undefined) {
          throw new Error(`FakeFirestore: txn.update() on nonexistent doc ${ref.id}`);
        }
        pending.set(ref.id, { ...base, ...partial });
      },
      delete() {
        throw new Error("append-only violation: delete called");
      },
    };

    const result = await fn(txn);
    for (const [id, data] of pending.entries()) map.set(id, data);
    return result;
  }
}

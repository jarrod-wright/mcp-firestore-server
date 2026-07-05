# result-EPICC-01-02 — T2: GREEN — implement Firestore-backed CrmOverridesStore (S2)

**Task:** T2 — implement S2 in `src/tools/crm-overrides-store.js`, preserving
`ENFORCED_COLLECTION`, constructor binding, `makeCrmOverridesStore` (INV-A) verbatim.

## Environment
- Same branch/commit lineage as T1 (parent `c4bd0cf`, itself on top of §6-remediated `bbfe263f`).
- `npm ci` unaffected (no dependency changes this task).

## Change
`src/tools/crm-overrides-store.js` rewritten per the design spec S2, verbatim:
- `runTransaction(fn)` → `this._collectionRef.firestore.runTransaction(async (txn) => { ...; const result = await fn(); await this._flush(); ...; return result; })`.
- `eventsFor(overrideId)` → `await this._txn.get(this._collectionRef.where("override_id","==",overrideId))`, maps docs to plain-object copies, records `{ref, obj, status0}` in `_readSnap` keyed by object identity so later in-place mutations (`obj.status = ...`) are observable at flush.
- `append(event)` → pushes to `_appends` (no write yet).
- `_flush()` → for each `_readSnap` entry where `obj.status !== status0`, `txn.update(ref, {status: obj.status})` (status key only); for each appended event, `txn.set(this._collectionRef.doc(event.event_id), event)`. Never calls `.delete`.
- `ENFORCED_COLLECTION`, the constructor's `db.collection(ENFORCED_COLLECTION)` binding, and `makeCrmOverridesStore(db)` are unchanged (INV-A).

## GREEN — measured (`node --test src/__tests__/firestore-store.test.js`)
```
✔ (a) db.collection is called with exactly crm_overrides and no other collection (1.497259ms)
✔ (b) eventsFor issues txn.get on a where(override_id,==,...) query (0.734302ms)
✔ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.170268ms)
✔ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.633174ms)
✔ (e) persist-across-restart: a second store instance sees the first instance's events (0.357088ms)
✔ (f) INV-C: txn.delete is never invoked; update payloads never carry a content field (0.519482ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 85.430509
```

## Full suite regression check — measured (`node --test src/__tests__/*.test.js`)
```
ℹ tests 80
ℹ suites 7
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 622.82959
```
80 = 74 baseline (conformance + enforced-tools + integrity + tenant-binding + allowlist suites, all untouched) + 6 new `firestore-store.test.js`. No count regression.

## Verdict
**PASS.** Store implementation complete; engine (`src/override-engine.js`) and handlers
untouched this task, per T2 scope (STOP-ON-FAIL would have forbidden touching the engine
— not needed, gate passed clean).

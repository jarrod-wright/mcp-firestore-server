# result-EPICC-01-01 — T1: RED — Firestore-store behaviour test

**Task:** T1 (job spec `builder-inputs/epic-c/JOB-ORDER-task-EPICC-01.md`) — author the S4
`FakeFirestore` test double and the S2 behaviour test for the Firestore-backed
`CrmOverridesStore`, drive it to a RED that fails for the intended reason.

## Environment
- Repo: `mcp-firestore-server`, branch `epic-b-enforced-overrides`.
- Base commit (§1.1 bring-up, recorded before this task): `bbfe263f7b9e7efaadd8efcfdcad63e3102ed9fb` (`git describe --tags` = `v2.1.1-zapphire1`).
- `npm ci` exit 0. Baseline `node --test src/__tests__/*.test.js` = **74/74 pass** (measured this session).
- `npm audit --package-lock-only --json` → `{"info":0,"low":0,"moderate":8,"high":0,"critical":0,"total":8}` — 0 critical / 0 high (gate satisfied; moderate advisories are pre-existing and out of scope).

## Files added
- `src/__tests__/helpers/fake-firestore.js` (S4 double: `FakeFirestore`, `CollectionRef`, `QueryRef`, `DocRef`; shared backing `Map`; `txn.delete` hard-throws `"append-only violation: delete called"`).
- `src/__tests__/firestore-store.test.js` — 6 tests against the (still old, sync, in-memory) `CrmOverridesStore`, instrumented via a spy `db` that records every `collection()` name and every `txn.get/set/update/delete` call: (a) collection hardwire, (b) `eventsFor` → `txn.get` on `where("override_id","==",...)`, (c) `append` → `txn.set` at `${override_id}#${seq}`, (d) status mutation → `txn.update(ref,{status})` status-only, (e) persist-across-restart over a shared backing Map, (f) INV-C — no `txn.delete`, no content field in any update payload.

## RED — measured (`node --test src/__tests__/firestore-store.test.js`)
```
✔ (a) db.collection is called with exactly crm_overrides and no other collection (1.59224ms)
✖ (b) eventsFor issues txn.get on a where(override_id,==,...) query (0.923006ms)
✖ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.234799ms)
✖ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.488994ms)
✖ (e) persist-across-restart: a second store instance sees the first instance's events (0.43834ms)
✔ (f) INV-C: txn.delete is never invoked; update payloads never carry a content field (0.354212ms)
ℹ tests 6
ℹ suites 0
ℹ pass 2
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 110.645117
```
Each failure is `AssertionError: Expected values to be strictly equal: 0 !== 1` — the spy's
`calls.gets` / `calls.sets` / `calls.updates` counters are zero because the still-current
`CrmOverridesStore` (sync, in-memory `_events` array) never touches `db.collection(...)
.firestore.runTransaction` or any `txn.*` method at all. This is the intended-reason
failure per RT-GATE-1/MEP-3 (a genuine behavioural gap, not an import/scaffold error — (a)
and (f) already pass because the old store still calls `db.collection` once at
construction and never calls `.delete`).

## Verdict
**PASS** (RED confirmed for the intended reason). Proceeding to T2 (GREEN implementation).

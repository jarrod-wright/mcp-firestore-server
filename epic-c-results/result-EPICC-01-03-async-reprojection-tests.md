# result-EPICC-01-03 — T3: conformance/enforced tests → async (S6), engine still sync

**Task:** T3 — apply the S6 await/`assert.rejects` re-projection to `conformance.test.js`
and `enforced-tools.test.js`. No vector/assertion content change. The `OverrideEngine` and
`InMemoryFakeStore` are deliberately left synchronous this task (T4 scope).

## Environment
- Parent commit `44cfd21` (T2 green), on branch `epic-b-enforced-overrides`.

## Change
- `src/__tests__/conformance.test.js`: every test body driving `e.recordOverride` /
  `e.recordIdentityMerge` / `e.recordIdentitySplit` / `e.confirm` / `e.retract` /
  `e.eventsFor` → `async` body with `await`. The two `assert.throws(...)` calls guarding
  agent-supplied-id rejection (v07, v12) → `await assert.rejects(async () => { await
  e.<method>(...); }, ...)`. `v08` (pure `mintEntityId`, no store touch) and the
  blob-pin test are unchanged — no store/engine call to await. Vector inputs/expectations
  and all assertion predicates are byte-identical to the pre-existing file (only
  `async`/`await`/`assert.rejects` threading added).
- `src/__tests__/enforced-tools.test.js`: the handler calls were already `await`ed (the
  handlers are already `async function handler`); the one remaining sync call —
  `shared.eventsFor("identity.split:entity-A")[0]` (direct `InMemoryFakeStore` access,
  bypassing the engine) — is now `const [ev] = await shared.eventsFor(...)`, since S3
  (T4) will make `InMemoryFakeStore.eventsFor` async.

No production code changed this task (`src/override-engine.js`, handlers, and
`crm-overrides-store.js` untouched).

## GATE — measured (`node --test src/__tests__/*.test.js`)
```
ℹ tests 80
ℹ suites 7
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 590.271267
```
80 = 74 conformance+enforced+integrity+tenant-binding+allowlist (unchanged count, all
still pass — "await-of-sync is harmless" confirmed) + 6 firestore-store (T1/T2, untouched
this task). No conformance-count drop from 74.

## Verdict
**PASS.** Proceeding to T4 (engine async re-projection, S1/S3).

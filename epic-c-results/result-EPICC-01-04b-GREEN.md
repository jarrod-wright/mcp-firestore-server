# result-EPICC-01-04b — T4′ (merged T4+T5): GREEN — engine async re-projection + handler awaits

**Task:** T4′ per `builder-inputs/epic-c/JOB-ORDER-task-EPICC-01-AMEND-01.md` — the
Director-ratified merge of T4 (S1+S3, engine async re-projection) and T5 (S5, handler
awaits) into one atomically-gated task, resolving the sequencing defect that BLOCKED the
prior session at commit `a09bde8`.

## RED context (carried forward from the prior BLOCKED result)
`epic-c-results/result-EPICC-01-04-BLOCKED.md` — with S1/S3 applied alone (no S5), the
full suite measured 76/80 pass, 4 fail, all in `enforced-tools.test.js`, all because the
handlers called the now-async engine methods without `await`.

## Environment
- Branch `epic-b-enforced-overrides`, resumed post-`AMEND-01` (parent commit `4e1dfb6`).
- Bring-up re-verified this session: committed T3 HEAD (engine sync) = 80/80
  (see session record "Resume — bring-up" section).

## Change (T4′ ACTIONS, both parts landed together)
1. **S1 + S3 (engine, carried over from the prior session's uncommitted T4 work, kept
   unchanged per AMEND-01 §Resume point):** `src/override-engine.js` —
   `InMemoryFakeStore.eventsFor`/`runTransaction` → `async`; `OverrideEngine.recordOverride`
   / `recordIdentityMerge` / `recordIdentitySplit` / `confirm` / `retract` → `async`, each
   `await`ing `store.runTransaction(async () => { ... await store.eventsFor(oid) ... })`.
   Pure decision-logic functions untouched (INV-B).
2. **S5 (handlers, new this task):**
   - `src/tools/record-override.js`: `event = engine.recordIdentityMerge(args)` /
     `recordIdentitySplit(args)` / `recordOverride(args)` → each `await`ed.
   - `src/tools/confirm-override.js`: `event = engine.confirm(args.override_id)` →
     `await engine.confirm(...)`.
   - `src/tools/retract-override.js`: `event = engine.retract(args.override_id)` →
     `await engine.retract(...)`.
   - `server.js` unchanged (already `await handler(...)`).

## GATE — measured (`node --test src/__tests__/*.test.js`)
```
ℹ tests 80
ℹ suites 7
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 660.585648
```
All 4 previously-failing tests now pass:
- `✔ record_override rejects an agent-supplied override_id`
- `✔ identity.split via handler mints the v06 anchor byte-identically`
- `✔ identity.split rejects an agent-supplied new id (reject-before-mint)`
- `✔ record (GATED) -> confirm -> retract lifecycle through injected store`

Conformance vectors `v01`-`v12` all pass (INV-B intact). No failure appeared outside the
4 previously-known handler tests — no regression.

## Verdict
**PASS.** Proceeding to T6 (HARDEN).

# JOB-ORDER task-EPICC-01 — AMENDMENT 01 (resolve T4 BLOCKED)

> **Supersedes** T4 and T5 of `JOB-ORDER-task-EPICC-01.md` (blob `1cf14eac`). All other tasks (T1–T3 DONE, T6, T7) stand unchanged. **Everything else in the base job spec and the Builder genesis remains authoritative.**
> **Grounds on the Builder's BLOCKED result** `epic-c-results/result-EPICC-01-04-BLOCKED.md` (commit `a09bde8`) — a correct STOP. Root cause: T4 (engine→async, S1/S3) and T5 (handlers→await, S5) are mechanically inseparable; T4's "full suite ALL PASS" gate is unreachable until T5 lands. This amendment merges them. Director-ratified fix (Option 1).

## Resume point
Branch `epic-b-enforced-overrides` at the committed T3-green HEAD (firestore-store 6/6; conformance+enforced async-reprojected; engine still sync; suite 80/80). The T4 engine-async change may still be uncommitted in your working tree — the task below is idempotent (ensure the async state exists, then add the handler awaits).

## T4′ (MERGED, replaces T4 + T5) — engine async re-projection + handler awaits, gated once
- **PRE:** on `epic-b-enforced-overrides`; `git status` reviewed; `node --test src/__tests__/*.test.js` = 80/80 with the engine SYNC (T3 state) — this is your green baseline to build from.
- **ACTIONS (all in ONE task; land together):**
  1. **S1 + S3 (engine):** `OverrideEngine.recordOverride/recordIdentityMerge/recordIdentitySplit/confirm/retract` → `async`, each `await store.runTransaction(async () => { … await store.eventsFor(oid) … })`; async-ify `InMemoryFakeStore` (`eventsFor` async, `runTransaction` async `return await fn()`). Pure decision-logic functions UNCHANGED (INV-B). (If already present uncommitted from your prior T4 attempt, keep it.)
  2. **S5 (handlers):** in `src/tools/record-override.js`, `confirm-override.js`, `retract-override.js`, change every `event = engine.<method>(args)` to `event = await engine.<method>(args)` (record/merge/split/confirm/retract). `server.js` already `await handler(...)` — no server change.
- **GATE (measured, run exactly):** `node --test src/__tests__/*.test.js` → **full suite ALL PASS** — expect **80/80** (74 baseline async-reprojected + 6 firestore-store), with the 4 previously-failing `enforced-tools.test.js` handler tests now GREEN. Conformance vectors `v01`–`v12` all pass (INV-B).
- **STOP-ON-FAIL:** if any test fails, STOP + `result-EPICC-01-04b-BLOCKED.md` with the exact failing assertion; do NOT proceed to T6. If a NEW failure appears outside the 4 known handler tests, that is a real regression — STOP and report it precisely.
- **On PASS:** write `epic-c-results/result-EPICC-01-04b-GREEN.md` (RED context = the prior BLOCKED 4 failures; GREEN = full-suite pass with counts), append the session-record section, commit + push.

## Then continue with the base job spec, unchanged:
- **T6 — HARDEN** (parity vs `conformance_vectors.json` `d89f54c9`; append-only structural gate on `crm-overrides-store.js` with RT-GATE-1 comment-strip + `update(`-construct anchor, status-only; `npm audit --package-lock-only` → 0 crit/0 high). Push `result-EPICC-01-06-*`.
- **T7 — roll-up + handback** (final `node --test` count; `READY FOR Director re-tag v2.2.0-zapphire1 at <SHA>`). Push `result-EPICC-01-07-*` + the HANDBACK session-record section.

## Invariants (unchanged, binding): INV-A collection hardwire · INV-B decision-logic byte-parity · INV-C append-only · INV-D opaque-id. Clean-env + RB-1 boundaries stand (FakeFirestore only; no live creds; final tag is Director's).

## Residual-underspecification list
**EMPTY.** The only open item in the BLOCKED result — the T4/T5 gate boundary — is resolved here by merging them into T4′ with a single full-suite gate. The merged ACTIONS enumerate the exact files and edits (engine methods list, handler await sites) with no discretion left; the GATE is a literal measured command with the expected count (80/80) and the named expected-green delta (the 4 handler tests). T6/T7 are unchanged from the dispatch-locked base spec. No design decision remains for the Builder.

*Foreman-authored 2026-07-05. Resolves the BLOCKED at `a09bde8`. Option 1 (merge) ratified. SEPARATED §13.*

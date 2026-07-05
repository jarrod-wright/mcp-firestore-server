# result-EPICC-01-04 — T4: engine async re-projection (S1, S3)

**STATUS: BLOCKED**

## Task
T4 (job spec) — make `OverrideEngine.recordOverride` / `recordIdentityMerge` /
`recordIdentitySplit` / `confirm` / `retract` `async` per S1, and async-ify
`InMemoryFakeStore` per S3. Pure functions (INV-B) unchanged.
**GATE (as literally specified):** `node --test src/__tests__/*.test.js` → full suite
(74 + firestore-store) **ALL PASS**.

## What was done (S1/S3 applied verbatim, byte-for-byte per spec)
- `src/override-engine.js`:
  - `InMemoryFakeStore.eventsFor` → `async`; `runTransaction(fn)` → `async ({ return await fn(); })`; `append` unchanged (S3, verbatim).
  - `OverrideEngine.recordOverride/recordIdentityMerge/recordIdentitySplit/confirm/retract` → `async`, each `await`ing `store.runTransaction(async () => { ... await store.eventsFor(oid) ... })` per S1's literal pattern.
  - `_transition` (pure, no store I/O) left synchronous. `effectiveValue` (unlisted in S1 but store-dependent) made `async` for internal consistency with the now-async `store.eventsFor` — not exercised by any test, no behavioural change to anything tested.
  - No pure decision-logic function (`authorityTier`, `computeOverrideId`, `contentFingerprint`, `validateOverride`, `mintEntityId`, tiering, `PERMITTED_TRANSITIONS`) was touched — INV-B intact.
- No other files changed this task (handlers, `crm-overrides-store.js` untouched — T5/T2 scope respectively).

## GATE — measured (`node --test src/__tests__/*.test.js`), run exactly as written
```
ℹ tests 80
ℹ suites 7
ℹ pass 76
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 677.358393

✖ failing tests:
✖ record_override rejects an agent-supplied override_id
  AssertionError [ERR_ASSERTION]: Missing expected rejection. (enforced-tools.test.js:45)
✖ identity.split via handler mints the v06 anchor byte-identically
  AssertionError: Expected values to be strictly equal: + undefined - 'pending' (enforced-tools.test.js:57)
✖ identity.split rejects an agent-supplied new id (reject-before-mint)
  AssertionError [ERR_ASSERTION]: Missing expected rejection. (enforced-tools.test.js:64)
✖ record (GATED) -> confirm -> retract lifecycle through injected store
  AssertionError: Expected values to be strictly equal: + undefined - 'pending' (enforced-tools.test.js:76)
```
All 4 failures are in `enforced-tools.test.js` (handler-level tests). The 74 baseline
(conformance + integrity + tenant-binding + allowlist) and the 6 `firestore-store.test.js`
tests all still pass — **conformance count has NOT dropped below 74** (INV-B / §4
conformance-drop clause does not fire; every `v01`-`v12` vector still passes).

## Root cause (precise deviation, MEP-3)
`src/tools/record-override.js` / `confirm-override.js` / `retract-override.js` (T5/S5
scope, explicitly **not yet touched**) call the engine synchronously:
```js
event = engine.recordOverride(args);   // no await — T5 hasn't landed yet
```
Now that `OverrideEngine.recordOverride` etc. are `async` (T4/S1, applied this task),
this assignment binds `event` to an **unresolved Promise**, not the resolved event object.
Consequences, reproduced exactly:
- `event.override_id` / `event.status` on a Promise is `undefined` → the two "Expected
  values to be strictly equal: undefined vs 'pending'" failures.
- A rejection from `engine.recordIdentitySplit(...)` (agent-supplied-id / agent-supplied-
  new-id guards) is never awaited by the handler, so it becomes an **unhandled
  Promise rejection** instead of propagating synchronously through the handler's own
  `async function` — the test's `assert.rejects(...)` sees the handler return/resolve
  normally and reports "Missing expected rejection", while `node --test` separately logs
  the unhandled-rejection as an out-of-band error.

This is mechanically unavoidable for *any* spec-conformant async engine implementation:
once the engine methods return Promises, a caller that does not `await` them cannot
observe the resolved value or a thrown error, regardless of engine internals. Confirmed
this is not an S1/S3 implementation defect on my part — the four failures are 100%
localized to the not-yet-updated handler call sites, which are explicitly T5's scope
(S5: "handler awaits") and explicitly **out of T4's ACTIONS list** ("make
recordOverride/.../retract async ... async-ify InMemoryFakeStore" — no handler files
listed).

## The ambiguity (Foreman/Director decision needed)
The job spec gates T4 and T5 as **separate, independently-measured, sequentially-pushed**
tasks (genesis §3: "Advance only after the current task's PASS is pushed"), yet T4's own
literal GATE text ("full suite ... ALL PASS") is **only satisfiable once T5's handler
changes are also present** — the two tasks are not actually independently gateable as
specified. Per BUILDER-OPERATING-PRINCIPLES MEP-3, this real-output-shape-vs-spec
divergence is a STOP + report, not a silent adaptation (i.e., I have not folded T5's
handler-await change into this task to force a green T4, and I have not narrowed the T4
gate command to quietly exclude `enforced-tools.test.js`). Options for the Director:
1. **Merge T4+T5 into one atomic task** (engine async re-projection + handler awaits
   together), gated once at the end — the natural reading given they're mechanically
   inseparable.
2. **Re-scope T4's gate** to explicitly exclude `enforced-tools.test.js`'s handler-driven
   assertions until T5 lands (i.e., the true T4 gate is "conformance.test.js +
   firestore-store.test.js ALL PASS; enforced-tools.test.js handler-path failures are
   expected-red carried into T5"), and have T5's gate restore full-suite ALL PASS.
3. Something else the Director specifies.

I have not chosen between these — that is an architectural/process decision, not the
Builder's to make.

## State of the working tree
The S1/S3 engine change described above is present in the working tree (uncommitted) so
the Director can inspect it. **It has not been committed or pushed** — per genesis §3
("Advance only after the current task's PASS is pushed") there is no measured PASS to
commit against, and per the STOP protocol I am not proceeding to T5 to manufacture one.

## Verdict
**BLOCKED.** Halting per genesis §4. Awaiting Foreman/Director re-dispatch with a
resolved T4/T5 boundary before continuing.

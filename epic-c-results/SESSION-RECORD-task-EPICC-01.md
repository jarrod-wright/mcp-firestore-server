# SESSION RECORD — task-EPICC-01

- **session id:** task-EPICC-01
- **date:** 2026-07-05
- **branch:** epic-b-enforced-overrides
- **starting HEAD (at time this record was created):** a09bde87bbbd193bfe1097da0467211f959491de

> APPEND-ONLY. Nothing below this header is ever edited or deleted once written; each
> step adds a new `##` section to the end of the file. This record was created mid-job
> per an updated instruction (after §1.1 bring-up and T1-T4 had already run); the sections
> below for bring-up/T1-T3 and the T4 BLOCKED are a verbatim reconstruction from the
> commands actually run and their captured output during this session. From this point
> forward, every step appends live.

## §1.1 Bring-up

**Commands run:**
```
cd /workspaces/mcp-firestore-server
git checkout epic-b-enforced-overrides
git pull --ff-only
git rev-parse HEAD
git describe --tags
npm ci
node --test src/__tests__/*.test.js
npm audit --package-lock-only
```

**Output — `git rev-parse HEAD`:**
```
bbfe263f7b9e7efaadd8efcfdcad63e3102ed9fb
```

**Output — `git describe --tags`:**
```
v2.1.1-zapphire1
```

**Output — `npm ci`:** exit 0 (`added 260 packages, and audited 261 packages in 7s`).

**Output — `node --test src/__tests__/*.test.js` (summary lines):**
```
ℹ tests 74
ℹ suites 7
ℹ pass 74
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 516.166325
```

**Output — `npm audit --package-lock-only`:** exit 1 (npm's own exit code reflects total
vulnerabilities of any severity), report body: `8 moderate severity vulnerabilities`
(uuid / gaxios / google-gax / @google-cloud/firestore / firebase-admin / teeny-request /
@google-cloud/storage / retry-request transitive chain). Cross-checked via
`npm audit --package-lock-only --json` → `metadata.vulnerabilities`:
```
{
  "info": 0,
  "low": 0,
  "moderate": 8,
  "high": 0,
  "critical": 0,
  "total": 8
}
```
0 critical / 0 high — gate satisfied.

**Gate check:** branch HEAD = `bbfe263f...` = tag `v2.1.1-zapphire1` (the §6-remediated
HEAD, NOT `07fc7673`) ✓. Baseline 74/74 ✓. 0 critical / 0 high ✓.

RESULT: PASS

## T1 — RED: Firestore-store behaviour test

**Files added:** `src/__tests__/helpers/fake-firestore.js` (S4 `FakeFirestore` double),
`src/__tests__/firestore-store.test.js` (6 tests a-f against the still-old sync in-memory
`CrmOverridesStore`, instrumented via a spy db).

**Command run:**
```
node --test src/__tests__/firestore-store.test.js
```

**Output (verbatim, RED):**
```
✔ (a) db.collection is called with exactly crm_overrides and no other collection (1.518258ms)
✖ (b) eventsFor issues txn.get on a where(override_id,==,...) query (0.993948ms)
✖ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.244556ms)
✖ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.437979ms)
✖ (e) persist-across-restart: a second store instance sees the first instance's events (0.344124ms)
✔ (f) INV-C: txn.delete is never invoked; update payloads never carry a content field (0.32632ms)
ℹ tests 6
ℹ suites 0
ℹ pass 2
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 85.261272

✖ failing tests:

test at src/__tests__/firestore-store.test.js:70:1
✖ (b) eventsFor issues txn.get on a where(override_id,==,...) query (0.993948ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/firestore-store.test.js:76:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at src/__tests__/firestore-store.test.js:84:1
✖ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.244556ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/firestore-store.test.js:95:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at src/__tests__/firestore-store.test.js:100:1
✖ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.437979ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/firestore-store.test.js:115:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at src/__tests__/firestore-store.test.js:121:1
✖ (e) persist-across-restart: a second store instance sees the first instance's events (0.344124ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/firestore-store.test.js:134:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

Each failure is the intended-reason failure (RT-GATE-1/MEP-3): the spy's `calls.gets` /
`calls.sets` / `calls.updates` counters are zero because the still-current sync in-memory
`CrmOverridesStore` never touches `db.collection(...).firestore.runTransaction` or any
`txn.*` method. Not an import/scaffold error.

Committed/pushed as `c4bd0cf` (see `result-EPICC-01-01-firestore-store-red.md`).

RESULT: PASS

## T2 — GREEN: implement Firestore-backed CrmOverridesStore (S2)

**File changed:** `src/tools/crm-overrides-store.js` rewritten per S2 (`runTransaction`,
`eventsFor`, `append`, `_flush`; `ENFORCED_COLLECTION` + constructor binding +
`makeCrmOverridesStore` retained verbatim, INV-A).

**Command run:**
```
node --test src/__tests__/firestore-store.test.js
```

**Output (verbatim, GREEN):**
```
✔ (a) db.collection is called with exactly crm_overrides and no other collection (2.292556ms)
✔ (b) eventsFor issues txn.get on a where(override_id,==,...) query (1.038751ms)
✔ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.506066ms)
✔ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.83467ms)
✔ (e) persist-across-restart: a second store instance sees the first instance's events (0.537775ms)
✔ (f) INV-C: txn.delete is never invoked; update payloads never carry a content field (0.586867ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 101.55369
```

**Full-suite regression check — `node --test src/__tests__/*.test.js` (summary lines):**
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
80 = 74 baseline (untouched) + 6 new firestore-store tests. No count regression.

Committed/pushed as `44cfd21` (see `result-EPICC-01-02-firestore-store-green.md`).

RESULT: PASS

## T3 — conformance/enforced tests → async (S6), engine still sync

**Files changed:** `src/__tests__/conformance.test.js` (every test body driving
`recordOverride`/`recordIdentityMerge`/`recordIdentitySplit`/`confirm`/`retract`/
`eventsFor` → `async` + `await`; `v07`/`v12` `assert.throws` → `await assert.rejects(async
() => {...})`; `v08` and the blob-pin test unchanged, no store/engine call to await),
`src/__tests__/enforced-tools.test.js` (`shared.eventsFor(...)[0]` → `const [ev] = await
shared.eventsFor(...)`). No production code changed. Vector inputs/expectations and
assertion predicates byte-identical — only async/await threading added.

**Command run:**
```
node --test src/__tests__/*.test.js
```

**Output (summary lines):**
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
80/80 — "await-of-sync is harmless" confirmed; no conformance-count drop from 74.

Committed/pushed as `269793a` (see `result-EPICC-01-03-async-reprojection-tests.md`).

RESULT: PASS

## T4 — engine async re-projection (S1, S3) — BLOCKED

**File changed (present in working tree, applied per spec, byte-for-byte):**
`src/override-engine.js` — `InMemoryFakeStore.eventsFor`/`runTransaction` → `async` (S3);
`OverrideEngine.recordOverride`/`recordIdentityMerge`/`recordIdentitySplit`/`confirm`/
`retract` → `async`, each `await`ing `store.runTransaction(async () => { ...await
store.eventsFor(oid)... })` (S1). `_transition` left sync (pure, no store I/O).
`effectiveValue` made `async` for internal consistency (untested, no behavioural change).
No pure decision-logic function touched — INV-B intact.

**Command run:**
```
node --test src/__tests__/*.test.js
```

**Output (verbatim, FAIL):**
```
✔ the three enforced tools are registered and dispatchable (0.22487ms)
ℹ Error: Test "record_override rejects an agent-supplied override_id" at src/__tests__/enforced-tools.test.js:43:1 generated asynchronous activity after the test ended. This activity created the error "Error: agent must not supply override_id; the tool computes it" and would have caused the test to fail, but instead triggered an unhandledRejection event.
ℹ Error: Test "identity.split rejects an agent-supplied new id (reject-before-mint)" at src/__tests__/enforced-tools.test.js:62:1 generated asynchronous activity after the test ended. This activity created the error "Error: agent must not supply a split-product entity id; the engine mints it" and would have caused the test to fail, but instead triggered an unhandledRejection event.
✔ (a) db.collection is called with exactly crm_overrides and no other collection (1.504542ms)
✔ (b) eventsFor issues txn.get on a where(override_id,==,...) query (0.785609ms)
✔ (c) append flushes as txn.set at docId `${override_id}#${seq}` (1.199883ms)
✔ (d) a status mutation flushes as txn.update(ref,{status}) -- status key only (0.621361ms)
✔ (e) persist-across-restart: a second store instance sees the first instance's events (0.360384ms)
✔ (f) INV-C: txn.delete is never invoked; update payloads never carry a content field (0.504303ms)
[INTEGRITY] Tool description hash verified OK
✔ KNOWN_GOOD_TOOL_HASH is a 64-char hex SHA256 (0.918086ms)
✔ inventory is the 11-tool set (8 base + 3 enforced), delete_document absent (0.336689ms)
✔ regenerated hash matches the live inventory (GREEN) (10.346161ms)
✔ the stale 8-tool hash would NOT verify the new inventory (RED is real) (0.262471ms)
✔ tampering with any tool description aborts startup (0.528007ms)
[TENANT] Tenant binding verified OK
[TENANT] Tenant binding verified OK
✔ refuses to bind the ZAPPHIRE vault (forbidden control-plane project) (4.462923ms)
✔ refuses a project that does not match the expected tenant (0.254096ms)
✔ permits the expected tenant project (2.333422ms)
✔ permits a non-forbidden project when no expected tenant is injected (0.241492ms)
✔ fail-closed on a missing/blank project id (0.283089ms)
✔ vault is forbidden even if (mis)set as the expected tenant (0.313957ms)
ℹ tests 80
ℹ suites 7
ℹ pass 76
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 677.358393

✖ failing tests:

test at src/__tests__/enforced-tools.test.js:43:1
✖ record_override rejects an agent-supplied override_id (0.86156ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/enforced-tools.test.js:45:3)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }

test at src/__tests__/enforced-tools.test.js:52:1
✖ identity.split via handler mints the v06 anchor byte-identically (1.148066ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + undefined
  - 'pending'

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/enforced-tools.test.js:57:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: 'pending',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at src/__tests__/enforced-tools.test.js:62:1
✖ identity.split rejects an agent-supplied new id (reject-before-mint) (0.273992ms)
  AssertionError [ERR_ASSERTION]: Missing expected rejection.
      at async TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/enforced-tools.test.js:64:3)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    operator: 'rejects',
    diff: 'simple'
  }

test at src/__tests__/enforced-tools.test.js:71:1
✖ record (GATED) -> confirm -> retract lifecycle through injected store (0.52433ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + undefined
  - 'pending'

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/src/__tests__/enforced-tools.test.js:76:10)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: 'pending',
    operator: 'strictEqual',
    diff: 'simple'
  }
```

**Root cause (MEP-3 precise deviation):** `src/tools/record-override.js` /
`confirm-override.js` / `retract-override.js` (T5/S5 scope, not yet touched) call
`engine.<method>(args)` **without `await`**. Now that the engine methods are `async`
(this task), the handler's `event` variable binds to an unresolved Promise, so
`event.override_id`/`event.status` reads as `undefined`, and a rejection from
`recordIdentitySplit`'s opaque-id guards is never awaited by the handler — it surfaces as
an unhandled rejection instead of propagating through the handler's own `async function`,
so `assert.rejects(...)` sees a normal resolution ("Missing expected rejection"). This is
mechanically unavoidable for any spec-conformant async engine while the handlers remain
un-awaited; confirmed the 4 failures are 100% localized to handler call sites (T5 scope,
explicitly excluded from T4's ACTIONS list). The 74 baseline conformance/integrity/
tenant-binding/allowlist tests and all 6 firestore-store tests still pass — no
conformance-count drop below 74 (INV-B intact; every `v01`-`v12` vector still passes).

**Ambiguity surfaced to Foreman/Director:** T4 and T5 are gated as independent,
sequentially-pushed tasks, but T4's own literal gate ("full suite ALL PASS") is only
satisfiable once T5's handler-await change is also present — the two tasks are not
actually independently gateable as written. Per MEP-3 this is a STOP + report, not a
silent adaptation (did not fold T5 into T4, did not narrow the gate command). Full
detail + three named options for the Director in
`epic-c-results/result-EPICC-01-04-BLOCKED.md` (pushed at `a09bde8`).

**State of working tree at BLOCKED:** the S1/S3 `src/override-engine.js` change described
above was left uncommitted in the working tree for Director inspection — no measured PASS
existed to commit against, per genesis §3 ("advance only after the current task's PASS is
pushed").

RESULT: BLOCKED

## HANDBACK

- **Final commit SHA (this record's own commit, prior to this HANDBACK append):** `633d4365287f0ebb62845038e2d1816c0fbdf49e`
- **Full final `node --test` count line (last full-suite run, T4, `git status`-uncommitted engine.js applied):**
```
ℹ tests 80
ℹ suites 7
ℹ pass 76
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 677.358393
```
- **Status:** BLOCKED — not ready for Director re-tag.

**Exact BLOCKED reason:** T4 (engine async re-projection, S1/S3) was implemented
byte-for-byte per the job spec's design, but its own literal GATE
(`node --test src/__tests__/*.test.js` → full suite ALL PASS) is unreachable in isolation:
76/80 pass, 4 fail, all four in `enforced-tools.test.js`, all caused by
`src/tools/{record,confirm,retract}-override.js` still calling the now-async
`OverrideEngine` methods without `await` — that is explicitly T5/S5 scope, not yet
applied. This is a task-sequencing defect in the job spec itself (T4 and T5 are gated as
independent, sequentially-pushed steps, yet are mechanically inseparable — no
spec-conformant T4-only implementation can satisfy T4's own gate). Per
BUILDER-OPERATING-PRINCIPLES MEP-3 this is a STOP + report, not a silent adaptation; per
genesis §4 a gate needing a decision the Builder wasn't given is an architectural call for
the Foreman/Director, not the Builder. Full detail, reproduction, and three named
resolution options are in `epic-c-results/result-EPICC-01-04-BLOCKED.md` (pushed at
`a09bde8`) and in the `## T4` section above.

**Not** `READY FOR Director re-tag v2.2.0-zapphire1`. Awaiting Foreman/Director
re-dispatch with a resolved T4/T5 gate boundary (see the three options in the T4 section)
before the Builder continues to T5.

## Resume — bring-up (session 2, post-AMEND-01)

Resuming the job. Director ratified Option 1 (merge T4+T5 into T4′) and pushed
`builder-inputs/epic-c/JOB-ORDER-task-EPICC-01-AMEND-01.md`.

**Commands run:**
```
cd /workspaces/mcp-firestore-server
git checkout epic-b-enforced-overrides
git pull --ff-only
git rev-parse HEAD
git describe --tags
```

**Output — `git pull --ff-only`:** fast-forwarded `23b287b..03639d7`, adding
`builder-inputs/epic-c/JOB-ORDER-task-EPICC-01-AMEND-01.md` (27 insertions).

**Output — `git rev-parse HEAD`:**
```
03639d74d6db38a59a5d57381287e345aadf3a99
```

**Output — `git describe --tags`:**
```
v2.1.1-zapphire1-12-g03639d7
```
(12 commits past the tag — expected, since T1/T2/T3/T4-BLOCKED + session-record commits
landed since bring-up. Confirmed the tag is still an ancestor of HEAD:
`git merge-base --is-ancestor v2.1.1-zapphire1 HEAD` → true, branch base intact.)

**Verifying the true committed baseline (engine still sync):** the working tree carried
an uncommitted T4 engine-async edit from the prior session (per AMEND-01 §"Resume point",
expected and to be kept). To measure the *committed* T3 baseline exactly as Step 1
requires, that edit was temporarily stashed (`git stash push --keep-index --
src/override-engine.js`), the suite run, then the stash restored.

**Command run (on committed T3 HEAD, engine sync):**
```
node --test src/__tests__/*.test.js
```

**Output (summary lines):**
```
ℹ tests 80
ℹ suites 7
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 627.725701
```

Stash popped back cleanly afterward (`git stash pop`) — the uncommitted T4 engine-async
edit is restored in the working tree, unchanged, ready to be completed under T4′.

**Gate check:** branch HEAD descends from `v2.1.1-zapphire1` ✓. Suite = 80/80 with engine
sync (T3 committed state) ✓. Matches Step 1's expectation exactly.

RESULT: PASS

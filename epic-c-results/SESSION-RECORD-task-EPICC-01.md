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

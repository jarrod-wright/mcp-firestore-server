# SESSION RECORD — task-MCP-MERGE

- **task id:** `task-MCP-MERGE` · **governing issue:** BLD-652 · **session-of-record:** `oren-rs1-2026-07-11` (RS-1)
- **branch:** `builder/mcp-merge-01` cut from `f2ba66e7`
- **builder:** Claude Code (Sonnet 5), Codespace on fork `jazzahupwork-boop/mcp-firestore-server`

---

## T-M0 — branch + baseline green (no code change)

**Env:**
```
node --version -> v24.14.0
```

**Actions:**
```
git checkout -b builder/mcp-merge-01 f2ba66e7
npm ci
npm test
```

**Evidence (verbatim tail of `npm test`):**
```
ℹ tests 82
ℹ suites 7
ℹ pass 82
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 718.437582
```

**Override vectors integrity check:**
```
$ git hash-object conformance/conformance_vectors.json
d89f54c9280fce1edddb73f8835f5e0664e1bf32
```
Matches pinned override-vectors blob `d89f54c9` (job-spec §conformance pins).

**GATE G0 (binary):** base suite green = 82/82 pass, 0 fail, 0 skipped, AND override vectors blob matches pinned `d89f54c9`. **MET.**

**RESULT: PASS**

---

## T-M1 — RED: prove projection absent on base

**Note on test location:** job-spec §3/T-M1 names the literal path `tests/merge/test_projection_present.js`. The repo's `npm test` script (`package.json`) is `node --test src/__tests__/*.test.js` and does not glob `tests/merge/`. Editing that script glob is not one of the 7 files in the verbatim merge recipe (job-spec §2.2), so it was left untouched to avoid an out-of-recipe change. The merge test is authored at the literal spec path and invoked directly via `node --test tests/merge/*.js` for its own RED/GREEN gates (T-M1/T-M2/T-M4); T-M6/G5 records both `npm test` (base+override suite) and this invocation as combined evidence rather than a single command. Flagging this transparently rather than silently editing `package.json` or silently dropping the literal path.

**Action:** authored `tests/merge/test_projection_present.js` — a self-contained fake-Firestore double (no shared test helpers touched) exercising `query_collection` handler directly against a 3-doc `compilation_artifacts` collection carrying heavy fields (`compiled_layers` ~19KB string, `embedding` 2048-dim array per `constants.js` HEAVY_COLLECTIONS comment on `master`). Asserts, with `fields` omitted: heavy fields stripped, `_meta` present with `cursor`, response byte-capped `<= 40000`.

**Run on base (pre-overlay):**
```
$ node --test tests/merge/test_projection_present.js
```

**Evidence (verbatim):**
```
✖ heavy-collection query_collection() default projection (T-M1/T-M2) (3.260067ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
...
  AssertionError [ERR_ASSERTION]: compiled_layers must be stripped by default projection on compilation_artifacts

  true !== false

      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/tests/merge/test_projection_present.js:111:12)
  {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

**GATE G1-RED (binary):** test FAILS as `AssertionError` (`compiled_layers must be stripped...`, actual `true` vs expected `false`) — a genuine structural failure (projection absent on the override-only base), not an import/collection error. **MET.**

**RESULT: PASS**

---

## T-M2 — GREEN: overlay projection stack

**Action:** overlaid the 7 named files from `master` (job-spec §2.2), verbatim, via `git checkout master -- <path>`:
```
src/constants.js
src/helpers/query.js
src/helpers/schema.js
src/tools/query-with-where.js
src/tools/query-collection.js
src/tools/get-document.js
src/tools/batch-get.js
```
`git status --short` post-overlay shows 6 files modified; `src/tools/batch-get.js` produced zero diff (already byte-identical between `f2ba66e7` and `master`) — confirmed via direct diff, no-op overlay for that file. `index.js` and `src/tools/index.js` diff = empty (untouched), confirmed via `git diff --stat HEAD -- index.js src/tools/index.js`.

**Re-run T-M1 test (`node --test tests/merge/test_projection_present.js`):**
```
✔ heavy-collection query_collection() default projection (T-M1/T-M2) (3.043824ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

**GATE G1-GREEN (binary):** `test_projection_present.js` passes post-overlay: metadata-only default on `compilation_artifacts`, `_meta`+cursor present, byte-capped. **MET.**

**Full base suite sanity run (`npm test`) post-overlay:**
```
ℹ tests 82
ℹ suites 7
ℹ pass 80
ℹ fail 2
ℹ skipped 0

✖ failing tests:
✖ UT9: computed hash from source definitions matches known-good constant
✖ regenerated hash matches the live inventory (GREEN)
```
Both failures are the `KNOWN_GOOD_TOOL_HASH` integrity checks (UT9) — expected: the overlay changed 3 tool descriptions (`query_collection`/`query_with_where`/`get_document`), so the base-pinned hash `aa1f78f7` is now stale by design. This is T-M5's scope (reseal), not a T-M2/T-M3 concern. No override-tool test is among the 2 failures — all `record_override`/`confirm_override`/`retract_override`, allowlist, tenant-binding, and conformance-vector suites remain green at this point (verified individually in T-M3 next).

**RESULT: PASS**

---

## T-M3 — regression guard: override suite preserved (load-bearing, L-141/L-145)

**Action:** ran the override/oracle/vectors/allowlist/tenant suites explicitly against the overlaid tree (isolating them from the still-stale integrity-hash failure, which is T-M5's concern):
```
$ node --test src/__tests__/conformance.test.js src/__tests__/enforced-tools.test.js \
    src/__tests__/allowlist-invariant5.test.js src/__tests__/allowlist.test.js \
    src/__tests__/append-only-gate.test.js src/__tests__/tenant-binding.test.js \
    src/__tests__/firestore-store.test.js
```

**Evidence (verbatim tail):**
```
ℹ tests 77
ℹ suites 7
ℹ pass 76
ℹ fail 1
ℹ skipped 0

✖ failing tests:
✖ UT9: computed hash from source definitions matches known-good constant
```
The single failure is the same pre-flagged `KNOWN_GOOD_TOOL_HASH` staleness from T-M2 (T-M5's scope). Every override-specific test is green, unchanged from T-M0's baseline: `vectors file matches the pinned oracle blob (no silent contract drift)`, `v01`–`v12` (oracle `e997e8f9` vectors, all pass), `record_override`/`confirm_override`/`retract_override` registration + dispatch, append-only-gate (a)–(f), `generic create_document CANNOT write crm_overrides`, `generic update_document CANNOT write crm_records`, `hard exclusion resists case + subpath smuggling for crm_overrides`.

**Conformance vectors blob check:**
```
$ git hash-object conformance/conformance_vectors.json
d89f54c9280fce1edddb73f8835f5e0664e1bf32
```
Unchanged, still matches pinned `d89f54c9` (file was not touched by the overlay — not one of the 7 recipe files).

**`HARD_EXCLUDED_FROM_WRITES` intact:**
```
$ grep -n "HARD_EXCLUDED_FROM_WRITES" src/allowlist.js
27:const HARD_EXCLUDED_FROM_WRITES = ['knowledge', 'okg', 'crm_overrides', 'crm_records'];
201:    if (HARD_EXCLUDED_FROM_WRITES.includes(segment)) return BLOCKED;
```
Still contains `crm_overrides` + `crm_records`, unchanged from `f2ba66e7` (this file was not one of the 7 overlaid files).

**GATE G2 (binary):** override tools present, vectors GREEN, unchanged from T-M0; `HARD_EXCLUDED_FROM_WRITES` intact. No override regression. **MET.**

**RESULT: PASS**

---

## T-M4 — RED→GREEN: `resolve_timestamp` tool

**Note on tz source:** grounding (L-122/L-140) states "config tz already ET" as closure evidence that no timezone-configuration work is needed elsewhere — this repo has no existing tz config to "read" (grepped for `America/New_York`/`timezone`/`TZ` across the tree — no hits outside the new test). Read this as: the tz value itself (`America/New_York`) is already decided/verified by the Director/Foreman; the tool hardcodes it as a named constant (stdlib `Intl`, no external deps). Flagging this reading rather than silently assuming a config-reading mechanism that doesn't exist in this repo.

**RED — action:** authored `tests/merge/test_resolve_timestamp.js`, asserting against the tool registry (`src/tools/index.js` `getToolDefinitions`/`getHandler`) rather than importing `src/tools/resolve-timestamp.js` directly, so the pre-implementation run fails as a genuine `AssertionError` (tool absent) rather than a module-not-found import error.

**Run pre-implementation:**
```
$ node --test tests/merge/test_resolve_timestamp.js
✖ resolve_timestamp tool exists and returns ISO time in server tz (T-M4) (1.332664ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1

  AssertionError [ERR_ASSERTION]: expected a resolve_timestamp tool definition to be registered
      at TestContext.<anonymous> (file:///workspaces/mcp-firestore-server/tests/merge/test_resolve_timestamp.js:15:10)
  {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }
```

**GATE G3-RED (binary):** test FAILS as `AssertionError` (tool genuinely absent from registry), not an import/collection error. **MET.**

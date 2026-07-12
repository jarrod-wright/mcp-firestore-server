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

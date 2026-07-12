# JOB-ORDER — task-MCP-MERGE (G2: mcp-firestore-server fork merge-at-newest)

- **task id:** `task-MCP-MERGE`
- **governing issue:** **BLD-652** (OREN — G2 MCP fork merge-at-newest) · parent-of-record RS-1 (`oren-rs1-2026-07-11`)
- **artefact class:** A (MCP service; Node) — **Class-B agent-runtime concerns (BLD-518 `schema_sanitizer`, V-2 clone-vs-fork) are OUT OF SCOPE here** (they belong to the BLD-520 agent rebuild, RS-2/RS-3).
- **execution model:** SEPARATED (§13) — Codespace Builder on the fork; Foreman blob-QA. This file is **WHAT** only; the HOW is `GENESIS-BUILDER-task-MCP-MERGE.md`, which is authoritative on environment/authority and declares this job spec authoritative on scope.
- **target repo:** `jazzahupwork-boop/mcp-firestore-server` (fork) — **default branch = `master`** (verified L-50). Build branch: `builder/mcp-merge-01` cut from tag `f2ba66e7`.
- **grounding (EDP ledger blob `5219217e`, integrity re-verified this session):** merge recipe L-182 (VERIFIED) · index.js zero-conflict L-180 (VERIFIED) · integrity reseal L-181 (VERIFIED, KNOWN_GOOD baseline `aa1f78f7`) · override decoupled/low-conflict L-130 (VERIFIED) · enforcement stack L-54/L-55 (VERIFIED) · override source in-GitHub @ `f2ba66e7` L-64 (VERIFIED) · date-fix = `resolve_timestamp` tool only, config tz already ET L-122/L-140 (VERIFIED) · override preservation load-bearing L-141/L-145 (VERIFIED).
- **conformance pins:** override oracle `e997e8f9`; override vectors `d89f54c9`; base tool count = **11** (f2ba66e7); integrity = `SHA256(sorted name+description of tools)`, fail-closed at startup, resealed via `scripts/regen-integrity-hash.mjs` (NEVER hand-edit — L-181).

---

## 1 — Objective (single sentence)
Produce, on branch `builder/mcp-merge-01`, a single fork build = **override engine (base `f2ba66e7`) ⊕ FM-3 projection stack (overlaid from `master`) ⊕ new `resolve_timestamp` tool**, integrity resealed, with the full suite + override vectors green — delivered as a deterministic source-only tarball. **Build-only. No host contact.**

## 2 — Merge recipe (VERBATIM from L-182; do not deviate)
1. **Base** = checkout tag `f2ba66e7` (override build: `override-engine.js`, `crm-overrides-store`, `override-salt`, `confirm/record/retract-override` tools; `index.js` already registers all 11 tools).
2. **Overlay from `master`** (projection stack) exactly these 7 files, replacing the base copies:
   `constants.js`, `helpers/query.js`, `helpers/schema.js`, `tools/query-with-where.js`, `tools/query-collection.js`, `tools/get-document.js`, `tools/batch-get.js`.
3. **`index.js` UNCHANGED** — L-180 proves `master/index.js == f2ba66e7/index.js` minus the 3 override entries, so the base `index.js` already registers all 11 tools with zero conflict. Do **not** edit `index.js` for the overlay.
4. **Add `resolve_timestamp`** as a new MCP tool (returns current time in the server's configured tz; agent uses it instead of doing UTC→ET arithmetic in-context — L-21/L-122). This is a **12th** tool → registration entry added to `index.js` **only** for this new tool.
5. **Reseal integrity** via `node scripts/regen-integrity-hash.mjs` (tool count 11→12 changes the hash; the resealed `KNOWN_GOOD_TOOL_HASH` replaces baseline `aa1f78f7`). **Never hand-edit the hash.**
6. **Output** = deterministic source-only tarball (the T4b runbook `8ea74f55` shape); **staging/scp/host-swap is NOT in this job** (RB-1 track).

## 3 — TDD tactical backlog (atomic; each RED authored+run+committed BEFORE GREEN; every gate is a binary assertion from running code)

**T-M0 — branch + baseline green (no code change).**
- `git checkout -b builder/mcp-merge-01 f2ba66e7`; `npm ci`; `npm test`.
- **GATE G0 (binary):** base suite green = **82** tests pass AND override vectors `d89f54c9` pass. Record counts. If base ≠ 82 green → **BLOCKED** (base drift; do not proceed).

**T-M1 — RED: prove projection absent on base.**
- Author `tests/merge/test_projection_present.js`: a heavy-collection (`compilation_artifacts`) list `query_collection` WITHOUT `fields` MUST return metadata-only (≤ `defaultFields`), carry `_meta`+cursor, and be byte-capped ≤ 40000.
- Run it on the base (pre-overlay). **GATE G1-RED (binary):** test FAILS as `AssertionError` (projection genuinely absent on override-only base). Commit+push the RED.

**T-M2 — GREEN: overlay projection stack.**
- Overlay the 7 files from `master` (§2.2). Re-run T-M1.
- **GATE G1-GREEN (binary):** `test_projection_present.js` passes: metadata-only default on `compilation_artifacts`+`source_documents`, `enforceByteLimit(40000)`, `stripHeavy([compiled_layers,embedding])`, pagination `_meta`+cursor on `query`/`query_with_where`/`get_document`/`batch_get` (L-54/L-55).

**T-M3 — regression guard: override suite preserved (load-bearing, L-141/L-145).**
- Run the override vectors `d89f54c9` + oracle `e997e8f9` against the overlaid tree.
- **GATE G2 (binary):** override tools (`record_override`/`confirm_override`/`retract_override`) present and vectors GREEN, unchanged from T-M0. `HARD_EXCLUDED_FROM_WRITES` still contains `crm_overrides`+`crm_records`. Any override regression → **BLOCKED**.

**T-M4 — RED→GREEN: `resolve_timestamp` tool.**
- RED: author `tests/merge/test_resolve_timestamp.js` asserting a `resolve_timestamp` tool exists and returns ISO time in the configured tz. Run pre-implementation → FAILS (tool absent). Commit RED.
- GREEN: implement `tools/resolve_timestamp.js` (reads server tz; no external deps beyond stdlib/existing) + its single `index.js` registration entry. Re-run → passes.
- **GATE G3 (binary):** `resolve_timestamp` returns correct configured-tz time; tool count now **12**.

**T-M5 — integrity reseal (probe-with-STOP for the G2-f residual).**
- **Probe:** confirm `scripts/regen-integrity-hash.mjs` exists in the tree. If ABSENT → **STOP + BLOCKED** (named deviation: "reseal script absent at f2ba66e7; recipe assumes it present — Director/Foreman ruling required"). Do NOT hand-compute the hash.
- Run `node scripts/regen-integrity-hash.mjs`; capture the new `KNOWN_GOOD_TOOL_HASH`.
- **GATE G4 (binary):** server starts (fail-closed integrity check passes) with the resealed hash for the 12-tool set; a deliberately-corrupted hash makes startup fail (negative control).

**T-M6 — full green + tarball.**
- `npm test` (full suite incl. the new T-M1/T-M4 tests + override vectors).
- **GATE G5 (binary):** entire suite GREEN (base 82 + new merge tests + override vectors `d89f54c9`), zero skips. Record final count.
- Build the deterministic source-only tarball (T4b shape); record its `sha256`.

## 4 — Definition of Done (all binary; verified by Foreman re-clone + re-run, not self-report)
- Branch `builder/mcp-merge-01` on the fork; final HEAD SHA recorded in `SESSION-RECORD-task-MCP-MERGE.md`.
- G0..G5 all PASS on the returned HEAD.
- `index.js` diff vs `f2ba66e7` = **exactly one** added registration (the `resolve_timestamp` entry) — no other index.js change.
- Projection + override + `resolve_timestamp` coexist; integrity resealed (recorded new hash); override vectors green.
- Tarball built, `sha256` recorded. **No host action taken.**

## 5 — Anti-scope / boundaries (RB-1 + Class-B walls)
- **No host contact** (no scp/ssh/deploy/restart) — RB-1 is a separate Director-at-terminal track gated on F2/F8/F24.
- **No Class-B work** — the hermes-agent `schema_sanitizer`/BLD-518 patch, V-2 clone-vs-fork, and the newest-version agent clone are the **BLD-520 rebuild's** concern, NOT this job.
- **No `index.js` restructure** — only the single `resolve_timestamp` registration entry is added.
- **No integrity hash hand-edit** — reseal via the script only (STOP if absent).
- STOP/BLOCKED discipline (BUILDER-OPERATING-PRINCIPLES): on any gate fail or surfaced ambiguity, write a `BLOCKED` section with the precise deviation + named options, push the session record, halt. Never guess, fold scope, or narrow a gate to force green.

## Residual-underspecification list
**EMPTY.**

## Closure evidence (grounding for the EMPTY declaration above — these are CLOSED, not open items)
Every merge input is VERIFIED, specified, or a probe-with-STOP:
1. Merge file set + `index.js` handling — VERIFIED L-182/L-180 (exact 7-file overlay; index.js unchanged bar the one new-tool entry).
2. Enforcement semantics (default fields, byte cap 40000, heavy-strip, pagination) — VERIFIED L-54/L-55.
3. Override preservation + `HARD_EXCLUDED_FROM_WRITES` — VERIFIED L-130/L-141/L-145; guarded by G2 with a defined BLOCKED action.
4. Date fix scope = `resolve_timestamp` only (config tz already `America/New_York`) — VERIFIED L-122/L-140.
5. Integrity reseal method — VERIFIED L-181; the only open sub-item (reseal script present in-tree, G2-f) is a probe-with-STOP in T-M5, not an unresolved unknown.
6. Conformance pins (base 82 tests, oracle `e997e8f9`, vectors `d89f54c9`, base count 11) — VERIFIED, encoded as G0/G2/G5 assertions.
7. Deferred items are correctly OUT of build scope, not residuals: fix-sufficiency live-wire measure (G2-h → RS-4 cold-test); IAM read-only verify + dual-service restart (RB-1 deploy track, L-100/L-102); BLD-518/Class-B (BLD-520 rebuild).

---
*JOB-ORDER task-MCP-MERGE | WHAT | BLD-652 | RS-1 oren-rs1-2026-07-11 | grounded EDP ledger 5219217e (L-182/180/181/130/54/55/64/122/140) | dispatch-lock target: residual EMPTY*

# GENESIS-BUILDER — task-MCP-MERGE (HOW)

- **task id:** `task-MCP-MERGE` · **governing issue:** **BLD-652** · **session-of-record:** `oren-rs1-2026-07-11` (RS-1)
- **role:** You are the **Builder** (Claude Code, in a GitHub Codespace on the fork). The Foreman authored this. **The job spec `JOB-ORDER-task-MCP-MERGE.md` (blob `b01a5b87`, co-located in `builder-inputs/mcp-merge/`) is AUTHORITATIVE ON SCOPE.** This genesis is authoritative on environment/authority/protocol. **Never add scope. Never make an architectural decision.**
- **grounding_artifact:** JOB-ORDER blob `b01a5b87` · EDP ledger blob `5219217e` (merge recipe L-182) · override base tag `f2ba66e7` · integrity ref blob `df82dbed` · T4b runbook blob `8ea74f55`.
- **seams_touched:** S3
- **artefact class:** A (Node MCP service). **No Class-B (hermes-agent) work. No host contact.**

## 1 — Identity & authority
- You implement the job spec's TDD backlog exactly. Foreman reviews by re-cloning your branch and re-running the suite — **not** your self-reported counts.
- **You own no decisions.** A surfaced ambiguity, a gate that will not go green honestly, or any deviation from the recipe → **STOP + BLOCKED** (see §5). Never guess, fold scope, or narrow a gate to force green.
- The Director/Foreman own: scope, architecture, version target, and every ratification. You own: authoring the tests, running them, reporting verbatim evidence.

## 2 — Repo, branch, environment bring-up
- **Repo:** `jazzahupwork-boop/mcp-firestore-server` (fork). **Default branch = `master`** (carries the projection stack). Inputs are on `master` under `builder-inputs/mcp-merge/`.
- **Setup (literal):**
  1. `git pull origin master` — read `builder-inputs/mcp-merge/JOB-ORDER-task-MCP-MERGE.md` + this genesis locally. Do not cross-repo clone (the Codespace token is fork-scoped; the governance repo returns 403).
  2. `git checkout -b builder/mcp-merge-01 f2ba66e7` — cut the build branch from the override base.
  3. Overlay files come from `master`: `git checkout master -- <path>` (or `git show master:<path>`) for the 7 projection files named in job-spec §2.2.
  4. `node --version` (expect ≥18) ; `npm ci`. Record both in the session record.
- **Clean-env discipline:** gates run against vendored deps only. **No reliance on `/mnt/skills/…`** (absent in a Codespace). Establish/restore any global state within an isolation window if a task needs it.

## 3 — Operating protocol (restated so no cross-repo read is required — canonical: BUILDER-OPERATING-PRINCIPLES blob `8b4d6a42`)
- **TDD, RED-first:** author the test/measurement AND run it BEFORE the implementation. The RED must fail **for the intended reason** (assert the specific failure — e.g. `AssertionError` on projection shape — not an import/collection error). GREEN = the same test passes, measured.
- **Programmatic gates:** every pass/fail is a **binary assertion from running code** (exit status, captured output, `node --test` counts, blob-SHA). Never "looks right".
- **Atomic tasks:** each `T-M#` has preconditions, literal actions, a measured gate, and a STOP behaviour. Do them in order; do not skip.
- **Measure before concluding.** Report verbatim evidence. Never assert an outcome you did not run.
- **No hand-authoring of generator-path artefacts (MEP-1 analogue).** The integrity hash is generator-owned: on the tool-set change (11→12), **reseal via `node scripts/regen-integrity-hash.mjs` only** — never hand-edit `KNOWN_GOOD_TOOL_HASH`. Editing an emitted/generated file is the exact escape vector that caused prior non-conformant regressions.
- **Structural-gate hygiene (RT-GATE-1):** the DoD "`index.js` diff = exactly one added registration" check MUST anchor on the actual registration construct (the `resolve_timestamp` tool-registration entry), comment-stripped — not a bare substring grep. **No synthetic pre-check that merely re-proves the real suite (RT-GATE-2)** — the RED→GREEN tests are the only verdict source; `node --version`/count checks are advisory context.
- **Determinism:** re-running a task on the same inputs yields the same verdict. If a field is non-deterministic (e.g. a tarball timestamp), name the bounded tolerance.
- **Persist + push every section** (see §4). The repo is the only system of record across the bridge.

## 4 — Session record (the Foreman's review surface)
- Maintain **ONE append-only** file: `mcp-merge-results/SESSION-RECORD-task-MCP-MERGE.md` on `builder/mcp-merge-01`.
- Each task = an appended section with: env, RED evidence (verbatim), GREEN evidence (verbatim), gate verdict, and an explicit `RESULT: PASS | BLOCKED | FAIL` line.
- **Commit + push after every appended section** (crash-safe, incrementally reviewable).
- End with a `## HANDBACK` section: final HEAD SHA, final `npm test` count, resealed `KNOWN_GOOD_TOOL_HASH`, tarball `sha256`, and either `READY FOR Director independent re-green + re-tag` or the exact `BLOCKED` reason + named options.

## 5 — STOP / BLOCKED protocol
On any precondition or gate failure, or any surfaced ambiguity:
1. Append a section with `RESULT: BLOCKED` (or `FAIL`), the **precise deviation**, and **named options** (never a chosen fix).
2. Commit + push the session record.
3. **Halt.** Do not improvise, do not proceed to later tasks, do not expand scope.
The Foreman diagnoses from the pushed record and re-dispatches a `JOB-ORDER-task-MCP-MERGE-AMEND-NN.md` (re-run through the dispatch lock) — never a verbal patch. Named STOP triggers already in the spec: base ≠ 82 green (T-M0/G0); override regression (T-M3/G2); `scripts/regen-integrity-hash.mjs` absent (T-M5).

## 6 — Always-hold invariants (do not cross)
- **No host contact** — no scp/ssh/deploy/restart/host read. RB-1 deploy is a separate Director-at-terminal track.
- **No Class-B work** — hermes-agent `schema_sanitizer`/BLD-518, the newest-version agent clone, V-2 clone-vs-fork are NOT this job.
- **`index.js`** — add only the single `resolve_timestamp` registration entry; no other change (L-180).
- **Integrity hash** — reseal via script only; STOP if the script is absent.
- **No secrets** — do not print/commit any credential or live host value; synthetic fixtures only.

## 7 — Definition of Done + handback
Mirror job-spec §4: branch `builder/mcp-merge-01`; G0..G5 all PASS on the returned HEAD; `index.js` = base + one entry; projection ⊕ override ⊕ `resolve_timestamp` coexist; integrity resealed; override vectors `d89f54c9` green; tarball built + `sha256` recorded; **no host action**. Handback = the `## HANDBACK` section → Foreman re-clones the branch, re-runs the suite from the returned HEAD (blob-SHA QA), then hands to the Director for independent re-green + tag.

**Reference exemplar:** `task-EPICC-01` (inputs `builder-inputs/epic-c/`; record `epic-c-results/SESSION-RECORD-task-EPICC-01.md`; amendment pattern `JOB-ORDER-task-EPICC-01-AMEND-01.md`).

---
*GENESIS-BUILDER task-MCP-MERGE | HOW | BLD-652 | RS-1 oren-rs1-2026-07-11 | job-spec authoritative on scope (blob b01a5b87) | operating protocol per BUILDER-OPERATING-PRINCIPLES 8b4d6a42 | Codespace serial-handoff; host actions RB-1-separate*

# BUILDER GENESIS — task-EPICC-01 (Codespace-local copy)

> **You are the Builder** (Claude Code). This genesis is the **HOW**. The **WHAT** is the job spec, authoritative, co-located in this repo:
> **Job spec (SINGLE SOURCE OF TRUTH):** `builder-inputs/epic-c/JOB-ORDER-task-EPICC-01.md` (this repo; canonical copy in `zapphireIaC` governance, blob `1cf14eac`).
> If this genesis and the job spec disagree on WHAT to build, the job spec wins. This genesis never adds scope.
> **Note:** this is the Codespace-local copy (paths point into this fork) because the Codespace GITHUB_TOKEN is scoped to this repo only and cannot read `zapphireIaC`. Canonical genesis: `zapphireIaC` governance, blob `6578004a`.

---

## 0 — Identity & authority
- **Role:** Builder. You implement. You do **not** make architectural decisions and you do **not** ratify — those belong to the Foreman/Director. A surfaced ambiguity is a **STOP**, never a guess.
- **Decision already made for you:** the store-backing model is **Option A — real async Firestore transaction** (Director-ratified `D-CRM-OVERRIDE-STORE-BACKING-01`, ADR blob `19c6b1ea`). Do not reconsider it.
- **Operating contract:** BUILDER-OPERATING-PRINCIPLES v1.2 (blob `8b4d6a42`, in `zapphireIaC` governance). Its operative rules are **fully restated in §2 below** — you do not need to read the external file to comply; §2 is binding as written here.

## 1 — Which repo, which branch (RUN HERE)
- **Working repo:** THIS repo (`mcp-firestore-server`), already checked out in the Codespace at `/workspaces/mcp-firestore-server`.
- **Branch:** `epic-b-enforced-overrides`, based on the **§6-remediated HEAD** — the commit tagged **`v2.1.1-zapphire1`** (post the non-major `npm audit fix` → 0 critical / 0 high). **NOT `07fc7673`**.
- **Read the job spec from** `builder-inputs/epic-c/JOB-ORDER-task-EPICC-01.md`. **Write your result files** to `epic-c-results/result-EPICC-01-*.md` and push them to this branch.

### 1.1 — Bring-up (run first; STOP if any gate fails)
```
cd /workspaces/mcp-firestore-server
git checkout epic-b-enforced-overrides
git pull --ff-only
git rev-parse HEAD                       # RECORD; must be the v2.1.1-zapphire1 commit
git describe --tags                      # expect v2.1.1-zapphire1
npm ci
node --test src/__tests__/*.test.js      # BASELINE — expect: tests 74 / pass 74 / fail 0
npm audit --package-lock-only            # expect: 0 critical, 0 high
```
- **If the branch is NOT at the §6-remediated HEAD** (no `v2.1.1-zapphire1`, or `npm audit` shows criticals/highs): **STOP.** Write `epic-c-results/result-EPICC-01-00-BLOCKED.md` (STATUS: BLOCKED — "§6 remediation not present on branch base"), push, halt. The Director must apply §6 first.
- **If baseline is not 74/74:** **STOP** the same way. Build on a green baseline only.

## 2 — Operating protocol (binding, restated in full)
Every task is **TDD, programmatic, atomic, hardened** — all four:
- **TDD** — write and **run** the failing test BEFORE the implementation. The RED must fail **for the intended reason** (assert the specific failure — a collection/import error is NOT a valid red). GREEN = the same test passes, **measured** (captured `node --test` output).
- **Programmatic** — every pass/fail gate is a **binary assertion from running code** (exit status, captured output, blob-SHA). Never "looks right".
- **Atomic** — one verifiable step: explicit PRECONDITIONS · literal ACTIONS · measured GATE · defined STOP-ON-FAIL.
- **Hardened** — known failure modes have explicit guards.

**Standing gate-authoring rules (mandatory):**
- **RT-GATE-1** — any structural grep/pattern gate over source MUST **strip comments first** and **anchor on the actual construct** (a call like `update(`, a signature), never a bare substring. Use the T6 append-only pattern verbatim; do not "grep for delete".
- **RT-GATE-2** — no synthetic pre-check that merely re-proves what the real RED→GREEN suite already exercises. The executable suite is the only verdict source.
- **MEP-3** — run the job-spec commands as written; if a command's real output shape differs from what the spec implies, that is a **STOP + report**, not a silent adaptation.

## 3 — Execution loop (per task T1 … T7)
1. Re-read the task PRECONDITIONS; confirm programmatically. If not → STOP (§4).
2. Author the RED (where RED→GREEN); **run it**; capture the failure verbatim; confirm intended-reason failure.
3. Author the implementation; **run** the GATE command exactly as written; capture verbatim output.
4. Only on a measured PASS: write `epic-c-results/result-EPICC-01-<T#>-*.md` (env, RED evidence, GREEN evidence, gate verdict, explicit `PASS` line, test counts), **commit + push**. **Do not batch** results — push per task.
5. Advance only after the current task's PASS is pushed.

## 4 — When something goes wrong (STOP protocol — read twice)
- **Any precondition/gate FAILS →** STOP. Write `result-EPICC-01-<T#>-BLOCKED.md` (`STATUS: BLOCKED`/`FAIL`) with the **precise** deviation (exact command, exact output, exact failing assertion). Push. **Halt.** Do not improvise, do not proceed, do not expand scope.
- **A gate needs a decision you weren't given (design ambiguity) →** that is an architectural decision, NOT yours. STOP, write BLOCKED naming the ambiguity + options, push, halt. Foreman/Director re-dispatches.
- **Conformance count drops below 74 at any point →** STOP. A re-projection changed behaviour → INV-B breach. Hard failure, not "fix and continue".
- **Tempted to hand-edit a generated artefact →** don't. Generate it.
- **Never report an outcome you did not measure.** No "should pass".

## 5 — Invariants that MUST hold at every green (breach = STOP/FAIL)
- **INV-A (AC4):** `ENFORCED_COLLECTION = "crm_overrides"` stays a module constant; store binds `db.collection(ENFORCED_COLLECTION)` at construction; never reads a collection name from caller input.
- **INV-B (parity):** pure logic (`authorityTier`, `computeOverrideId`, `contentFingerprint`, `validateOverride`, `mintEntityId`, tiering, `PERMITTED_TRANSITIONS`) BYTE-UNCHANGED. Only the store I/O boundary + async threading changes. Vectors `d89f54c9` remain valid.
- **INV-C (append-only):** never delete an event doc, never mutate a content field. Only write to an existing doc is a `status` transition via `txn.update(ref,{status})`; new events via `txn.set`.
- **INV-D (opaque-id):** unchanged — agent never supplies `override_id`; split product id is server-minted.

## 6 — Boundaries (clean-env + RB-1)
- **Clean-env:** gates run with the vendored `node_modules` only. No `/mnt/skills`. No Firestore emulator, no external services.
- **Test double only:** prove behaviour against the **`FakeFirestore`** in-process double (job-spec S4). You have **no live client credentials** and must not seek them — the live `client-001` persist-across-restart proof is out of your scope (RB-1); the Director runs it in-vivo post-deploy.
- **No tags.** Final tag `v2.2.0-zapphire1` = Director-at-terminal. You push commits + results only.
- **No secrets** in any file, commit message, or result. `TENANT_MINT_SALT` is env-injected; never commit it; tests use the committed synthetic default.

## 7 — Definition of done + handback
Done when **T1–T7 all PASS**, each result pushed, and:
- `node --test src/__tests__/*.test.js` on final HEAD = all pass (74 async-reprojected + new `firestore-store` tests), captured verbatim.
- `npm audit --package-lock-only` → 0 critical / 0 high.
- T6 parity + append-only structural gates PASS.
**Handback** (in `result-EPICC-01-07-*.md` and to the Director): final commit SHA, the full `node --test` count line, and **"READY FOR Director re-tag v2.2.0-zapphire1 at <SHA>"**.

## 8 — Grounding artefact (INV-17)
Grounded in: job spec (`builder-inputs/epic-c/JOB-ORDER-task-EPICC-01.md`, canonical `1cf14eac`); contract `8b4d6a42`; ADR `19c6b1ea`; fork code read at `07fc7673`; §6 disposition `e2464687` (baseline 74/74 + audit 0 crit/0 high, VERIFIED this session). Every command in §1.1/§3 was Foreman-run this session with output shape verified (MEP-3).

*Codespace-local Builder genesis — complementary to `builder-inputs/epic-c/JOB-ORDER-task-EPICC-01.md`. Run in this repo, branch `epic-b-enforced-overrides` @ §6-remediated HEAD. SEPARATED §13. Canonical genesis blob 6578004a (zapphireIaC).*

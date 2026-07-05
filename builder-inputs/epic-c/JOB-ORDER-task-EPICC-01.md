# JOB ORDER task-EPICC-01 — Epic-C: live Firestore append-only store backing (Option A)

> **Contract:** BUILDER-OPERATING-PRINCIPLES.md v1.2 (blob `8b4d6a42`). Fully hardened, programmatic, TDD, atomic. §3a RT-GATE-1/2 + §3b MEP-3 binding.
> **Authority:** Foreman-authored, Director-ratified D-CRM-OVERRIDE-STORE-BACKING-01 = **Option A**. §13 = **SEPARATED** (Builder implements; Foreman does not write this code).
> **Governing:** BLD-562 / Epic-C. **ADR:** ADR-CRM-OVERRIDE-STORE-BACKING-01 (blob `19c6b1ea`).

## grounding_artifact (INV-17)
- Fork `jazzahupwork-boop/mcp-firestore-server` @ **§6-remediated HEAD** (branch `epic-b-enforced-overrides`, post `v2.1.1-zapphire1`). Builder BRANCHES from that commit — NOT `07fc7673` (pre-remediation).
- Code read this session (blob-verified via clone at `07fc7673`): `src/tools/crm-overrides-store.js` (sync in-memory seam), `src/override-engine.js` (conformance-pinned; mutate-in-place transaction body), `src/tools/{record,confirm,retract}-override.js` (sync engine calls), `src/server.js` L117 (`await handler(args, db)`), `src/__tests__/conformance.test.js` (sync driver).
- Oracle parity anchor: `conformance_vectors.json` blob `d89f54c9` (emitted by Python oracle `e997e8f9`). ADR-04 "Python = executable spec; JS = conformant projection".
- Baseline suite (VERIFIED this session on real toolchain): `npm ci && npm test` = **74/74 PASS**.

## INVARIANTS — MUST hold post-change (any breach = STOP/FAIL)
- **INV-A (AC4 collection hardwire):** `ENFORCED_COLLECTION = "crm_overrides"` stays a module constant; the store binds `db.collection(ENFORCED_COLLECTION)` at construction and NEVER reads a collection name from caller input.
- **INV-B (decision-logic parity):** the pure logic — `authorityTier`, `computeOverrideId`, `contentFingerprint`, `validateOverride`, `mintEntityId`, AUTO/GATED tiering, `PERMITTED_TRANSITIONS` — is BYTE-UNCHANGED. This change touches ONLY the store I/O boundary + the `async`/`await` threading around it. Conformance vectors `d89f54c9` remain valid; only the harness await-style changes.
- **INV-C (append-only):** the store NEVER deletes an event doc and NEVER mutates a content field. The ONLY permitted write to an existing doc is a `status` transition via `txn.update(ref, {status})`. New events are `txn.set(newRef, event)`.
- **INV-D (opaque-id boundary):** unchanged — agent never supplies `override_id`; split product id is server-minted.

## DESIGN SPEC (Option A — fully specified; the Builder makes NO design choices)

### S1 — async seam contract (both stores implement identically)
```
async runTransaction(fn)            // returns fn's resolved value; atomic
async eventsFor(overrideId) -> event[]   // returns plain JS event objects
append(event) -> void               // stages a new-event write for this txn
```
`OverrideEngine` transaction methods become `async` and `await store.runTransaction(async () => { const existing = await store.eventsFor(oid); ... store.append(ne); return ne; })`. In-place status mutations on objects returned by `eventsFor` (`currentActive.status = "superseded"`, `_transition`) are RETAINED — the store captures them on flush (S2).

### S2 — Firestore-backed `CrmOverridesStore` (`src/tools/crm-overrides-store.js`)
- Doc id scheme: event docId = `event.event_id` (= `${override_id}#${seq}`), in collection `crm_overrides`. `seq = existing.length + 1` (computed by the engine; consistent within the txn read).
- `runTransaction(fn)`: `return this._collectionRef.firestore.runTransaction(async (txn) => { this._txn = txn; this._readSnap = new Map(); this._appends = []; const result = await fn(); await this._flush(); this._txn = null; return result; });`
- `eventsFor(overrideId)`: `const q = await this._txn.get(this._collectionRef.where("override_id","==",overrideId));` map each doc → plain event object; record `{ref: doc.ref, obj, status0: obj.status}` in `_readSnap` (keyed by `obj` identity). Return the objects (engine mutates them in place).
- `append(event)`: `this._appends.push(event);` (no write yet).
- `_flush()`: for each `_readSnap` entry where `obj.status !== status0` → `this._txn.update(ref, {status: obj.status})` (STATUS FIELD ONLY). For each appended event → `this._txn.set(this._collectionRef.doc(event.event_id), event)`. NEVER call `.delete`.
- Constructor + `ENFORCED_COLLECTION` + `makeCrmOverridesStore(db)` retained verbatim (INV-A).

### S3 — `InMemoryFakeStore` (`src/override-engine.js`) async-ified
`eventsFor` → `async`; `runTransaction(fn)` → `async` (`return await fn()`); `append` unchanged. Backing `_events` array unchanged. (Keeps the conformance/unit path dependency-free per §3 clean-env.)

### S4 — test double `FakeFirestore` (specified; `src/__tests__/helpers/fake-firestore.js`, NEW)
In-process, dependency-free. Backing = a shared `Map<docId,data>` passed in (so a second store instance over the same Map proves persist-across-restart).
- `collection(name)` → records `name` on a `_lastCollection` spy; returns `CollectionRef` with `.where(f,op,v)` → `QueryRef{f,op,v}`, `.doc(id)` → `DocRef{id}`, `.firestore` back-ref.
- `runTransaction(async fn)` → build `txn` with: `get(queryOrRef)` (query → `{docs:[{id,ref:{id},data:()=>...}]}` filtered from the Map by `f==v`; docRef → `{exists,data}`); `set(ref,data)` and `update(ref,partial)` stage into a pending buffer; `delete` → **throws `"append-only violation: delete called"`** (INV-C guard). Commit buffer to the Map on fn resolve; discard on throw (atomicity).

### S5 — handler awaits (`record/confirm/retract-override.js`)
`event = await engine.recordOverride(args)` (and merge/split/confirm/retract). `server.js` already `await handler(...)` — no server change.

### S6 — conformance re-projection (`conformance.test.js`, `enforced-tools.test.js`)
Every `e.recordOverride(...)` / `.confirm` / `.retract` call → `await`. Every `assert.throws(() => e.recordOverride(x), P)` → `await assert.rejects(async () => { await e.recordOverride(x); }, P)`. Test function bodies → `async`. Vectors + assertions otherwise UNCHANGED (INV-B).

---

## TACTICAL BACKLOG (TDD; each: PRECONDITIONS · ACTIONS · GATE · STOP-ON-FAIL)

**T1 — RED: Firestore-store behaviour test.**
- PRE: clean clone at §6-remediated HEAD; `npm ci` exit 0.
- ACTIONS: author `src/__tests__/helpers/fake-firestore.js` (S4) and `src/__tests__/firestore-store.test.js` asserting against a Firestore-backed store: (a) `db.collection` called with exactly `"crm_overrides"` (spy) and no other; (b) `eventsFor` issues `txn.get` on a `where("override_id","==",…)` query; (c) `append` results in `txn.set` at docId `${override_id}#${seq}`; (d) a status mutation flushes as `txn.update(ref,{status})` with ONLY the status key; (e) persist-across-restart: instance #2 over the same backing Map returns instance #1's events; (f) INV-C: `txn.delete` is never invoked and no content field is ever in an `update` payload.
- GATE (measured): `node --test src/__tests__/firestore-store.test.js` → tests FAIL, and the failure messages are the S2 assertions (collection spy / txn.get / txn.set / txn.update-status-only), NOT import/collection errors. (RT-GATE: assert the specific failure.)
- STOP-ON-FAIL: if red is an import/scaffold error, fix the harness and re-run before proceeding.

**T2 — GREEN: implement Firestore-backed `CrmOverridesStore` (S2).**
- PRE: T1 red captured.
- ACTIONS: implement S2 in `src/tools/crm-overrides-store.js`, preserving `ENFORCED_COLLECTION`, constructor binding, `makeCrmOverridesStore` (INV-A).
- GATE: `node --test src/__tests__/firestore-store.test.js` → ALL PASS (green), measured verbatim.
- STOP-ON-FAIL: STOP + `result` BLOCKED; do not touch the engine.

**T3 — conformance/enforced tests → async (S6), engine still sync.**
- PRE: T2 green.
- ACTIONS: apply S6 await/`assert.rejects` re-projection to `conformance.test.js` + `enforced-tools.test.js`. No vector/assertion content change.
- GATE: `node --test src/__tests__/*.test.js` → 74/74 conformance+enforced STILL PASS (await-of-sync is harmless) + firestore-store green. Measured counts.
- STOP-ON-FAIL: any conformance count drop from 74 → STOP (a re-projection error changed behaviour).

**T4 — engine async re-projection (S1, S3).**
- PRE: T3 green.
- ACTIONS: make `recordOverride`/`recordIdentityMerge`/`recordIdentitySplit`/`confirm`/`retract` `async` with `await store.runTransaction(async () => { … await store.eventsFor(oid) … })`; async-ify `InMemoryFakeStore`. Pure functions UNCHANGED (INV-B).
- GATE: `node --test src/__tests__/*.test.js` → full suite (74 + firestore-store) ALL PASS.
- STOP-ON-FAIL: STOP + BLOCKED.

**T5 — handler awaits (S5).**
- PRE: T4 green.
- ACTIONS: `await engine.<method>(args)` in the three handlers.
- GATE: `node --test src/__tests__/*.test.js` full green; if `enforced-tools.test.js` drives handlers, its handler-path assertions pass.
- STOP-ON-FAIL: STOP + BLOCKED.

**T6 — HARDEN: decision-logic parity + append-only + hardwire (structural, RT-GATE-1 anchored).**
- PRE: T5 green.
- ACTIONS: (i) parity — a test asserts engine output for the `conformance_vectors.json` (`d89f54c9`) inputs is byte-identical to the vector expectations (INV-B proof). (ii) append-only structural gate over `src/tools/crm-overrides-store.js`: **strip `/* */` and `//` comments first**, then assert the stripped source contains no `.delete(` call and no `txn.update(` whose payload object literal contains a key other than `status` (anchor on the `update(` call construct, not a bare `update` substring — RT-GATE-1). (iii) `npm audit --package-lock-only` → 0 critical / 0 high (§6 remediation present on the branch).
- GATE: parity test PASS; append-only structural gate PASS on comment-stripped source; audit 0 crit/0 high. All measured.
- STOP-ON-FAIL: STOP + BLOCKED with the exact failing assertion.

**T7 — result roll-up + tag readiness.**
- PRE: T1–T6 all PASS.
- ACTIONS: write `result-EPICC-01-*.md` (env, per-task red/green evidence verbatim, gate verdicts, explicit PASS line, final `node --test` count); push to the branch under `epic-c-results/`. Report final HEAD for Director re-tag `v2.2.0-zapphire1`.
- GATE: `result` present on the branch, blob-SHA round-trip (Foreman QA).
- STOP-ON-FAIL: n/a (terminal).

## Clean-env / boundary notes
- All gates run against the **`FakeFirestore` double** — no live creds, no emulator, no `/mnt/skills` (§3 clean-env). The **live** firebase-admin proof against `client-001` `crm_overrides` is OUT OF BUILDER SCOPE (RB-1) — it is the Director-at-terminal in-vivo persist-across-restart proof post-deploy.
- MEP-3: the encoded gate command `node --test src/__tests__/*.test.js` and `npm ci`/`npm test`/`npm audit --package-lock-only` were run by the Foreman this session with output shape verified (74/74; audit 0 crit/0 high).

## Foreman QA obligations (post-return)
- QA each `result-NNN` against GitHub blob-SHA round-trip, not the transcript.
- Re-run the full suite count from the returned HEAD before declaring Epic-C green.
- INV-18 impartial AAR (non-authoring instance) after Epic-C lands (feeds BLD-582 / the deferred Epic-B AAR).

## Residual-underspecification list
**EMPTY.** Every open question is specified above or is an explicit named-closure gate: the store async contract (S1), Firestore doc-id + flush semantics (S2), the `FakeFirestore` double interface (S4), the async test re-projection rule (S6), the append-only structural-gate anchoring (T6-ii, RT-GATE-1), and the branch base (§6-remediated HEAD) are all specified. The live-Firestore credentialed proof is a named Director-at-terminal gate (RB-1), not an unenumerated assumption. The final tag `v2.2.0-zapphire1` is a named Director-at-terminal action (no MCP tag creation).

*Foreman-authored 2026-07-04, grounded in fork `07fc7673` reads + Builder contract `8b4d6a42`. SEPARATED §13. Canonical copy in zapphireIaC governance (blob 1cf14eac). Awaiting dispatch-lock PASS + Director dispatch.*

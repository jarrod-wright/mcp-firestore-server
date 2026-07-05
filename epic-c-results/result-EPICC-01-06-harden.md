# result-EPICC-01-06 — T6: HARDEN — decision-logic parity + append-only + audit

**Task:** T6 — (i) decision-logic parity vs `conformance_vectors.json` (blob `d89f54c9`);
(ii) append-only structural gate over `src/tools/crm-overrides-store.js` (RT-GATE-1
comment-strip + `update(`-construct anchor, status-only); (iii) `npm audit
--package-lock-only` → 0 critical / 0 high.

## Environment
- Branch `epic-b-enforced-overrides`, parent commit `3d3a3fe` (T4′ green, session record
  appended).

## (i) Parity — decision-logic byte-identity vs the pinned oracle vectors
No new test authored for this. `src/__tests__/conformance.test.js` (async-reprojected in
T3, unchanged since) **already is** this proof: it blob-pins `conformance_vectors.json`
(`vectors file matches the pinned oracle blob` — asserts the file's git-blob SHA1 equals
the pinned `d89f54c9280fce1edddb73f8835f5e0664e1bf32`), then replays every vector `v01`-
`v12` through the live `OverrideEngine` and asserts `override_id`, `status`,
`schema_fields`, `value`, and `minted_entity_id` are byte-identical to each vector's
`expect` block. Authoring a second, parallel parity test here would violate RT-GATE-2
("no synthetic pre-check that merely re-proves what the real RED→GREEN suite already
exercises") — the existing conformance suite (measured green in every gate this session,
including T4′'s) is the parity gate. INV-B (pure decision-logic byte-parity) is intact:
no function in `authorityTier`, `computeOverrideId`, `contentFingerprint`,
`validateOverride`, `mintEntityId`, the AUTO/GATED taxonomy, or `PERMITTED_TRANSITIONS`
was touched by T4′'s async re-projection (verified by re-reading the diff — only
`async`/`await` keywords and the store-seam call sites changed).

## (ii) Append-only structural gate (NEW: `src/__tests__/append-only-gate.test.js`)
RT-GATE-1-compliant: strips `/* */` and `//` comments from
`src/tools/crm-overrides-store.js` FIRST (its own header comment contains the literal
strings `.delete` and `txn.update(ref, {status})` as prose describing the invariant — a
bare-substring grep would misfire on the comment describing the rule), then anchors on
the actual call construct:
1. `/\.delete\s*\(/` must not match anywhere in the stripped source.
2. Every `/\.update\s*\(\s*[^,]+,\s*\{([^}]*)\}\s*\)/` match's payload object-literal keys
   must be exactly `["status"]`.

**Anchoring proof (not vacuous) — measured against deliberately-mutated copies of the
source, run ad hoc (not committed):**
- Injecting `await this._txn.delete(ref);` before the `.set(` call → gate's `.delete(`
  regex matches `true` on the comment-stripped mutated source (would fail the gate).
- Injecting a `value` key into the update payload (`{ status: obj.status, value:
  obj.value }`) → extracted keys become `["status","value"]` (would fail the
  `deepEqual(..., ["status"])` assertion).

Both confirm the gate is a real anchored check, not a tautology.

**Command run:**
```
node --test src/__tests__/append-only-gate.test.js
```

**Output (verbatim, PASS on the real, unmutated source):**
```
✔ T6(ii): no .delete( call construct in crm-overrides-store.js (comments stripped) (1.245198ms)
✔ T6(ii): every .update( call payload carries the status key only (comments stripped) (0.987666ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 77.54177
```

## (iii) `npm audit --package-lock-only`
```json
{
  "info": 0,
  "low": 0,
  "moderate": 8,
  "high": 0,
  "critical": 0,
  "total": 8
}
```
0 critical / 0 high — gate satisfied (unchanged from bring-up; no dependency changes this
task).

## Full-suite regression check — measured (`node --test src/__tests__/*.test.js`)
```
ℹ tests 82
ℹ suites 7
ℹ pass 82
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 886.122089
```
82 = 80 (T4′ green) + 2 new append-only structural tests. No regression.

## Verdict
**PASS.** Proceeding to T7 (roll-up + handback).

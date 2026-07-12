# FOREMAN FIX — resolve_timestamp env-driven timezone (supersedes HANDBACK final SHA)

**Author:** ZAPPHIRE Foreman (RS-1, `oren-rs1-2026-07-11`), Operating Model A (COLLAPSED, Director-authorised). **Governing:** BLD-652.

This is a post-QA Foreman amendment to the Builder's `task-MCP-MERGE` return. It does **not** re-open the Builder's work — all Builder gates G0..G5 stand.

## What changed & why
The Builder's `resolve_timestamp` hardcoded `America/New_York`. Correct for Oren, but this MCP is the fleet reference artefact — a client in another timezone would need a different build. Fix: timezone resolved at call-time from `HERMES_TIMEZONE` (the hermes ecosystem's per-client tz knob, mirrors `hermes_time` precedence, ledger L-120), defaulting to `America/New_York`. Deliberately does **not** honour a bare OS `TZ` (Etc/UTC on fleet hosts would silently reintroduce the UTC→ET drift this tool fixes). Invalid `HERMES_TIMEZONE` fails safe to the default.

## Method (TDD + red/blue, INV-07)
- **RED:** added an env-override test → failed as genuine `AssertionError` (`Europe/London` expected, ET returned) against the hardcoded impl.
- **GREEN:** parameterised `resolveTimezone()` (stdlib `Intl` only, no deps) + updated the tool description.
- **Reseal:** description change → integrity hash regenerated via `scripts/regen-integrity-hash.mjs` only (never hand-computed): `46e43ed8… → fa49019c894eb2c65325d380988092f6f28734dc36f7b7eda2caa3e656367cd4`. Idempotent.
- **Red/blue (measured):** `Europe/London`→+01:00 (BST), `Asia/Tokyo`→+09:00, explicit `UTC`→+00:00 honoured; `""`, whitespace, invalid, and injection-shaped (`"; rm -rf /"`) all fail safe to ET (string only flows into `Intl`, no shell/eval surface); DST-aware.
- **Re-green from pushed HEAD:** base `npm test` 82/82, merge tests 3/3 — **85 green, 0 fail.**

## Files (3, verbatim-verified)
- `src/tools/resolve-timestamp.js` — blob `4c94f28f`
- `tests/merge/test_resolve_timestamp.js` — blob `a395590c`
- `src/integrity.js` — blob `38d49217` (resealed hash + provenance comment)

## Tag target (supersedes HANDBACK)
**New code-final commit = `0b247a2f77db4d5c8da81c67fd4c750a2f537989`** (was `3d93a34f`). The Director's final version tag must target `0b247a2f`, not the Builder's pre-fix `3d93a34f`. A fresh tarball must be rebuilt from `0b247a2f` for the RB-1 deploy track.

`index.js` registration unchanged (still the single `resolve_timestamp` entry). Override + projection suites unchanged and green. No host action taken.

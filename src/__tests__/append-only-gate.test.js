/**
 * BLD-562 Epic C T6(ii) -- append-only structural gate over crm-overrides-store.js (INV-C).
 *
 * RT-GATE-1: strip comments first, then anchor on the actual construct (a call like
 * `update(`), never a bare substring. The source's own header comment contains the literal
 * substrings ".delete" and "txn.update(ref, {status})" as documentation -- a bare-substring
 * grep would misfire on prose describing the invariant it's meant to prove. Stripping
 * comments first removes that false-positive/false-negative surface entirely.
 *
 * Asserts: (1) no `.delete(` call construct anywhere in the comment-stripped source; (2)
 * every `.update(` call's object-literal payload carries the `status` key and nothing else.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(HERE, "..", "tools", "crm-overrides-store.js");

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const SOURCE = readFileSync(STORE_PATH, "utf8");
const STRIPPED = stripComments(SOURCE);

test("T6(ii): no .delete( call construct in crm-overrides-store.js (comments stripped)", () => {
  assert.equal(
    /\.delete\s*\(/.test(STRIPPED),
    false,
    "found a .delete( call construct in comment-stripped source -- append-only (INV-C) violation",
  );
});

test("T6(ii): every .update( call payload carries the status key only (comments stripped)", () => {
  const updateCalls = [...STRIPPED.matchAll(/\.update\s*\(\s*[^,]+,\s*\{([^}]*)\}\s*\)/g)];
  assert.ok(updateCalls.length >= 1, "expected at least one .update( call construct to inspect");
  for (const m of updateCalls) {
    const keys = [...m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((k) => k[1]);
    assert.deepEqual(
      keys,
      ["status"],
      `update( payload carried a key other than "status": ${JSON.stringify(keys)}`,
    );
  }
});

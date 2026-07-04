/**
 * BLD-560 Epic B - Task B5 -- regenerate KNOWN_GOOD_TOOL_HASH from source.
 * The hash is NEVER hand-typed. This imports the live tool definitions (post-fork
 * inventory) and prints the SHA256 over sorted (name+description), exactly as
 * computeToolDescriptionHash does. Run: node scripts/regen-integrity-hash.mjs
 */
import { getToolDefinitions } from "../src/tools/index.js";
import { computeToolDescriptionHash, KNOWN_GOOD_TOOL_HASH } from "../src/integrity.js";

const defs = getToolDefinitions(["production"], "production");
console.error("tool count:", defs.length);
console.error("inventory :", defs.map(d => d.name).sort().join(", "));
console.error("OLD hash  :", KNOWN_GOOD_TOOL_HASH);
console.log(computeToolDescriptionHash(defs));

// task-MCP-MERGE T-M4 — resolve_timestamp tool (12th tool).
//
// Asserts against the tool registry (src/tools/index.js) rather than importing
// src/tools/resolve-timestamp.js directly, so a pre-implementation run fails with a
// genuine AssertionError (tool absent from registry) rather than a module-not-found
// import error.

import test from "node:test";
import assert from "node:assert/strict";
import { getToolDefinitions, getHandler } from "../../src/tools/index.js";

test("resolve_timestamp tool exists and returns ISO time in server tz (T-M4)", async () => {
  const definitions = getToolDefinitions(["emulator", "production"], "emulator");
  const def = definitions.find((d) => d.name === "resolve_timestamp");
  assert.ok(def, "expected a resolve_timestamp tool definition to be registered");

  const handler = getHandler("resolve_timestamp");
  assert.ok(handler, "expected a resolve_timestamp handler to be registered");

  const result = await handler({}, null);

  assert.equal(
    result.timezone,
    "America/New_York",
    "expected the server's configured timezone (America/New_York, L-122/L-140)",
  );
  assert.match(
    result.timestamp,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(-0[4-5]:00)$/,
    `expected an ISO 8601 timestamp with an America/New_York UTC offset, got ${result.timestamp}`,
  );
});

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
    "expected the default configured timezone (America/New_York, L-122/L-140)",
  );
  assert.match(
    result.timestamp,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(-0[4-5]:00)$/,
    `expected an ISO 8601 timestamp with an America/New_York UTC offset, got ${result.timestamp}`,
  );
});

// Foreman fleet-forward fix (RS-1, Director-authorised): tz is env-driven via
// HERMES_TIMEZONE (the hermes per-client knob), defaulting to America/New_York.
// Deliberately does NOT honour a bare OS `TZ` (Etc/UTC on fleet hosts would silently
// reintroduce the UTC->ET drift this tool fixes). Invalid tz fails safe to ET.
test("resolve_timestamp honours HERMES_TIMEZONE and fails safe (fleet-forward)", async () => {
  const handler = getHandler("resolve_timestamp");
  const orig = process.env.HERMES_TIMEZONE;
  try {
    process.env.HERMES_TIMEZONE = "Europe/London";
    let r = await handler({}, null);
    assert.equal(r.timezone, "Europe/London", "must honour HERMES_TIMEZONE override");
    assert.match(r.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\+0[01]:00)$/,
      `expected a London offset, got ${r.timestamp}`);

    process.env.HERMES_TIMEZONE = "Asia/Tokyo";
    r = await handler({}, null);
    assert.equal(r.timezone, "Asia/Tokyo");
    assert.match(r.timestamp, /\+09:00$/, `expected a Tokyo offset, got ${r.timestamp}`);

    process.env.HERMES_TIMEZONE = "Not/AZone";
    r = await handler({}, null);
    assert.equal(r.timezone, "America/New_York", "an invalid tz must fail safe to ET default");

    delete process.env.HERMES_TIMEZONE;
    r = await handler({}, null);
    assert.equal(r.timezone, "America/New_York", "unset -> ET default");
  } finally {
    if (orig === undefined) delete process.env.HERMES_TIMEZONE;
    else process.env.HERMES_TIMEZONE = orig;
  }
});

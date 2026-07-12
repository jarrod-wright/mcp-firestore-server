// task-MCP-MERGE T-M4 -- resolve_timestamp: authoritative current time in the
// agent's configured timezone, so the agent never has to do UTC->ET arithmetic
// in-context (L-21/L-122).
//
// Timezone is env-driven (RS-1 fleet-forward fix): resolved at call time from
// HERMES_TIMEZONE -- the hermes ecosystem's canonical per-client tz knob (mirrors
// hermes_time precedence, ledger L-120) -- defaulting to America/New_York
// (Oren / client-001, L-122/L-140, VERIFIED). It deliberately does NOT fall back
// to the OS `TZ` env: on the fleet's Cloud Run / Hetzner hosts `TZ` is typically
// Etc/UTC, which would silently reintroduce the very UTC->ET drift this tool exists
// to fix. An invalid HERMES_TIMEZONE fails safe to the default rather than throwing.
// stdlib Intl only, no external deps.

const DEFAULT_TIMEZONE = "America/New_York";

function resolveTimezone() {
  const tz = process.env.HERMES_TIMEZONE;
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    // Intl throws RangeError on an unknown timezone -> validate before trusting.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export const definition = {
  name: "resolve_timestamp",
  description:
    "Returns the current date/time as an ISO 8601 timestamp (with UTC offset) in the agent's configured timezone, set via the HERMES_TIMEZONE environment variable and defaulting to America/New_York. Use this instead of computing UTC-to-ET conversions manually.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

function toZonedIso(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type).value;
  const datePart = `${get("year")}-${get("month")}-${get("day")}`;
  const timePart = `${get("hour")}:${get("minute")}:${get("second")}`;

  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName").value;
  const offset = offsetPart === "GMT" ? "+00:00" : offsetPart.replace("GMT", "");

  return `${datePart}T${timePart}${offset}`;
}

export async function handler() {
  const timeZone = resolveTimezone();
  const now = new Date();
  return {
    timestamp: toZonedIso(now, timeZone),
    timezone: timeZone,
  };
}

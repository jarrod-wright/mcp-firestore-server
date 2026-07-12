// task-MCP-MERGE T-M4 -- resolve_timestamp: authoritative current time in the
// server's configured timezone, so the agent never has to do UTC->ET arithmetic
// in-context (L-21/L-122). Timezone is fixed at America/New_York (L-122/L-140,
// VERIFIED) -- stdlib Intl only, no external deps.

const SERVER_TIMEZONE = "America/New_York";

export const definition = {
  name: "resolve_timestamp",
  description:
    "Returns the current date/time as an ISO 8601 timestamp in the server's configured timezone (America/New_York), including the UTC offset. Use this instead of computing UTC-to-ET conversions manually.",
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
  const now = new Date();
  return {
    timestamp: toZonedIso(now, SERVER_TIMEZONE),
    timezone: SERVER_TIMEZONE,
  };
}

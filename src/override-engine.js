/**
 * BLD-560 Epic B -- crm_overrides enforced write ENGINE (JS conformant projection).
 *
 * Byte-faithful projection of the Python oracle crm_override_write_tool_runtime.py
 * (blob e997e8f9). ADR-04: "Python = executable spec; JS = conformant projection".
 * Every behaviour here is pinned by conformance_vectors.json (blob d89f54c9), which was
 * emitted BY the Python oracle. Enforcement is STRUCTURAL (by construction): opaque-id
 * boundary, AUTO/GATED tiering, GATED pending->confirm->active lifecycle, permitted-
 * transition guard, and server-minted split ids the agent can neither supply nor predict.
 *
 * The engine holds no state; all persistence is via an injected `store` seam
 * (eventsFor / append / runTransaction) -- the same seam pattern as the oracle. The MCP
 * handlers back it with a Firestore-collection store hardwired to 'crm_overrides'; tests
 * back it with an in-memory fake. Node >=18 (crypto is stdlib). No external deps.
 */
import { createHash } from "node:crypto";

export class WriteToolError extends Error {}

// ---- taxonomy + authority tiers (ADR-02, verbatim parity with the oracle) ----
export const TAXONOMY_AUTO = new Set([
  "identity.rename", "claim.correct", "claim.retract",
  "claim.annotate", "thread.status", "confidence.pin",
]);
export const TAXONOMY_GATED = new Set(["identity.merge", "identity.split", "record.suppress"]);
export const ALL_TYPES = new Set([...TAXONOMY_AUTO, ...TAXONOMY_GATED]);

// permitted status transitions (append-only lifecycle; content never mutated)
const PERMITTED_TRANSITIONS = new Set([
  "pending>active", "pending>retracted", "active>superseded", "active>retracted",
]);

const REQUIRED_FIELDS = [
  "override_id", "entity_id", "override_type", "field_path", "value", "status",
  "authority", "evidence_grade", "source", "stated_at", "recorded_at",
  "supersedes", "provenance", "confidence_effect",
];
const STATUS_ENUM = new Set(["active", "pending", "superseded", "retracted"]);
const SOURCE_ENUM = new Set(["client-directed", "operator"]);
const CONTENT_FIELDS = ["override_id", "entity_id", "override_type", "field_path",
  "value", "stated_at", "source", "provenance"];

// The tenant mint salt. For the OFFLINE oracle + conformance vectors it defaults to the
// committed synthetic test salt; the RUNTIME (Cloud Run / Hermes) injects the real per-
// tenant salt via the environment and NEVER commits it. Fail-closed if unset at runtime.
export const DEFAULT_TENANT_MINT_SALT = "test-mint-salt-epicb";
const MINT_SEP = "\x1f";

export function mintEntityId(sourceEntityId, partitionRule, salt = DEFAULT_TENANT_MINT_SALT) {
  if (typeof sourceEntityId !== "string" || sourceEntityId === "")
    throw new WriteToolError("source_entity_id must be a non-empty opaque string");
  if (typeof partitionRule !== "string" || partitionRule === "")
    throw new WriteToolError("partition_rule must be a non-empty string");
  if (typeof salt !== "string" || salt === "")
    throw new WriteToolError("tenant mint salt missing (fail-closed)");
  const digest = createHash("sha256")
    .update(sourceEntityId + MINT_SEP + partitionRule + MINT_SEP + salt, "utf8")
    .digest("hex");
  return "ent-" + digest.slice(0, 24);
}

export function authorityTier(overrideType) {
  if (TAXONOMY_AUTO.has(overrideType)) return "AUTO";
  if (TAXONOMY_GATED.has(overrideType)) return "GATED";
  throw new WriteToolError(`unknown override_type: ${overrideType}`);
}

export function computeOverrideId(entityId, overrideType, fieldPath) {
  if (fieldPath === null || fieldPath === undefined) return `${overrideType}:${entityId}`;
  return `${entityId}:${overrideType}:${fieldPath}`;
}

// Deterministic canonical JSON (sorted keys, recursive) -- matches Python json.dumps(sort_keys=True).
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

export function contentFingerprint(event) {
  const payload = {};
  for (const k of CONTENT_FIELDS) payload[k] = event[k] === undefined ? null : event[k];
  return createHash("sha256").update(canonical(payload), "utf8").digest("hex");
}

export function validateOverride(o, allowedTypes) {
  const errors = [];
  const allowed = allowedTypes instanceof Set ? allowedTypes : new Set(allowedTypes || []);
  for (const f of REQUIRED_FIELDS) if (!(f in o)) errors.push(`missing required field: ${f}`);
  if (errors.length) return [false, errors];
  if (!allowed.has(o.override_type))
    errors.push(`override_type '${o.override_type}' not in taxonomy`);
  const fp = o.field_path;
  if (fp !== null && (typeof fp !== "string" || fp === ""))
    errors.push("field_path must be a non-empty dotted string or null");
  const expected = computeOverrideId(o.entity_id, o.override_type, fp);
  if (o.override_id !== expected)
    errors.push(`override_id '${o.override_id}' != deterministic key '${expected}'`);
  if (!STATUS_ENUM.has(o.status)) errors.push(`status '${o.status}' invalid`);
  if (!SOURCE_ENUM.has(o.source)) errors.push(`source '${o.source}' invalid`);
  if (o.authority !== "human-verified") errors.push("authority must be const 'human-verified'");
  if (o.evidence_grade !== "authoritative") errors.push("evidence_grade must be const 'authoritative'");
  if (o.confidence_effect !== "human-verified") errors.push("confidence_effect must be const 'human-verified'");
  if (typeof o.entity_id !== "string" || o.entity_id === "")
    errors.push("entity_id must be a non-empty opaque string");
  if (o.supersedes !== null && typeof o.supersedes !== "string")
    errors.push("supersedes must be an event id string or null");
  if (o.provenance === null || typeof o.provenance !== "object"
      || !("directed_by" in o.provenance) || !("session_ref" in o.provenance))
    errors.push("provenance must be an object with directed_by + session_ref");
  return [errors.length === 0, errors];
}

export class InMemoryFakeStore {
  constructor() { this._events = []; }
  async eventsFor(overrideId) { return this._events.filter(e => e.override_id === overrideId); }
  append(event) { this._events.push(event); }
  async runTransaction(fn) { return await fn(); }
}

export class OverrideEngine {
  constructor(store, salt = DEFAULT_TENANT_MINT_SALT) {
    this._store = store;
    this._salt = salt;
  }

  async recordOverride({ entity_id, override_type, field_path, value, stated_at, recorded_at,
                          provenance, agent_supplied_override_id = null }) {
    // RB-2 opaque-id boundary -- checked FIRST, before any tier/taxonomy work.
    if (agent_supplied_override_id !== null && agent_supplied_override_id !== undefined)
      throw new WriteToolError("agent must not supply override_id; the tool computes it");
    const tier = authorityTier(override_type);
    const oid = computeOverrideId(entity_id, override_type, field_path ?? null);
    const status = tier === "AUTO" ? "active" : "pending";
    const override = {
      override_id: oid, entity_id, override_type, field_path: field_path ?? null,
      value, status, authority: "human-verified", evidence_grade: "authoritative",
      source: "client-directed", stated_at, recorded_at, supersedes: null,
      provenance, confidence_effect: "human-verified",
    };
    const [ok, errors] = validateOverride(override, ALL_TYPES);
    if (!ok) throw new WriteToolError(errors.join("; "));
    const store = this._store;
    return await store.runTransaction(async () => {
      const existing = await store.eventsFor(oid);
      const currentActive = existing.find(e => e.status === "active") || null;
      if (tier === "AUTO" && currentActive !== null) {
        if (contentFingerprint(currentActive) === contentFingerprint(override)) return currentActive;
        const ne = { ...override };
        ne.event_id = `${oid}#${existing.length + 1}`;
        ne.supersedes = currentActive.event_id;
        currentActive.status = "superseded";
        store.append(ne);
        return ne;
      }
      const ne = { ...override };
      ne.event_id = `${oid}#${existing.length + 1}`;
      store.append(ne);
      return ne;
    });
  }

  async recordIdentityMerge({ canonical_entity_id, merged_entity_ids, stated_at, recorded_at, provenance }) {
    if (typeof canonical_entity_id !== "string" || canonical_entity_id === "")
      throw new WriteToolError("canonical_entity_id must be a non-empty opaque string");
    if (!Array.isArray(merged_entity_ids) || merged_entity_ids.length === 0
        || !merged_entity_ids.every(x => typeof x === "string" && x))
      throw new WriteToolError("merged_entity_ids must be a non-empty list of opaque id strings");
    return await this.recordOverride({
      entity_id: canonical_entity_id, override_type: "identity.merge", field_path: null,
      value: { canonical_entity_id, merged_entity_ids: [...merged_entity_ids] },
      stated_at, recorded_at, provenance,
    });
  }

  async recordIdentitySplit({ source_entity_id, partition_rule, stated_at, recorded_at, provenance,
                               agent_supplied_new_id = null }) {
    // reject-before-mint ordering (VUL-B5 / v07): the rejection precedes any mint work.
    if (agent_supplied_new_id !== null && agent_supplied_new_id !== undefined)
      throw new WriteToolError("agent must not supply a split-product entity id; the engine mints it");
    const minted = mintEntityId(source_entity_id, partition_rule, this._salt);
    return await this.recordOverride({
      entity_id: source_entity_id, override_type: "identity.split", field_path: null,
      value: { source_entity_id, partition_rule, minted_entity_id: minted },
      stated_at, recorded_at, provenance,
    });
  }

  async confirm(overrideId) {
    const store = this._store;
    return await store.runTransaction(async () => {
      const pend = (await store.eventsFor(overrideId)).find(e => e.status === "pending") || null;
      if (pend === null) throw new WriteToolError(`no pending override to confirm for ${overrideId}`);
      this._transition(pend, "active");
      return pend;
    });
  }

  async retract(overrideId) {
    const store = this._store;
    return await store.runTransaction(async () => {
      const events = await store.eventsFor(overrideId);
      const ev = events.find(e => e.status === "active") || events.find(e => e.status === "pending") || null;
      if (ev === null) throw new WriteToolError(`nothing to retract for ${overrideId}`);
      this._transition(ev, "retracted");
      return ev;
    });
  }

  _transition(event, newStatus) {
    const key = `${event.status}>${newStatus}`;
    if (!PERMITTED_TRANSITIONS.has(key))
      throw new WriteToolError(`illegal status transition ${event.status} -> ${newStatus}`);
    event.status = newStatus;
  }

  async effectiveValue(overrideId) {
    const act = (await this._store.eventsFor(overrideId)).find(e => e.status === "active") || null;
    return act !== null ? act.value : null;
  }

  eventsFor(overrideId) { return this._store.eventsFor(overrideId); }
}

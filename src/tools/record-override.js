import { OverrideEngine } from "../override-engine.js";
import { makeCrmOverridesStore } from "./crm-overrides-store.js";
import { resolveTenantMintSalt } from "./override-salt.js";

export const definition = {
  name: "record_override",
  description:
    "Record a client-directed crm_overrides override (field-level, identity.merge, or " +
    "identity.split). The collection is hardwired to crm_overrides; the tool computes the " +
    "opaque override_id (the agent must not supply it) and, for identity.split, mints the " +
    "product entity id server-side. AUTO types apply immediately (active); GATED types " +
    "stage as pending until client confirm-back.",
  inputSchema: {
    type: "object",
    properties: {
      override_type: { type: "string", description: "One of the 9 ADR-02 override types." },
      entity_id: { type: "string" },
      field_path: { type: ["string", "null"] },
      value: {},
      canonical_entity_id: { type: "string", description: "identity.merge only" },
      merged_entity_ids: { type: "array", items: { type: "string" }, description: "identity.merge only" },
      source_entity_id: { type: "string", description: "identity.split only" },
      partition_rule: { type: "string", description: "identity.split only" },
      stated_at: { type: "string" },
      recorded_at: { type: "string" },
      provenance: { type: "object" },
    },
    required: ["override_type", "stated_at", "recorded_at", "provenance"],
  },
};

export async function handler(args, db, storeFactory = makeCrmOverridesStore) {
  const store = storeFactory(db);
  const engine = new OverrideEngine(store, resolveTenantMintSalt());
  const t = args.override_type;
  let event;
  if (t === "identity.merge") {
    event = engine.recordIdentityMerge(args);
  } else if (t === "identity.split") {
    event = engine.recordIdentitySplit(args);
  } else {
    event = engine.recordOverride(args);
  }
  return { collection: "crm_overrides", override_id: event.override_id,
           status: event.status, event_id: event.event_id };
}

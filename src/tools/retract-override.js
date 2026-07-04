import { OverrideEngine } from "../override-engine.js";
import { makeCrmOverridesStore } from "./crm-overrides-store.js";
import { resolveTenantMintSalt } from "./override-salt.js";

export const definition = {
  name: "retract_override",
  description:
    "Retract an active or pending crm_overrides override (-> retracted). Collection " +
    "hardwired to crm_overrides.",
  inputSchema: {
    type: "object",
    properties: { override_id: { type: "string" } },
    required: ["override_id"],
  },
};

export async function handler(args, db, storeFactory = makeCrmOverridesStore) {
  const engine = new OverrideEngine(storeFactory(db), resolveTenantMintSalt());
  const event = engine.retract(args.override_id);
  return { collection: "crm_overrides", override_id: event.override_id, status: event.status };
}

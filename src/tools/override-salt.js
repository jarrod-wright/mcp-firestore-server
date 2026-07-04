/**
 * BLD-560 Epic B -- tenant mint salt resolution (ENV-R-02, fail-closed).
 * The real per-tenant salt is injected via TENANT_MINT_SALT at deploy time and never
 * committed. If unset, mintEntityId throws (fail-closed) -- a split can never mint under
 * an empty salt.
 */
export function resolveTenantMintSalt() {
  return process.env.TENANT_MINT_SALT;
}

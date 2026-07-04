/**
 * BLD-560 Epic B - Task B4 -- tenant-binding assertion (cross-tenant containment).
 * A per-client Hermes agent must bind ONLY to its own tenant GCP project. It must NEVER
 * bind to the ZAPPHIRE control-plane vault project, and (when EXPECTED_TENANT_PROJECT is
 * injected at deploy time) must match it exactly. Fail-closed startup gate: a misconfigured
 * deploy aborts rather than operating cross-tenant. Pure logic -- no SDK/firebase imports,
 * so it is unit-testable offline.
 */
export const FORBIDDEN_PROJECTS = ["zapphire-vault"];

export function assertTenantBinding(projectId, expected = process.env.EXPECTED_TENANT_PROJECT) {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("[TENANT] No project id resolved; cannot assert tenant binding (fail-closed).");
  }
  if (FORBIDDEN_PROJECTS.includes(projectId)) {
    throw new Error(
      "[TENANT] Refusing to bind to a forbidden control-plane project. " +
      "A client agent must never bind the ZAPPHIRE vault. Halting.");
  }
  if (expected && projectId !== expected) {
    throw new Error(
      "[TENANT] Resolved project does not match the expected tenant binding. " +
      "Halting to prevent cross-tenant operation.");
  }
  console.error("[TENANT] Tenant binding verified OK");
  return true;
}

/**
 * BLD-560 Epic B - Task B4 -- tenant-binding assertion (cross-tenant containment).
 * A client agent must never bind the control-plane vault, and must match its expected
 * tenant when one is injected. Pure-function test (no server start, no firebase-admin).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertTenantBinding } from "../tenant-binding.js";

test("refuses to bind the ZAPPHIRE vault (forbidden control-plane project)", () => {
  assert.throws(() => assertTenantBinding("zapphire-vault", undefined),
    (e) => /forbidden control-plane/.test(e.message));
});

test("refuses a project that does not match the expected tenant", () => {
  assert.throws(() => assertTenantBinding("zapphire-client-999", "zapphire-client-001"),
    (e) => /expected tenant binding/.test(e.message));
});

test("permits the expected tenant project", () => {
  assert.equal(assertTenantBinding("zapphire-client-001", "zapphire-client-001"), true);
});

test("permits a non-forbidden project when no expected tenant is injected", () => {
  assert.equal(assertTenantBinding("zapphire-client-001", undefined), true);
});

test("fail-closed on a missing/blank project id", () => {
  assert.throws(() => assertTenantBinding("", "zapphire-client-001"), (e) => /No project id/.test(e.message));
  assert.throws(() => assertTenantBinding(undefined, undefined), (e) => /No project id/.test(e.message));
});

test("vault is forbidden even if (mis)set as the expected tenant", () => {
  assert.throws(() => assertTenantBinding("zapphire-vault", "zapphire-vault"),
    (e) => /forbidden control-plane/.test(e.message));
});

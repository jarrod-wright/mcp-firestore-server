/**
 * BLD-560 Epic B - Task B2 -- Invariant-5 extension acceptance (AC4 as code invariant).
 *
 * Proves the generic write tools (create_document / update_document) can NEVER write
 * crm_overrides or crm_records -- regardless of COLLECTION_WRITE_ALLOWLIST -- so the ONLY
 * path to those collections is the enforced override tools. Also closes the unrecognised-
 * tool fall-through for the enforced tools and blocks collection-arg smuggling.
 *
 * Runs under `node --test` (no external deps). Fixed reason string (ENV-R-02) preserved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceAllowlist, ENFORCED_WRITE_TOOLS } from '../allowlist.js';

function withWriteAllowlist(value, fn) {
  const prev = process.env.COLLECTION_WRITE_ALLOWLIST;
  process.env.COLLECTION_WRITE_ALLOWLIST = value;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.COLLECTION_WRITE_ALLOWLIST;
    else process.env.COLLECTION_WRITE_ALLOWLIST = prev;
  }
}

test('generic create_document CANNOT write crm_overrides even if allowlisted', () => {
  withWriteAllowlist('crm_overrides,hermes-staging', () => {
    const r = enforceAllowlist('create_document', { collection: 'crm_overrides' });
    assert.equal(r.permitted, false);
  });
});

test('generic update_document CANNOT write crm_records even if allowlisted', () => {
  withWriteAllowlist('crm_records,hermes-staging', () => {
    const r = enforceAllowlist('update_document', { collection: 'crm_records' });
    assert.equal(r.permitted, false);
  });
});

test('hard exclusion resists case + subpath smuggling for crm_overrides', () => {
  withWriteAllowlist('crm_overrides', () => {
    assert.equal(enforceAllowlist('create_document', { collection: 'CRM_Overrides' }).permitted, false);
    assert.equal(enforceAllowlist('create_document', { collection: 'crm_overrides/doc/x' }).permitted, false);
    assert.equal(enforceAllowlist('create_document', { collectionId: 'crm_records' }).permitted, false);
  });
});

test('knowledge and okg remain blocked (regression)', () => {
  withWriteAllowlist('knowledge,okg,hermes-staging', () => {
    assert.equal(enforceAllowlist('create_document', { collection: 'knowledge' }).permitted, false);
    assert.equal(enforceAllowlist('create_document', { collection: 'okg' }).permitted, false);
  });
});

test('a normal allowlisted collection is still permitted (no over-block)', () => {
  withWriteAllowlist('hermes-staging', () => {
    assert.equal(enforceAllowlist('create_document', { collection: 'hermes-staging' }).permitted, true);
  });
});

test('ENFORCED_WRITE_TOOLS is a positive registry of the three enforced tools', () => {
  assert.ok(ENFORCED_WRITE_TOOLS.has('record_override'));
  assert.ok(ENFORCED_WRITE_TOOLS.has('confirm_override'));
  assert.ok(ENFORCED_WRITE_TOOLS.has('retract_override'));
});

test('enforced tool with a smuggled collection arg is BLOCKED (no fall-through)', () => {
  withWriteAllowlist('hermes-staging', () => {
    // enforced tools hardwire their collection internally; a caller-supplied collection
    // must never be honoured as a generic-write bypass
    assert.equal(enforceAllowlist('record_override', { collection: 'hermes-staging' }).permitted, false);
    assert.equal(enforceAllowlist('confirm_override', { collection: 'crm_overrides' }).permitted, false);
  });
});

test('enforced tool with NO collection arg is permitted at allowlist layer (tool enforces internally)', () => {
  assert.equal(enforceAllowlist('record_override', { override_type: 'claim.correct' }).permitted, true);
});

import { coerceValue } from "./coerce-value.js";
import { HEAVY_COLLECTIONS, MAX_RESPONSE_BYTES } from "../constants.js";

/**
 * Valid Firestore where operators.
 */
export const WHERE_OPERATORS = [
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "array-contains",
  "in",
  "array-contains-any",
];

// ---------------------------------------------------------------------------
// Ph9 — embedding strip (defence-in-depth alongside projection)
// ---------------------------------------------------------------------------

/**
 * Strip the embedding vector from document data unless explicitly requested.
 * The 2048-dim vector is the single largest per-field payload contributor.
 *
 * @param {Object} data - Document data
 * @param {boolean} includeEmbedding - If truthy, retain the embedding
 * @returns {Object} data with or without embedding
 */
function stripHeavy(data, includeEmbedding) {
  if (!data || includeEmbedding) return data;
  const { embedding, ...rest } = data;
  return rest;
}

// ---------------------------------------------------------------------------
// Ph9 — Firestore .select() projection
// ---------------------------------------------------------------------------

/**
 * Apply Firestore field projection (.select) when a non-empty fields array is given.
 * Inclusion-list semantics: only the named fields are read and returned. Omitting heavy
 * fields (compiled_layers, verbatim_content) keeps list/scan payloads small.
 *
 * @param {FirebaseFirestore.Query} query
 * @param {string[]|undefined} fields
 * @returns {FirebaseFirestore.Query}
 */
export function applyProjection(query, fields) {
  if (Array.isArray(fields) && fields.length > 0) {
    query = query.select(...fields);
  }
  return query;
}

// ---------------------------------------------------------------------------
// BLD-501 — Structural enforcement: default projection on heavy collections
// ---------------------------------------------------------------------------

/**
 * Enforce metadata-only projection on heavy collections when fields is omitted.
 *
 * Returns { fields, projected, reason }:
 *   - fields:    the field list to pass to applyProjection
 *   - projected: true if a default was applied (caller omitted fields)
 *   - reason:    human-readable reason for the projection decision
 *
 * The caller CAN override by explicitly passing `fields` (including heavy fields).
 *
 * @param {string} collection - Collection path (may include subcollection segments)
 * @param {string[]|undefined} callerFields - Caller-supplied fields parameter
 * @returns {{ fields: string[]|undefined, projected: boolean, reason: string }}
 */
export function enforceProjection(collection, callerFields) {
  const baseName = collection.split("/").pop();
  const config = HEAVY_COLLECTIONS[baseName];

  if (!config) {
    return {
      fields: callerFields,
      projected: false,
      reason: "not_heavy_collection",
    };
  }

  if (Array.isArray(callerFields) && callerFields.length > 0) {
    return {
      fields: callerFields,
      projected: false,
      reason: "caller_specified_fields",
    };
  }

  return {
    fields: config.defaultFields,
    projected: true,
    reason: "default_heavy_collection",
  };
}

// ---------------------------------------------------------------------------
// BLD-501 — Byte-cap enforcement + _meta annotation
// ---------------------------------------------------------------------------

/**
 * Build the _meta annotation block for bounded responses.
 *
 * @param {Object} opts
 * @param {boolean} opts.projected - Was a default projection applied?
 * @param {string}  opts.reason - Why the projection was applied
 * @param {number}  opts.returned - Number of documents returned
 * @param {number}  opts.totalFetched - Number of documents fetched before cap
 * @param {boolean} opts.capped - Was the byte cap hit?
 * @param {string|null} opts.cursor - Pagination cursor (lastDocId)
 * @param {string[]} opts.widenWith - Fields the caller can add to widen results
 * @returns {Object}
 */
function buildMeta(opts) {
  return {
    projected: opts.projected,
    projection_reason: opts.reason,
    returned: opts.returned,
    more_available: opts.capped || opts.returned < opts.totalFetched,
    ...(opts.cursor && { cursor: opts.cursor }),
    ...(opts.widenWith &&
      opts.widenWith.length > 0 && { widen_with_fields: opts.widenWith }),
  };
}

/**
 * Enforce byte cap on a serialised response. If the payload exceeds
 * MAX_RESPONSE_BYTES, documents are trimmed from the end until it fits.
 *
 * @param {Object[]} docs - Array of document objects
 * @param {Object}   envelope - The full response envelope (without docs)
 * @returns {{ trimmedDocs: Object[], capped: boolean }}
 */
function enforceByteLimit(docs, envelope) {
  // The emitted response adds _meta, lastDocId, and (query_with_where) a query
  // string on top of { ...envelope, documents }. MAX_RESPONSE_BYTES (40000) sits
  // 10000 below the Hermes tool_output.max_bytes hard cap (50000); that 10 KB
  // margin absorbs those additions (all < 1 KB combined).
  let kept = docs;

  while (kept.length > 1) {
    const payload = JSON.stringify({ ...envelope, documents: kept });
    if (Buffer.byteLength(payload, "utf8") <= MAX_RESPONSE_BYTES) break;
    kept = kept.slice(0, -1);
  }

  // Always return at least one document when any exist, so the pagination cursor
  // advances and the caller is never dead-ended. A lone doc over the soft cap
  // still fits under the 50 KB hard cap via the margin.
  return { trimmedDocs: kept, capped: kept.length < docs.length };
}

// ---------------------------------------------------------------------------
// Where-clause application
// ---------------------------------------------------------------------------

/**
 * Apply where clauses to a Firestore query.
 * Returns { query, clauses } where clauses is the parsed array for response building.
 */
export function applyWhereClauses(query, whereClauses) {
  const clauses = [];
  for (const clause of whereClauses) {
    const [field, operator, value] = clause;
    const coerced = coerceValue(value);
    clauses.push({ field, operator, value: coerced });
    query = query.where(field, operator, coerced);
  }
  return { query, clauses };
}

// ---------------------------------------------------------------------------
// Order + pagination
// ---------------------------------------------------------------------------

/**
 * Apply orderBy to a query if specified.
 */
export function applyOrderBy(query, args) {
  if (args.orderBy) {
    query = query.orderBy(args.orderBy, args.orderDirection || "asc");
  }
  return query;
}

/**
 * Apply startAfter pagination cursor to a query.
 * Fetches the cursor document and applies it. If the doc doesn't exist,
 * the cursor is silently skipped (document may have been deleted between pages).
 */
export async function applyPagination(query, db, collection, startAfterId) {
  if (!startAfterId) return query;
  const startDoc = await db.collection(collection).doc(startAfterId).get();
  if (startDoc.exists) {
    query = query.startAfter(startDoc);
  }
  return query;
}

// ---------------------------------------------------------------------------
// Query execution (BLD-501: byte-cap + _meta annotation)
// ---------------------------------------------------------------------------

/**
 * Execute a query with limit and map results to plain objects.
 * Returns { docs, lastDocId, _meta } for response building.
 *
 * BLD-501: accepts projection metadata and enforces byte cap.
 *
 * @param {FirebaseFirestore.Query} query
 * @param {number|undefined} limit
 * @param {Object} [opts] - Options
 * @param {boolean} [opts.includeEmbedding=false] - Include embedding vectors
 * @param {string}  [opts.collection] - Collection name (for _meta)
 * @param {boolean} [opts.projected=false] - Was a default projection applied?
 * @param {string}  [opts.projectionReason] - Reason for projection
 * @returns {Promise<{ docs: Object[], lastDocId: string|null, _meta: Object|undefined }>}
 */
export async function executeQuery(query, limit, opts = {}) {
  const includeEmbedding = opts.includeEmbedding || false;
  const snapshot = await query.limit(limit || 10).get();

  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: stripHeavy(doc.data(), includeEmbedding),
  }));

  const lastDocId = docs.length > 0 ? docs[docs.length - 1].id : null;

  const baseName = (opts.collection || "").split("/").pop();
  const isHeavy = !!HEAVY_COLLECTIONS[baseName];

  if (!isHeavy) {
    return { docs, lastDocId };
  }

  const heavyConfig = HEAVY_COLLECTIONS[baseName];
  const envelope = {
    collection: opts.collection,
    count: docs.length,
  };

  const { trimmedDocs, capped } = enforceByteLimit(docs, envelope);
  const trimmedLastDocId =
    trimmedDocs.length > 0 ? trimmedDocs[trimmedDocs.length - 1].id : null;

  const _meta = buildMeta({
    projected: opts.projected || false,
    reason: opts.projectionReason || "not_heavy_collection",
    returned: trimmedDocs.length,
    totalFetched: docs.length,
    capped,
    cursor: trimmedLastDocId,
    widenWith: opts.projected ? heavyConfig.heavy : [],
  });

  return { docs: trimmedDocs, lastDocId: trimmedLastDocId, _meta };
}

// ---------------------------------------------------------------------------
// Single-document mapping (Ph9 + BLD-501 _meta for heavy collections)
// ---------------------------------------------------------------------------

/**
 * Map a document snapshot to a plain object (with exists check).
 * Used for get_document and batch_get where docs may not exist.
 *
 * BLD-501: accepts collection for _meta annotation on heavy collections.
 *
 * @param {FirebaseFirestore.DocumentSnapshot} doc
 * @param {Object} [opts]
 * @param {boolean} [opts.includeEmbedding=false]
 * @param {string}  [opts.collection]
 * @returns {Object}
 */
export function mapDocSnapshot(doc, opts = {}) {
  const includeEmbedding = opts.includeEmbedding || false;
  const result = {
    id: doc.id,
    exists: doc.exists,
    data: doc.exists ? stripHeavy(doc.data(), includeEmbedding) : null,
  };

  const baseName = (opts.collection || "").split("/").pop();
  const heavyConfig = HEAVY_COLLECTIONS[baseName];

  if (heavyConfig && doc.exists) {
    result._meta = {
      embedding_included: !!includeEmbedding,
      heavy_fields_present: heavyConfig.heavy.filter(
        (f) => result.data && result.data[f] !== undefined
      ),
    };
  }

  return result;
}

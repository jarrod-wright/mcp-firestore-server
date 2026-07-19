import { WHERE_OPERATORS } from "./query.js";

/**
 * Shared schema fragments for tool definitions.
 * Prevents duplication of common property definitions across tool files.
 */

export const COLLECTION_PROPERTY = {
  type: "string",
  description: "Collection path (e.g. 'users' or 'users/uid/posts' for subcollections)",
};

export const PAGINATION_PROPERTIES = {
  limit: { type: "number", default: 10, description: "Maximum documents to return" },
  orderBy: { type: "string", description: "Field to order by" },
  orderDirection: {
    type: "string",
    enum: ["asc", "desc"],
    default: "asc",
    description: "Order direction",
  },
  startAfter: {
    type: "string",
    description:
      "Document ID to start after (for pagination). Use lastDocId from previous response.",
  },
};

/**
 * Ph9 + BLD-501: projection properties for list-class queries.
 *
 * `fields` — opt-in field projection via Firestore .select(). On heavy
 * collections (compilation_artifacts, source_documents), metadata-only
 * fields are projected by default when this parameter is omitted.
 *
 * `includeEmbedding` — explicit default false. The 2048-dim embedding
 * vector is never returned unless the caller sets this to true.
 */
export const PROJECTION_PROPERTIES = {
  fields: {
    type: "array",
    items: { type: "string" },
    description:
      "Optional field projection (Firestore .select()). Return ONLY these fields. " +
      "On heavy collections (compilation_artifacts, source_documents), metadata " +
      "fields are returned by default when this is omitted — pass field names " +
      "like 'compiled_layers' or 'verbatim_content' here to include content fields.",
  },
  includeEmbedding: {
    type: "boolean",
    default: false,
    description:
      "Include the embedding vector in results. Default false — the 2048-dim " +
      "vector is withheld to keep payloads small.",
  },
};

export const WHERE_CLAUSES_PROPERTY = {
  type: "array",
  description:
    `Array of where clauses: [[field, operator, value], ...]. Each inner array is exactly [field, operator, value]: field (string), operator (one of: ${WHERE_OPERATORS.join(", ")}), value (string; auto-coerced to numbers, booleans, arrays, etc.).`,
  items: {
    type: "array",
    items: { type: "string" },
    minItems: 3,
    maxItems: 3,
  },
};

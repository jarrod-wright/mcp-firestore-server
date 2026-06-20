import { coerceValue } from "../helpers/coerce-value.js";
import {
  COLLECTION_PROPERTY,
  PAGINATION_PROPERTIES,
  PROJECTION_PROPERTIES,
  WHERE_CLAUSES_PROPERTY,
} from "../helpers/schema.js";
import {
  WHERE_OPERATORS,
  applyWhereClauses,
  applyOrderBy,
  applyPagination,
  applyProjection,
  enforceProjection,
  executeQuery,
} from "../helpers/query.js";

export const definition = {
  name: "query_with_where",
  description:
    "Query a collection with where conditions. Supports single or multiple clauses, value type coercion, pagination, optional field projection (`fields`), and subcollection paths. On large-document collections (compilation_artifacts, source_documents), only metadata fields are returned by default to prevent oversized payloads — pass `fields` to include specific content fields. Results on these collections include a `_meta` block showing projection status and pagination cursor.",
  inputSchema: {
    type: "object",
    properties: {
      collection: COLLECTION_PROPERTY,
      where: WHERE_CLAUSES_PROPERTY,
      field: {
        type: "string",
        description: "Field to filter on (legacy single-clause format)",
      },
      operator: {
        type: "string",
        enum: WHERE_OPERATORS,
        description: "Comparison operator (legacy single-clause format)",
      },
      value: {
        type: "string",
        description:
          "Value to compare (legacy single-clause format). Numbers, booleans, and arrays are auto-coerced.",
      },
      ...PAGINATION_PROPERTIES,
      ...PROJECTION_PROPERTIES,
    },
    required: ["collection"],
  },
};

export async function handler(args, db) {
  const { fields, projected, reason } = enforceProjection(
    args.collection,
    args.fields
  );

  let query = db.collection(args.collection);
  let clauses;

  if (args.where && Array.isArray(args.where)) {
    ({ query, clauses } = applyWhereClauses(query, args.where));
  } else if (args.field && args.operator && args.value !== undefined) {
    const coerced = coerceValue(args.value);
    clauses = [{ field: args.field, operator: args.operator, value: coerced }];
    query = query.where(args.field, args.operator, coerced);
  } else {
    throw new Error(
      "Provide either 'where' array or 'field'/'operator'/'value' parameters.",
    );
  }

  query = applyProjection(query, fields);
  query = applyOrderBy(query, args);
  query = await applyPagination(query, db, args.collection, args.startAfter);

  const { docs, lastDocId, _meta } = await executeQuery(query, args.limit, {
    includeEmbedding: args.includeEmbedding || false,
    collection: args.collection,
    projected,
    projectionReason: reason,
  });

  return {
    collection: args.collection,
    query: clauses.map((c) => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`).join(" AND "),
    count: docs.length,
    documents: docs,
    ...(lastDocId && { lastDocId }),
    ...(_meta && { _meta }),
  };
}

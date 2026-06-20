import {
  COLLECTION_PROPERTY,
  PAGINATION_PROPERTIES,
  PROJECTION_PROPERTIES,
} from "../helpers/schema.js";
import {
  applyOrderBy,
  applyPagination,
  applyProjection,
  enforceProjection,
  executeQuery,
} from "../helpers/query.js";

export const definition = {
  name: "query_collection",
  description:
    "Query a Firestore collection. Supports subcollection paths (e.g. 'users/uid/posts') and optional field projection via `fields`. On large-document collections (compilation_artifacts, source_documents), only metadata fields are returned by default to prevent oversized payloads — pass `fields` to include specific content fields like compiled_layers or verbatim_content. Results on these collections include a `_meta` block showing projection status, document count, and a pagination cursor.",
  inputSchema: {
    type: "object",
    properties: {
      collection: COLLECTION_PROPERTY,
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
    count: docs.length,
    documents: docs,
    ...(lastDocId && { lastDocId }),
    ...(_meta && { _meta }),
  };
}

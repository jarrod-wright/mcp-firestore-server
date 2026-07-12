import {
  COLLECTION_PROPERTY,
  PROJECTION_PROPERTIES,
} from "../helpers/schema.js";
import { mapDocSnapshot } from "../helpers/query.js";

export const definition = {
  name: "get_document",
  description:
    "Get a specific document by ID. Supports subcollection paths (e.g. 'users/uid/posts'). The large 'embedding' vector is withheld unless includeEmbedding is true. On large-document collections, a `_meta` block indicates which heavy fields are present in the response.",
  inputSchema: {
    type: "object",
    properties: {
      collection: COLLECTION_PROPERTY,
      docId: { type: "string", description: "Document ID" },
      includeEmbedding: PROJECTION_PROPERTIES.includeEmbedding,
    },
    required: ["collection", "docId"],
  },
};

export async function handler(args, db) {
  const doc = await db.collection(args.collection).doc(args.docId).get();
  return mapDocSnapshot(doc, {
    includeEmbedding: args.includeEmbedding || false,
    collection: args.collection,
  });
}

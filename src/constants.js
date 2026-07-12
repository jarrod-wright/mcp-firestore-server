/**
 * Firestore target endpoint identifiers.
 */
export const TARGETS = {
  EMULATOR: "emulator",
  PRODUCTION: "production",
};

/**
 * ZAPPHIRE BLD-501 — Collections containing large document fields that
 * require server-side projection bounding.
 *
 * When a list-class query (query_collection / query_with_where) targets a
 * heavy collection and the caller omits the `fields` parameter, only the
 * DEFAULT_FIELDS are returned via Firestore .select().
 *
 * Derived from CKGE Pydantic schemas (zapphire-ckge src/ckge/schemas/):
 *   compilation_artifact.py  — compiled_layers (~19 KB) + embedding (2048-dim)
 *   source_document.py       — verbatim_content (full transcript)
 */
export const HEAVY_COLLECTIONS = {
  compilation_artifacts: {
    heavy: ["compiled_layers", "embedding"],
    defaultFields: [
      "artifact_id", "source_doc_ref", "client_id", "privacy_level",
      "provenance", "quality_score", "valid_time", "transaction_time",
      "session_title", "participants", "created_at", "updated_at",
    ],
  },
  source_documents: {
    heavy: ["verbatim_content"],
    defaultFields: [
      "source_id", "client_id", "session_id", "collected_at",
      "segments", "privacy_level", "content_hash", "session_title",
      "participants", "recording_start", "recording_end",
      "duration_seconds", "session_type",
    ],
  },
};

/**
 * Maximum response payload bytes for tool results.
 * Set 20% below Hermes tool_output.max_bytes (50000) to provide margin.
 * VERIFIED: config.yaml L81 tool_output.max_bytes = 50000.
 */
export const MAX_RESPONSE_BYTES = 40000;

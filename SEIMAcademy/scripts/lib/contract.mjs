/**
 * The closed key contract, shared by the validator and the drift test.
 *
 * app-data-schema.md is normative and schema/app-data-schema.json mirrors it, but a mirror
 * nothing reads drifts silently -- so test-pipeline.mjs compares these sets against the
 * JSON Schema's declared properties on every run.
 */
/** 6.11 closed-schema -- an unknown key is a failure, not something to ignore. */
export const ALLOWED_KEYS = {
  lesson: new Set(['schema_version', 'id', 'tier', 'module', 'part', 'title', 'summary', 'estimated_seconds', 'teaches', 'requires', 'sources', 'generated', 'atoms']),
  atom: new Set(['id', 'type', 'title', 'body', 'source', 'teaches', 'requires', 'estimated_seconds', 'difficulty', 'lifecycle_stage', 'graded', 'srs', 'payload']),
  source: new Set(['path', 'heading', 'lines']),
  srs: new Set(['eligible', 'deck', 'reason']),
  generated: new Set(['generator', 'generator_version', 'source_repo', 'source_commit', 'source_license', 'profile', 'content_hash']),
  exerciseSet: new Set(['schema_version', 'id', 'kind', 'parse_only', 'pairs', 'generated']),
  pair: new Set(['action', 'channel', 'event_ids', 'scope', 'source']),
  drillRow: new Set(['eventId', 'provider', 'description', 'filter']),
};

export const ALLOWED_PAYLOAD_KEYS = {
  predict: new Set(['prompt', 'reveal']),
  reading: new Set([]),
  flashcard: new Set(['front', 'back']),
  instructions: new Set(['goal', 'what_youll_use', 'done_when', 'step_up_notice']),
  scenario: new Set(['setup', 'steps']),
  'capstone-step': new Set(['alert', 'question', 'expected', 'evidence_refs']),
  'quiz:multiple-choice': new Set(['format', 'question', 'choices', 'answer_index', 'rationale']),
  'quiz:fill-blank': new Set(['format', 'question', 'blank_answer', 'accepted', 'rationale']),
  'exercise:match': new Set(['format', 'pairs']),
  'exercise:drag-classify': new Set(['format', 'buckets', 'items']),
  'exercise:lookup-drill': new Set(['format', 'table_ref', 'columns', 'rows', 'prompts']),
};


/**
 * TypeScript mirror of SEIMAcademy/app-data-schema.md.
 *
 * That document is normative and schema/app-data-schema.json is its machine-readable
 * mirror. These types are a third view of the same contract, so they can drift — which is
 * why `npm run check:types` compares them against the JSON Schema on every run. A type
 * here the schema does not have, or vice versa, fails the build.
 */

export const ATOM_TYPES = [
  'predict',
  'reading',
  'flashcard',
  'quiz',
  'instructions',
  'exercise',
  'scenario',
  'capstone-step',
] as const;
export type AtomType = (typeof ATOM_TYPES)[number];

export const LIFECYCLE_STAGES = [
  'preparation',
  'identification',
  'containment',
  'eradication',
  'recovery',
  'lessons-learned',
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export type Difficulty = 'intro' | 'standard' | 'step-up';

export interface Source {
  path: string;
  heading?: string;
  /** Present only on .ps1-derived atoms — see app-data-schema.md §2. */
  lines?: [number, number];
}

export interface Srs {
  eligible: boolean;
  deck: string;
  reason: 'evidence-set' | 'not-in-evidence-set' | 'duplicate-event';
}

export interface Provenance {
  generator: string;
  generator_version: string;
  source_repo: string;
  source_commit: string;
  source_license: string;
  profile: string;
  content_hash: string;
}

export interface Atom {
  id: string;
  type: AtomType;
  title: string;
  body: string;
  source: Source;
  teaches?: string[];
  requires?: string[];
  estimated_seconds: number;
  difficulty?: Difficulty;
  lifecycle_stage?: LifecycleStage;
  graded: boolean;
  srs?: Srs;
  payload: Record<string, unknown>;
}

export interface Lesson {
  schema_version: '1.0.0';
  id: string;
  tier: 1 | 2;
  module: string;
  part?: number;
  title: string;
  summary: string;
  estimated_seconds: number;
  teaches: string[];
  requires: string[];
  sources: Source[];
  generated: Provenance;
  atoms: Atom[];
}

export interface ModuleReport {
  id: string;
  tier: 1 | 2;
  module: string;
  title: string;
  /** Play order. Never derive order from a filename sort. */
  lesson_order: string[];
  exercise_data: string[];
  stats: {
    lessons: number;
    atoms: number;
    source_rows: number;
    lab_pairs: number;
    lab_pairs_rejected: number;
    srs_eligible_cards: number;
    srs_card_budget: number;
    skipped_sections: number;
  };
  skipped_sections: { path: string; heading: string; reason: string }[];
}

export interface BuildManifest {
  schema_version: '1.0.0';
  generator: string;
  generator_version: string;
  generator_hash: string;
  source_repo: string;
  source_commit: string;
  source_license: string;
  sources: Record<string, string>;
  modules: ModuleReport[];
  artifacts: Record<
    string,
    { kind: string; file: string; content_hash: string; depends_on: string[] }
  >;
  pruned?: string[];
}

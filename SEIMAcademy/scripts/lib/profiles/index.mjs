/**
 * Generator profile registry.
 *
 * A profile owns one source shape: how to parse it, and what atoms that shape can honestly
 * support. It declares the exercise-data profiles and manifest options it accepts, so
 * module-manifest.json validation needs no knowledge of any particular profile.
 *
 * Adding a profile for Phase 4/6 is a new file here plus one line below. Generic lesson
 * assembly -- time budget, chunking, instructions anatomy, provenance -- comes from
 * ../lesson-kit.mjs and is not reimplemented per profile.
 *
 * Contract:
 *   name          string, matches module.profile in the manifest
 *   dataProfiles  Set<string> accepted for exercise_data[].profile
 *   optionRanges  { [option]: [min, max] } -- unknown options are rejected
 *   build(ctx)    -> { lessons, exerciseSets, dependsOn: Map<id, string[]>, moduleReport }
 */
import * as eventIdTables from './event-id-tables.mjs';

export const PROFILES = new Map([[eventIdTables.name, eventIdTables]]);

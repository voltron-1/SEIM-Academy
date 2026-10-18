/**
 * Generator profile: prose-orientation.
 *
 * Parses two small prose documents (README.md's intro/link list, crown-jewels.md's
 * open-ended orientation questions) into an orientation module. Not table-shaped, so
 * event-id-tables.mjs's parsing does not apply -- but parseSections (markdown.mjs) still
 * applies, and citations below are checked against the parsed structure rather than typed
 * as literals, so an upstream rename or reorder fails the build instead of shipping a
 * quietly wrong "README.md:NN says X".
 *
 * Contract (see ./index.mjs):
 *   build(ctx) -> { lessons, exerciseSets, dependsOn, moduleReport }
 *   ctx: { module, manifest, sourceRoot, provenanceBase, note, warn, recordSource }
 */
import { readSource } from '../sources.mjs';
import { parseSections, cleanCell } from '../markdown.mjs';
import { conceptTag, slug } from '../tags.mjs';
import { SECONDS, makeAtom, deterministicId } from '../atoms.mjs';
import { finalizeLesson, pickDistinctChoices } from '../lesson-kit.mjs';

export const name = 'prose-orientation';
export const dataProfiles = new Set();
export const optionRanges = {};

const README_CORPUS = 'readme';
const CROWN_JEWELS_CORPUS = 'crown-jewels';

/** Strip a leading UTF-8 BOM. crown-jewels.md ships with one on its first line, which
 *  would otherwise stop parseSections' heading regex from matching that line at all. */
function stripBom(lines) {
  if (!lines.length) return lines;
  return [lines[0].replace(/^﻿/, ''), ...lines.slice(1)];
}

/** A heading like "# [Lab](/Logging/WindowsVictim.md)" carries a Markdown link the parser
 *  does not strip (only trailing hashes/whitespace are its job). Cleaned for display and
 *  for matching against the plain section labels used as quiz choices. */
function cleanHeading(heading) {
  const m = String(heading ?? '').match(/^\[(.+?)\]\([^)]*\)$/);
  return m ? m[1] : heading;
}

function findSection(sections, path, label, matches) {
  const found = sections.find((s) => matches(cleanHeading(s.heading ?? '')));
  if (!found) {
    throw new Error(`${path}: expected a "${label}" section — source structure has changed`);
  }
  return found;
}

/** Locate a body line containing `keyword` and return its 1-based document line number.
 *  Ties every hardcoded quiz rationale to text that is actually still there, so a source
 *  edit that invalidates the claim fails the build instead of shipping a stale citation. */
function findLine(section, path, keyword) {
  const idx = section.body.findIndex((l) => l.includes(keyword));
  if (idx === -1) {
    throw new Error(
      `${path}: expected "${keyword}" under the "${cleanHeading(section.heading)}" section — source structure has changed`
    );
  }
  return section.startLine + 1 + idx;
}

export function build(ctx) {
  const { module, sourceRoot, provenanceBase } = ctx;

  const readmeSrc = module.sources.find((s) => s.corpus === README_CORPUS);
  const crownSrc = module.sources.find((s) => s.corpus === CROWN_JEWELS_CORPUS);
  if (!readmeSrc || !crownSrc) {
    throw new Error(
      `${module.id}: prose-orientation requires sources with corpus "${README_CORPUS}" and "${CROWN_JEWELS_CORPUS}"`
    );
  }

  const readmeFile = readSource(sourceRoot, readmeSrc.path);
  ctx.recordSource(readmeSrc.path, readmeFile.hash);
  const crownFile = readSource(sourceRoot, crownSrc.path);
  ctx.recordSource(crownSrc.path, crownFile.hash);

  const orientationLesson = buildOrientationLesson({
    module, readmeFile, readmePath: readmeSrc.path, crownFile, crownPath: crownSrc.path, provenanceBase,
  });
  const resourceMapLesson = buildResourceMapLesson({
    module, readmeFile, readmePath: readmeSrc.path, provenanceBase,
  });
  const lessons = [orientationLesson, resourceMapLesson];

  ctx.note(`${module.id}: ${lessons.length} lessons, ${lessons.reduce((n, l) => n + l.atoms.length, 0)} atoms from 2 prose sources`);

  const dependsOn = new Map();
  for (const lesson of lessons) {
    dependsOn.set(lesson.id, [...new Set(lesson.sources.map((s) => s.path))].sort());
  }

  const moduleReport = {
    id: module.id,
    tier: module.tier,
    module: module.module,
    title: module.title,
    lesson_order: lessons.map((l) => l.id),
    exercise_data: [],
    stats: {
      lessons: lessons.length,
      atoms: lessons.reduce((n, l) => n + l.atoms.length, 0),
      // event-id-tables-shaped fields that printReport() prints unconditionally for every
      // module -- zeroed (or set to validate-content.mjs's own SRS_CARD_CEILING default)
      // since this profile has no tables, no lab pairs and no SRS cards.
      source_rows: 0,
      lab_pairs: 0,
      lab_pairs_rejected: 0,
      srs_eligible_cards: 0,
      srs_card_budget: 80,
    },
  };

  return { lessons, exerciseSets: [], dependsOn, moduleReport };
}

/**
 * Lesson 1: what a SIEM team's resources are for (README's intro), then crown-jewels.md's
 * questions as genuinely open-ended `predict` atoms -- graded:false, no `requires`
 * (predict-never-graded, atoms.mjs), and a `reveal` that admits there is no canonical
 * answer rather than fabricating one the source does not provide.
 */
function buildOrientationLesson({ module, readmeFile, readmePath, crownFile, crownPath, provenanceBase }) {
  const base = `${module.id}-orientation`;
  const atoms = [];

  const introLines = readmeFile.lines.slice(0, 5).map((l) => cleanCell(l)).filter(Boolean);
  if (introLines.length < 2) {
    throw new Error(`${readmePath}: expected an intro line plus bullet points in the first 5 lines — source structure has changed`);
  }
  if (introLines.some((l) => /\[[^\]]*\]\(/.test(l))) {
    throw new Error(`${readmePath}: intro lines contain a Markdown link, not expected for plain orientation prose`);
  }
  atoms.push(
    makeAtom({
      id: deterministicId(base, 'readme-intro', 'reading'),
      type: 'reading',
      title: "What these resources are for",
      body:
        `${introLines[0]}\n\n` +
        introLines
          .slice(1)
          .map((l) => `- ${l.replace(/^\*\s*/, '')}`)
          .join('\n'),
      source: { path: readmePath, lines: [1, 5] },
      teaches: [conceptTag('concept:soc-purpose')],
      seconds: SECONDS.reading,
      payload: {},
    })
  );

  const crownLines = stripBom(crownFile.lines);
  const crownSections = parseSections(crownLines).sections;
  const crownSection = findSection(crownSections, crownPath, 'Crown Jewels', (h) => h === 'Crown Jewels');

  const questionLines = crownSection.body
    .map((text, idx) => ({ text: cleanCell(text), line: crownSection.startLine + 1 + idx }))
    .filter((l) => l.text.startsWith('- '));
  if (questionLines.length === 0) {
    throw new Error(`${crownPath}: expected "- " question bullets under "${crownSection.heading}" — source structure has changed`);
  }

  for (const q of questionLines) {
    const prompt = q.text.slice(2).trim();
    atoms.push(
      makeAtom({
        id: deterministicId(base, 'crown-jewels', 'predict', slug(prompt).slice(0, 40)),
        type: 'predict',
        title: 'Crown jewels: think before you look',
        body: 'No single right answer — work this out against your own environment, not the source text.',
        source: { path: crownPath, heading: crownSection.heading, lines: [q.line, q.line] },
        seconds: SECONDS.predict,
        graded: false,
        payload: {
          prompt,
          reveal:
            'This question is intentionally open-ended — the source names it as something a SOC team ' +
            'identifies for itself, not a fact to memorize. There is no canonical answer here; the point ' +
            'is to have actually tried answering it against a real environment before moving on.',
        },
      })
    );
  }

  return finalizeLesson({
    module,
    id: base,
    title: 'SOC orientation: what you’re protecting',
    summary:
      `What a SIEM team’s resources are for, then ${questionLines.length} questions every SOC needs its own ` +
      'answers to — not looked up, worked out.',
    atoms,
    provenanceBase,
  });
}

/**
 * Lesson 2: README's link list, grouped the way the document itself groups it, taught as
 * a resource map -- "where would you find X" -- rather than as content to memorize.
 * Quiz distractors are the other three real section names, never fabricated (same honest-
 * distractor principle as event-id-tables.mjs). Every citation below is a line found by
 * searching the parsed section for the exact wording the atom relies on, not a typed line
 * number, so a source edit that breaks the claim fails the build instead of shipping stale
 * provenance.
 */
function buildResourceMapLesson({ module, readmeFile, readmePath, provenanceBase }) {
  const base = `${module.id}-resource-map`;
  const atoms = [];

  const sections = parseSections(readmeFile.lines).sections;
  const hardening = findSection(sections, readmePath, 'Hardening', (h) => h === 'Hardening');
  const matrix = findSection(sections, readmePath, 'Detection and Compliance Matrix', (h) => h === 'Detection and Compliance Matrix');
  const enrichment = findSection(sections, readmePath, 'Data Enrichment', (h) => h === 'Data Enrichment');
  const lab = findSection(sections, readmePath, 'Lab', (h) => h === 'Lab');

  const README_SECTIONS = ['Hardening', 'Detection and Compliance Matrix', 'Data Enrichment', 'Lab'];

  atoms.push(
    makeAtom({
      id: deterministicId(base, 'hardening', 'reading'),
      type: 'reading',
      title: 'Hardening',
      body:
        'Before detection comes prevention: DNS, email, general endpoint and network security, the Microsoft ' +
        '365 surface (Auditing, Azure AD, Exchange, SharePoint/OneDrive, Teams), Active Directory, Windows DNS, ' +
        'Windows itself, network, remote access, vendor guidance and web security all have their own hardening ' +
        'page here — one destination per topic, not one giant document.',
      source: { path: readmePath, heading: hardening.heading, lines: [hardening.startLine, hardening.endLine] },
      teaches: [conceptTag('concept:soc-resource-map')],
      seconds: SECONDS.reading,
      payload: {},
    })
  );

  atoms.push(
    makeAtom({
      id: deterministicId(base, 'detection-enrichment-lab', 'reading'),
      type: 'reading',
      title: 'Detection & Compliance Matrix, Data Enrichment, Lab',
      body:
        'The Detection and Compliance Matrix links cases, adversaries, techniques, mitigations, detections, ' +
        'hunts and log sources together as one relational structure, with Detection Tactics, Detection Methods ' +
        'and Playbooks underneath it. Data Enrichment lists what turns a bare log field into something ' +
        'searchable — GeoIP/ASN, Levenshtein distance, Shannon entropy, WHOIS, reverse-DNS, certificate ' +
        'parsing and a few ready-made lookup tables. Lab is where all of it gets exercised, against a real ' +
        'Windows system, SIEM and attacking system.',
      source: { path: readmePath, heading: matrix.heading, lines: [matrix.startLine, lab.endLine] },
      teaches: [conceptTag('concept:soc-resource-map')],
      seconds: SECONDS.reading,
      payload: {},
    })
  );

  const quizzes = [
    {
      suffix: 'exchange',
      section: hardening,
      keyword: 'Exchange',
      answer: 'Hardening',
      question: 'Where would you find guidance on hardening Microsoft 365 Exchange?',
      rationaleText: (line) => `${readmePath}:${line} lists Exchange under the Hardening section’s Microsoft 365 subgroup.`,
    },
    {
      suffix: 'matrix',
      section: matrix,
      keyword: 'cases, adversaries, techniques',
      answer: 'Detection and Compliance Matrix',
      question:
        'Where would you find the object-oriented structure that links cases, adversaries, techniques, ' +
        'mitigations, detections, hunts and log sources together?',
      rationaleText: (line) => `${readmePath}:${line} describes the Detection and Compliance Matrix in exactly those terms.`,
    },
    {
      suffix: 'geoip',
      section: enrichment,
      keyword: 'GeoIP/ASN Lookup',
      answer: 'Data Enrichment',
      question: 'Where would you find a GeoIP/ASN lookup for enriching an ingested log field?',
      rationaleText: (line) => `${readmePath}:${line} lists GeoIP/ASN Lookup under Data Enrichment.`,
    },
    {
      suffix: 'lab-setup',
      section: lab,
      keyword: 'Set up a lab with a Windows system',
      answer: 'Lab',
      question: 'Where would you find instructions to set up a Windows system, a SIEM and an attacking system for detection research?',
      rationaleText: (line) => `${readmePath}:${line} describes exactly that setup under the Lab section.`,
    },
  ];

  for (const q of quizzes) {
    const line = findLine(q.section, readmePath, q.keyword);
    const choices = pickDistinctChoices(q.answer, README_SECTIONS).sort((a, b) => a.localeCompare(b));
    atoms.push(
      makeAtom({
        id: deterministicId(base, q.suffix, 'quiz'),
        type: 'quiz',
        title: `Where would you find it: ${q.answer}`,
        body: 'Inline feedback, no results page.',
        source: { path: readmePath, heading: cleanHeading(q.section.heading), lines: [line, line] },
        requires: [conceptTag('concept:soc-resource-map')],
        seconds: SECONDS.quiz,
        payload: {
          format: 'multiple-choice',
          question: q.question,
          choices,
          answer_index: choices.indexOf(q.answer),
          rationale: q.rationaleText(line),
        },
      })
    );
  }

  return finalizeLesson({
    module,
    id: base,
    title: 'Resource map: where things live',
    summary: 'A map of the knowledge base’s major sections, so the reader can find the right page fast instead of memorizing the contents.',
    atoms,
    provenanceBase,
  });
}

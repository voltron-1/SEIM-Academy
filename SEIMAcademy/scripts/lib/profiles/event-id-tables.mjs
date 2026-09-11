/**
 * Generator profile: event-id-tables.
 *
 * Parses Markdown tables of Windows Event IDs (Logging/Notable-Event-IDs-*.md) plus the
 * Decision B lab ground-truth comments into lessons. Everything here is specific to that
 * source shape -- row.eventId, channel headings, corpus membership. Generic lesson
 * assembly lives in ../lesson-kit.mjs.
 *
 * PARSE-ONLY: the Lab .ps1 files are read as text via readSource and handed to
 * extractEventLabels, a pure string function. Nothing in this module executes them.
 *
 * Contract (see ./index.mjs):
 *   build(ctx) -> { lessons, exerciseSets, dependsOn, moduleReport }
 *   ctx: { module, manifest, sourceRoot, provenanceBase, note, warn, recordSource }
 */
import { readSource } from '../sources.mjs';
import { parseSections, parseTables, firstProseLine, cleanCell } from '../markdown.mjs';
import { extractEventLabels } from '../ps1-labels.mjs';
import { slug, corpusTag, channelTag, eventTag, providerTag, conceptTag, normalizeTags } from '../tags.mjs';
import { SCHEMA_VERSION, SECONDS, makeAtom, deterministicId, contentHash, truncateTitle } from '../atoms.mjs';
import {
  finalizeLesson, chunkEvenly, chunkSuffixes, makeInstructions, pickDistinctChoices,
} from '../lesson-kit.mjs';

export const name = 'event-id-tables';
export const dataProfiles = new Set(['ps1-event-labels']);
export const optionRanges = {
  lookup_table_rows: [1, 100000],
  srs_card_budget: [1, 80],
  min_section_rows: [1, 1000],
};

const CARDS_PER_LESSON = 12;
const DRILL_PROMPTS = 12;
const CLASSIFY_ITEMS = 8;
const PAIR_ITEMS = 6;

export function build(ctx) {
  const { module, sourceRoot, provenanceBase } = ctx;
  const dependsOn = new Map();
  const exerciseSets = [];
  const opts = {
    lookup_table_rows: 120,
    srs_card_budget: 80,
    min_section_rows: 4,
    ...(module.options ?? {}),
  };

  // ---- 1. Decision B: ground-truth action -> event pairs, parse-only -------------------
  const labPaths = (module.exercise_data ?? []).map((e) => e.path);
  const pairs = [];
  const labRejects = [];
  for (const rel of labPaths) {
    const file = readSource(sourceRoot, rel);
    ctx.recordSource(rel, file.hash);
    const { pairs: p, rejected, commentLines } = extractEventLabels(file.text, rel);
    pairs.push(...p);
    labRejects.push(...rejected);
    ctx.note(`${rel}: ${p.length} action→event pairs from ${commentLines} comment lines`);
  }
  // Evidence is keyed by Event ID -> the channel(s) the generators attribute it to. The
  // lookup tolerates a channel the source tables name more precisely than the generator
  // comment does ("Security" on DC vs "Security (Domain Controller Specific)").
  const evidence = new Map();
  for (const p of pairs) {
    for (const id of p.event_ids) {
      const key = String(id);
      if (!evidence.has(key)) evidence.set(key, new Set());
      evidence.get(key).add(slug(p.channel));
    }
  }

  const exerciseSetId = `${module.id}-lab-action-event-pairs`;
  const exerciseSet = {
    schema_version: SCHEMA_VERSION,
    id: exerciseSetId,
    kind: 'action-event-pairs',
    parse_only: true,
    pairs,
    generated: { ...provenanceBase, content_hash: contentHash(pairs) },
  };
  exerciseSets.push(exerciseSet);
  dependsOn.set(exerciseSetId, [...labPaths].sort());

  // ---- 2. Parse the three corpora -----------------------------------------------------
  const corpora = [];
  const skippedSections = [];
  for (const src of module.sources) {
    const file = readSource(sourceRoot, src.path);
    ctx.recordSource(src.path, file.hash);
    const { preamble, sections } = parseSections(file.lines);
    const withTables = sections.map((s) => ({
      heading: s.heading,
      startLine: s.startLine,
      tables: parseTables(s.body, s.startLine + 1),
    }));

    for (const s of withTables) {
      for (const t of s.tables) {
        if (t.unknownColumns.length) {
          ctx.warn(
            `${src.path}#${s.heading}: unrecognized table column(s) ${JSON.stringify(t.unknownColumns)} — ignored`
          );
        }
        for (const r of t.rejectedRows) {
          ctx.warn(
            `${src.path}:${r.line} (#${s.heading}): EventID cell "${r.eventId}" is ${r.reason} — row skipped`
          );
        }
        const splitCells = new Set();
        for (const r of t.rows) {
          if (!r.split || splitCells.has(r.line)) continue;
          splitCells.add(r.line);
          const where = `${src.path}:${r.line} (#${s.heading})`;
          const ids = r.eventIdRaw.split(/[\s,]+/).filter(Boolean).map(Number);
          if (!r.mixedSeparator) {
            ctx.note(`${where}: EventID cell "${r.eventIdRaw}" split into separate rows`);
            continue;
          }
          // "8 15, 16, 33" mixes a bare space with commas. Read one way that is four
          // Event IDs; read another it is a typo, and "Event ID 8" becomes a fabricated
          // card. The pipeline cannot tell, so it asks -- once -- and a human's answer is
          // recorded in module-manifest.json rather than re-litigated on every build.
          const confirmed = (module.confirmed_cells ?? []).find(
            (c) => c.path === src.path && c.heading === s.heading && c.cell === r.eventIdRaw
          );
          if (!confirmed) {
            ctx.warn(
              `${where}: EventID cell "${r.eventIdRaw}" mixes spaces and commas — split into ` +
                `${ids.join(', ')}; confirm it against the source and record it in ` +
                `module-manifest.json under confirmed_cells`
            );
          } else if (confirmed.event_ids.join(',') !== ids.join(',')) {
            // The recorded answer and the parse disagree: one of them is wrong, and
            // shipping either would be guessing. Stop.
            throw new Error(
              `confirmed-cell-mismatch: ${where} parses "${r.eventIdRaw}" as ${ids.join(', ')} but ` +
                `module-manifest.json records ${confirmed.event_ids.join(', ')}`
            );
          } else {
            ctx.note(`${where}: EventID cell "${r.eventIdRaw}" split into ${ids.join(', ')} — ${confirmed.note}`);
          }
        }
      }
    }

    const enriched = withTables.map((s) => ({
      ...s,
      rows: s.tables.flatMap((t) => t.rows),
      columns: unionColumns(s.tables),
    }));
    // A section whose only rows were rejected vanishes from every artifact. Silent data
    // loss of a whole channel is indistinguishable from "this channel never existed", so
    // it is persisted in build-manifest.json, not just printed once to stdout.
    for (const s of enriched) {
      if (s.rows.length > 0 || s.tables.length === 0) continue;
      // A section whose only row was a wildcard is handled, not lost -- see wildcards below.
      if (s.tables.some((t) => t.wildcardRows.length)) continue;
      skippedSections.push({
        path: src.path,
        heading: s.heading,
        reason: s.tables.some((t) => t.rejectedRows.length) ? 'all-rows-rejected' : 'no-data-rows',
      });
    }
    const parsed = enriched.filter((s) => s.rows.length > 0);

    // Channels collected wholesale rather than by Event ID. Teachable content in their own
    // right -- "some channels you turn on entirely" is a real collection decision -- and
    // dropping them silently removed a whole channel from the curriculum.
    const wildcards = enriched.flatMap((sec) =>
      sec.tables.flatMap((t) =>
        t.wildcardRows.map((r) => ({ heading: sec.heading, description: cleanCell(r.description) }))
      )
    );
    for (const w of wildcards) {
      ctx.note(`${src.path} (#${w.heading}): collected wholesale (EventID "*") — taught as a channel, not a card`);
    }

    corpora.push({
      corpus: src.corpus,
      path: src.path,
      summary: firstProseLine(preamble.body),
      sections: parsed,
      wildcards,
    });
  }

  // ---- 3. Build lessons ---------------------------------------------------------------
  const lessons = [];
  const taught = new Set(); // tags taught so far, in play order -- drives 6.6 by construction
  const headingsByEvent = new Map(); // eventId -> channel headings that taught it
  const eligibleCards = [];
  const cardSeen = new Set();

  lessons.push(buildOrientationLesson({ module, corpora, provenanceBase }));
  collectTeaches(lessons.at(-1), taught, headingsByEvent);

  for (const corpus of corpora) {
    const big = [];
    const small = [];
    for (const section of corpus.sections) {
      if (section.rows.length >= opts.min_section_rows) big.push(section);
      else small.push(section);
    }
    for (const section of big) {
      const built =
        section.rows.length > opts.lookup_table_rows
          ? [buildReferenceLesson({ module, corpus, section, provenanceBase })]
          : buildRecallLessons({ module, corpus, section, provenanceBase, evidence, opts, eligibleCards, cardSeen });
      for (const lesson of built) {
        lessons.push(lesson);
        collectTeaches(lesson, taught, headingsByEvent);
      }
    }
    const smallRows = small.flatMap((s) => s.rows.map((r) => ({ ...r, heading: s.heading })));
    if (smallRows.length >= 3) {
      for (const lesson of buildSmallChannelLessons({
        module, corpus, rows: smallRows, provenanceBase, evidence, opts, eligibleCards, cardSeen,
        wildcards: corpus.wildcards,
      })) {
        lessons.push(lesson);
        collectTeaches(lesson, taught, headingsByEvent);
      }
    } else if (corpus.wildcards.length) {
      ctx.warn(
        `${corpus.path}: ${corpus.wildcards.length} wholesale-collected channel(s) have no ` +
          `smaller-channels lesson to sit in and were dropped: ${corpus.wildcards.map((w) => w.heading).join(', ')}`
      );
    } else if (smallRows.length > 0) {
      ctx.note(
        `${corpus.path}: ${smallRows.length} row(s) in under-sized sections dropped — fewer than 3 is not a lesson`
      );
    }
  }

  // ---- 4. Classification + lab exercises, last so their prerequisites are taught -------
  // These two families aggregate across every corpus: classify picks unambiguous events
  // from all three lists, and the lab lessons resolve channels against tags taught by any
  // of them. Their atoms cite only one document, so dependency inference from atom.source
  // alone under-reports -- and the 6.9 self-check then calls a legitimate edit
  // "NON-DETERMINISM". They declare the broader set explicitly instead.
  const crossCorpusLessons = new Set();
  for (const lesson of buildCorpusClassifyLessons({ module, corpora, provenanceBase, taught })) {
    lessons.push(lesson);
    crossCorpusLessons.add(lesson.id);
    collectTeaches(lesson, taught, headingsByEvent);
  }
  const labLessons = buildActionEventLessons({
    module, pairs, provenanceBase, taught, headingsByEvent, exerciseSetId, note: ctx.note,
  });
  for (const lesson of labLessons) {
    lessons.push(lesson);
    crossCorpusLessons.add(lesson.id);
    collectTeaches(lesson, taught, headingsByEvent);
  }

  // ---- 5. section 6.5 srs-anti-flood: budget is a build error, never a silent trim -----
  if (eligibleCards.length > opts.srs_card_budget) {
    throw new Error(
      `srs-anti-flood: module ${module.id} emitted ${eligibleCards.length} SRS-eligible cards, ` +
        `budget is ${opts.srs_card_budget}. Tighten the eligibility rule or raise the budget deliberately.`
    );
  }

  for (const lesson of lessons) {
    // Every lesson depends on the lab files too: they decide SRS eligibility (6.5).
    dependsOn.set(lesson.id, [
      ...new Set([
        ...lesson.sources.map((s) => s.path),
        ...labPaths,
        ...(crossCorpusLessons.has(lesson.id) ? module.sources.map((s) => s.path) : []),
      ]),
    ].sort());
  }

  const moduleReport = {
    id: module.id,
    tier: module.tier,
    module: module.module,
    title: module.title,
    lesson_order: lessons.map((l) => l.id),
    exercise_data: [exerciseSetId],
    stats: {
      lessons: lessons.length,
      atoms: lessons.reduce((n, l) => n + l.atoms.length, 0),
      source_rows: corpora.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.rows.length, 0), 0),
      lab_pairs: pairs.length,
      lab_pairs_rejected: labRejects.length,
      srs_eligible_cards: eligibleCards.length,
      srs_card_budget: opts.srs_card_budget,
      skipped_sections: skippedSections.length,
    },
    skipped_sections: skippedSections,
  };

  return { lessons, exerciseSets, dependsOn, moduleReport };
}


function unionColumns(tables) {
  const cols = [];
  for (const t of tables) for (const c of t.columns) if (c && !cols.includes(c)) cols.push(c);
  return cols;
}

/** Returns the matched evidence channel slug, or null. The matched channel -- not the
 *  table's heading -- is the SRS dedupe key, so an Event ID filed under both "Security"
 *  and "Security (Domain Controller Specific)" yields one card, not two. */

function matchEvidence(evidence, headingSlug, eventId) {
  const channels = evidence.get(String(eventId));
  if (!channels) return null;
  for (const c of [...channels].sort()) {
    if (headingSlug === c || headingSlug.startsWith(`${c}-`)) return c;
  }
  return null;
}


function collectTeaches(lesson, taught, headingsByEvent) {
  for (const atom of lesson.atoms) {
    for (const tag of atom.teaches ?? []) {
      taught.add(tag);
      if (!headingsByEvent) continue;
      const m = tag.match(/^event:(.+):([0-9]+)$/);
      if (!m) continue;
      const key = m[2];
      if (!headingsByEvent.has(key)) headingsByEvent.set(key, new Set());
      headingsByEvent.get(key).add(atom.source.heading ?? m[1]);
    }
  }
}

/**
 * Resolve a lab pair's (channel, eventId) to a tag that was actually taught.
 * Exact channel match wins; otherwise a taught channel that extends the lab's channel
 * name is accepted -- "Security 4741 on DC" resolving to
 * "Security (Domain Controller Specific)". Anything else stays unresolved and the pair
 * is held back by section 6.6.
 */

function resolveTaughtEvent(channel, eventId, taught, headingsByEvent) {
  const want = slug(channel);
  const exact = eventTag(channel, eventId);
  if (taught.has(exact)) return { tag: exact, heading: channel };
  const candidates = [...(headingsByEvent.get(String(eventId)) ?? [])]
    .filter((h) => {
      const hs = slug(h);
      return hs === want || hs.startsWith(`${want}-`);
    })
    .sort();
  for (const heading of candidates) {
    const tag = eventTag(heading, eventId);
    if (taught.has(tag)) return { tag, heading };
  }
  return null;
}


function buildOrientationLesson({ module, corpora, provenanceBase }) {
  const base = `${module.id}-orientation`;
  const atoms = [];

  atoms.push(
    makeAtom({
      id: deterministicId(base, 'predict'),
      type: 'predict',
      title: 'Three lists of Windows Event IDs',
      body: 'No wrong answers here — this one is a guess before you read anything.',
      source: { path: corpora[0].path, lines: [1, 1] },
      seconds: SECONDS.predict,
      graded: false,
      payload: {
        prompt:
          'This knowledge base splits notable Windows Event IDs across three lists: Sigma, Risk and Forensics. What do you think decides which list an Event ID lands on?',
        reveal:
          'Purpose, not severity. Sigma = IDs a detection rule already fires on. Risk = IDs worth scoring but not alerting on. Forensics = IDs that rarely alert but matter once you are reconstructing what happened.',
      },
    })
  );

  for (const corpus of corpora) {
    atoms.push(
      makeAtom({
        id: deterministicId(base, corpus.corpus, 'reading'),
        type: 'reading',
        title: `The ${corpus.corpus} list`,
        body: `${corpus.summary}\n\nIt covers ${corpus.sections.length} log channels and ${corpus.sections.reduce((n, s) => n + s.rows.length, 0)} Event IDs.`,
        source: { path: corpus.path, lines: [1, 1] },
        teaches: [corpusTag(corpus.corpus), conceptTag('concept:corpus-purpose')],
        seconds: SECONDS.reading,
        payload: {},
      })
    );
  }

  const risk = corpora.find((c) => c.corpus === 'risk') ?? corpora[0];
  atoms.push(
    makeAtom({
      id: deterministicId(base, 'quiz'),
      type: 'quiz',
      title: 'Which list, and why',
      body: 'One question. Inline feedback either way.',
      source: { path: risk.path, lines: [1, 1] },
      requires: corpora.map((c) => corpusTag(c.corpus)),
      seconds: SECONDS.quiz,
      payload: {
        format: 'multiple-choice',
        question:
          'An Event ID is worth recording so it can build up an account risk score, but no existing Sigma rule fires on it. Which list does it belong to?',
        choices: corpora.map((c) => `The ${c.corpus} list`),
        answer_index: corpora.indexOf(risk),
        rationale: risk.summary,
      },
    })
  );

  return finalizeLesson({
    module,
    id: base,
    title: 'Windows Event IDs: three lists, three jobs',
    summary:
      'Why the same knowledge base keeps three separate Event ID lists, and what each one is actually for.',
    atoms,
    provenanceBase,
  });
}


function duplicateKeys(rows, headingOf) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${slug(headingOf(row))}:${row.eventId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

function disambiguator(row, heading, dupKeys) {
  if (!dupKeys?.has(`${slug(heading)}:${row.eventId}`)) return null;
  const provider = cleanCell(row.provider);
  if (provider) return { idPart: slug(provider), label: provider };
  const desc = cleanCell(row.description);
  return { idPart: slug(desc).slice(0, 24) || 'alt', label: desc.slice(0, 40) };
}

function rowLabel(row, heading, dupKeys) {
  const d = disambiguator(row, heading, dupKeys);
  return d ? `${row.eventId} (${d.label})` : String(row.eventId);
}

/**
 * A lesson id must not keep its name while its contents change (6.8). Chunk boundaries
 * necessarily move when rows are added or removed, so the suffix is derived from the
 * FIRST ROW of the chunk rather than the chunk's ordinal: if membership shifts, the id
 * shifts with it and the old lesson shows up in the orphan report. A stable-looking id
 * whose meaning silently changed is worse than a visibly renamed one.
 */

function rowDescription(row) {
  return cleanCell(row.description) || cleanCell(row.provider) || `Event ${row.eventId}`;
}


function makeFlashcards({ module, corpus, heading, rows, evidence, eligibleCards, cardSeen, dupKeys }) {
  const chanSlug = slug(heading);
  return rows.map((row) => {
    const disamb = disambiguator(row, heading, dupKeys);
    const matched = matchEvidence(evidence, chanSlug, row.eventId);
    const key = `${matched}:${row.eventId}`;
    let eligible = false;
    let reason;
    if (!matched) {
      reason = 'not-in-evidence-set';
    } else if (cardSeen.has(key)) {
      reason = 'duplicate-event';
    } else {
      eligible = true;
      reason = 'evidence-set';
      cardSeen.add(key);
    }
    const teaches = [eventTag(heading, row.eventId), channelTag(heading), corpusTag(corpus.corpus)];
    if (row.provider) teaches.push(providerTag(row.provider));

    const atom = makeAtom({
      id: deterministicId(module.id, corpus.corpus, chanSlug, 'fc', String(row.eventId), disamb?.idPart),
      type: 'flashcard',
      title: `${heading} ${row.eventId}`,
      body: `Log channel: ${heading} · Source list: ${corpus.corpus}`,
      source: { path: corpus.path, heading, lines: [row.line, row.line] },
      teaches,
      seconds: SECONDS.flashcard,
      graded: false,
      srs: { eligible, deck: `${module.id}-${chanSlug}`, reason },
      payload: {
        front: disamb
          ? `${heading} — Event ID ${row.eventId} (${disamb.label})`
          : `${heading} — Event ID ${row.eventId}`,
        back: rowDescription(row),
      },
    });
    if (eligible) eligibleCards.push(atom.id);
    return atom;
  });
}

/**
 * `headingOf` exists because the "smaller channels" lessons sweep rows from several
 * channels into one sitting. Labelling the question with the lesson's first heading
 * produced factually wrong questions -- "In the AppLocker channel, which Event ID records
 * <an NTLM description>" -- so the channel named is always the ANSWER ROW's own.
 */

function makeRowQuiz({ module, corpus, heading, rows, idSuffix, headingOf = () => heading }) {
  const counts = new Map();
  for (const r of rows) counts.set(rowDescription(r), (counts.get(rowDescription(r)) ?? 0) + 1);
  const answerRow = rows.find((r) => counts.get(rowDescription(r)) === 1);
  if (!answerRow) {
    // Falling back to rows[0] here would emit a question with more than one correct
    // answer. Reported, not guessed at.
    throw new Error(
      `quiz-ambiguous: every row in ${corpus.path}#${heading} (${idSuffix}) shares its description ` +
        `with another row, so no unambiguous multiple-choice answer exists`
    );
  }
  const choices = pickDistinctChoices(answerRow.eventId, rows.map((r) => r.eventId))
    .sort((a, b) => Number(a) - Number(b));
  const answerHeading = headingOf(answerRow) ?? heading;
  return makeAtom({
    id: deterministicId(module.id, corpus.corpus, slug(answerHeading), 'quiz', idSuffix),
    type: 'quiz',
    title: `Recall: ${answerHeading}`,
    body: 'Inline feedback, no results page.',
    source: { path: corpus.path, heading: answerHeading, lines: [answerRow.line, answerRow.line] },
    requires: [eventTag(answerHeading, answerRow.eventId)],
    seconds: SECONDS.quiz,
    payload: {
      format: 'multiple-choice',
      question: `In the ${answerHeading} channel, which Event ID records: “${rowDescription(answerRow)}”`,
      choices,
      answer_index: choices.indexOf(String(answerRow.eventId)),
      rationale: `${corpus.path}#${answerHeading} lists ${answerRow.eventId} as “${rowDescription(answerRow)}”.`,
    },
  });
}


function makeMatchExercise({ module, corpus, heading, rows, idSuffix, requires, dupKeys }) {
  const pairs = rows.slice(0, 8).map((r) => ({ left: rowLabel(r, heading, dupKeys), right: rowDescription(r) }));
  return makeAtom({
    id: deterministicId(module.id, corpus.corpus, slug(heading), 'match', idSuffix),
    type: 'exercise',
    title: `Match: ${heading} IDs to what they record`,
    body: 'Every ID below was on the cards you just saw.',
    source: { path: corpus.path, heading, lines: [rows[0].line, rows.at(-1).line] },
    requires,
    difficulty: 'standard',
    seconds: SECONDS.exercise,
    payload: { format: 'match', pairs },
  });
}


function buildRecallLessons({ module, corpus, section, provenanceBase, evidence, opts, eligibleCards, cardSeen }) {
  const chunks = chunkEvenly(section.rows, CARDS_PER_LESSON);
  const chanSlug = slug(section.heading);
  const dupKeys = duplicateKeys(section.rows, () => section.heading);
  const suffixes = chunkSuffixes(chunks, (r) => `e${r.eventId}`);
  return chunks.map((rows, idx) => {
    const part = chunks.length > 1 ? idx + 1 : undefined;
    const suffix = suffixes[idx];
    const atoms = [];

    atoms.push(
      makeAtom({
        id: deterministicId(module.id, corpus.corpus, chanSlug, 'intro', suffix),
        type: 'reading',
        title: `${section.heading}`,
        body:
          `The **${section.heading}** channel appears on the ${corpus.corpus} list with ` +
          `${section.rows.length} notable Event ID${section.rows.length === 1 ? '' : 's'}. ` +
          `This sitting covers ${rows.length} of them.`,
        source: { path: corpus.path, heading: section.heading, lines: [section.startLine, section.startLine] },
        teaches: [channelTag(section.heading), corpusTag(corpus.corpus)],
        seconds: SECONDS.reading,
        payload: {},
      })
    );

    atoms.push(
      ...makeFlashcards({ module, corpus, heading: section.heading, rows, evidence, eligibleCards, cardSeen, dupKeys })
    );

    atoms.push(makeRowQuiz({ module, corpus, heading: section.heading, rows, idSuffix: suffix }));

    const requires = normalizeTags([
      channelTag(section.heading),
      ...rows.slice(0, 8).map((r) => eventTag(section.heading, r.eventId)),
    ]);
    atoms.push(
      makeInstructions({
        module,
        corpus: corpus.corpus,
        heading: section.heading,
        idSuffix: suffix,
        goal: `Match each ${section.heading} Event ID to what it records.`,
        use: `The ${rows.length} cards you just reviewed — nothing outside them.`,
        doneWhen: 'Every ID on the left has a description on the right.',
        source: { path: corpus.path, heading: section.heading, lines: [section.startLine, section.startLine] },
        teaches: [conceptTag('concept:corpus-purpose')],
      })
    );
    atoms.push(
      makeMatchExercise({ module, corpus, heading: section.heading, rows, idSuffix: suffix, requires, dupKeys })
    );

    return finalizeLesson({
      module,
      id: deterministicId(module.id, corpus.corpus, chanSlug, suffix),
      title: `${section.heading} (${corpus.corpus})${part ? ` — part ${part}` : ''}`,
      summary: `${rows.length} notable Event IDs from the ${section.heading} channel on the ${corpus.corpus} list.`,
      atoms,
      provenanceBase,
      part,
    });
  });
}


function buildReferenceLesson({ module, corpus, section, provenanceBase }) {
  const chanSlug = slug(section.heading);
  const rows = section.rows;
  const atoms = [];

  atoms.push(
    makeAtom({
      id: deterministicId(module.id, corpus.corpus, chanSlug, 'ref-intro'),
      type: 'reading',
      title: `${section.heading}`,
      body:
        `The **${section.heading}** channel carries ${rows.length} notable Event IDs on the ` +
        `${corpus.corpus} list. That is a reference table, not a memorisation deck — ` +
        `nobody triages by reciting it.`,
      source: { path: corpus.path, heading: section.heading, lines: [section.startLine, section.startLine] },
      teaches: [channelTag(section.heading), corpusTag(corpus.corpus)],
      seconds: 50,
      payload: {},
    })
  );
  atoms.push(
    makeAtom({
      id: deterministicId(module.id, corpus.corpus, chanSlug, 'ref-how'),
      type: 'reading',
      title: 'Using a reference table',
      body:
        'The skill here is lookup speed, not recall: find the row, read the description, ' +
        'decide whether it explains the alert in front of you. Keep the table open — that is what it is for.',
      source: { path: corpus.path, heading: section.heading, lines: [section.startLine, section.startLine] },
      teaches: [conceptTag('concept:reference-lookup')],
      seconds: SECONDS.reading,
      payload: {},
    })
  );

  // Even stride across the table, so the drill samples the whole thing rather than its head.
  const stride = Math.max(1, Math.floor(rows.length / DRILL_PROMPTS));
  const promptRows = rows.filter((_, i) => i % stride === 0).slice(0, DRILL_PROMPTS);

  atoms.push(
    makeInstructions({
      module,
      corpus: corpus.corpus,
      heading: section.heading,
      idSuffix: 'ref',
      goal: `Look up ${promptRows.length} Event IDs in the ${section.heading} table as fast as you can read.`,
      use: 'The full table, shown on screen. This is open-book on purpose.',
      doneWhen: 'Each prompt has the right description next to it.',
      source: { path: corpus.path, heading: section.heading, lines: [section.startLine, section.startLine] },
      teaches: [conceptTag('concept:reference-lookup')],
    })
  );

  atoms.push(
    makeAtom({
      id: deterministicId(module.id, corpus.corpus, chanSlug, 'drill'),
      type: 'exercise',
      title: `Lookup drill: ${truncateTitle(section.heading, 50)}`,
      body: 'Open book. Speed, not recall.',
      source: { path: corpus.path, heading: section.heading, lines: [section.startLine, rows.at(-1).line] },
      requires: [channelTag(section.heading), conceptTag('concept:reference-lookup')],
      difficulty: 'intro',
      seconds: Math.min(180, 30 + promptRows.length * 10),
      payload: {
        format: 'lookup-drill',
        table_ref: `${corpus.path}#${section.heading}`,
        columns: section.columns,
        rows: rows.map((r) => {
          const out = { eventId: String(r.eventId) };
          if (r.provider) out.provider = cleanCell(r.provider);
          out.description = rowDescription(r);
          if (r.filter) out.filter = cleanCell(r.filter);
          return out;
        }),
        prompts: promptRows.map((r) => ({ ask: `Event ID ${r.eventId}`, answer: rowDescription(r) })),
      },
    })
  );

  atoms.push(makeRowQuiz({ module, corpus, heading: section.heading, rows: promptRows, idSuffix: 'ref' }));

  return finalizeLesson({
    module,
    id: deterministicId(module.id, corpus.corpus, chanSlug, 'reference'),
    title: `${section.heading} (${corpus.corpus}) — reference`,
    summary: `${rows.length} Event IDs in the ${section.heading} channel: a lookup table to work from, not a deck to memorise.`,
    atoms,
    provenanceBase,
  });
}


function buildSmallChannelLessons({ module, corpus, rows, provenanceBase, evidence, opts, eligibleCards, cardSeen, wildcards = [] }) {
  const chunks = chunkEvenly(rows, CARDS_PER_LESSON);
  const dupKeys = duplicateKeys(rows, (r) => r.heading);
  const suffixes = chunkSuffixes(chunks, (r) => `${slug(r.heading)}-e${r.eventId}`);
  return chunks.map((chunkRows, idx) => {
    const part = chunks.length > 1 ? idx + 1 : undefined;
    const suffix = suffixes[idx];
    const channels = [...new Set(chunkRows.map((r) => r.heading))];
    const atoms = [];

    atoms.push(
      makeAtom({
        id: deterministicId(module.id, corpus.corpus, 'small', 'intro', suffix),
        type: 'reading',
        title: 'Smaller channels',
        body:
          `Most Windows log channels contribute only a handful of notable Event IDs. ` +
          `This sitting sweeps ${chunkRows.length} of them across ${channels.length} channel${channels.length === 1 ? '' : 's'} ` +
          `on the ${corpus.corpus} list.`,
        source: { path: corpus.path, lines: [1, 1] },
        teaches: normalizeTags([corpusTag(corpus.corpus), ...channels.map(channelTag)]),
        seconds: SECONDS.reading,
        payload: {},
      })
    );

    for (const row of chunkRows) {
      atoms.push(
        ...makeFlashcards({ module, corpus, heading: row.heading, rows: [row], evidence, eligibleCards, cardSeen, dupKeys })
      );
    }

    // Round-robin so no single sitting absorbs every wholesale channel and blows the
    // 180-420s budget. finalizeLesson still enforces that ceiling.
    for (const w of wildcards.filter((_, i) => i % chunks.length === idx)) {
      atoms.push(
        makeAtom({
          id: deterministicId(module.id, corpus.corpus, slug(w.heading), 'wholesale'),
          type: 'reading',
          title: truncateTitle(w.heading, 60),
          body:
            `**${w.heading}** is collected wholesale: the source list marks it \`*\` rather than ` +
            `naming Event IDs. ${w.description}\n\nThere is nothing to memorise here — what matters ` +
            `is knowing the channel exists and that everything in it is being kept.`,
          source: { path: corpus.path, heading: w.heading },
          teaches: [channelTag(w.heading), corpusTag(corpus.corpus)],
          seconds: 40,
          payload: {},
        })
      );
    }

    atoms.push(
      makeRowQuiz({
        module,
        corpus,
        heading: chunkRows[0].heading,
        rows: chunkRows,
        headingOf: (r) => r.heading,
        idSuffix: `small-${suffix}`,
      })
    );

    const requires = normalizeTags(chunkRows.slice(0, 8).map((r) => eventTag(r.heading, r.eventId)));
    atoms.push(
      makeInstructions({
        module,
        corpus: corpus.corpus,
        heading: 'smaller channels',
        idSuffix: suffix,
        goal: 'Match each Event ID to what it records.',
        use: `The ${chunkRows.length} cards from this sitting.`,
        doneWhen: 'Every ID on the left has a description on the right.',
        source: { path: corpus.path, lines: [1, 1] },
        teaches: [conceptTag('concept:corpus-purpose')],
      })
    );
    atoms.push(
      makeAtom({
        id: deterministicId(module.id, corpus.corpus, 'small', 'match', suffix),
        type: 'exercise',
        title: 'Match: smaller-channel IDs',
        body: 'Every ID below was on the cards you just saw.',
        source: { path: corpus.path, lines: [1, 1] },
        requires,
        difficulty: 'standard',
        seconds: SECONDS.exercise,
        payload: {
          format: 'match',
          pairs: chunkRows.slice(0, 8).map((r) => ({
            left: `${r.heading} ${rowLabel(r, r.heading, dupKeys)}`,
            right: rowDescription(r),
          })),
        },
      })
    );

    return finalizeLesson({
      module,
      id: deterministicId(module.id, corpus.corpus, 'smaller-channels', suffix),
      title: `Smaller channels (${corpus.corpus})${part ? ` — part ${part}` : ''}`,
      summary: `${chunkRows.length} Event IDs swept from ${channels.length} low-volume channels on the ${corpus.corpus} list.`,
      atoms,
      provenanceBase,
      part,
    });
  });
}


function buildCorpusClassifyLessons({ module, corpora, provenanceBase, taught }) {
  // An event qualifies only if it is taught and appears on exactly one corpus list --
  // otherwise "which list is this on?" has more than one right answer.
  const byEvent = new Map();
  for (const corpus of corpora) {
    for (const section of corpus.sections) {
      for (const row of section.rows) {
        const tag = eventTag(section.heading, row.eventId);
        if (!taught.has(tag)) continue;
        if (!byEvent.has(tag)) byEvent.set(tag, { heading: section.heading, eventId: row.eventId, corpora: new Set(), row, path: corpus.path });
        byEvent.get(tag).corpora.add(corpus.corpus);
      }
    }
  }
  const unambiguous = [...byEvent.entries()]
    .filter(([, v]) => v.corpora.size === 1)
    .map(([tag, v]) => ({ tag, ...v, corpus: [...v.corpora][0] }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  if (unambiguous.length < CLASSIFY_ITEMS) return [];

  const buckets = corpora.map((c) => `The ${c.corpus} list`);
  // One lesson per corpus-balanced chunk, capped so the module does not become a drag marathon.
  const selected = [];
  const perCorpus = new Map(corpora.map((c) => [c.corpus, unambiguous.filter((u) => u.corpus === c.corpus)]));
  const maxLessons = 2;
  for (let i = 0; selected.length < CLASSIFY_ITEMS * maxLessons; i += 1) {
    let added = false;
    for (const c of corpora) {
      const list = perCorpus.get(c.corpus);
      if (list[i]) { selected.push(list[i]); added = true; }
      if (selected.length >= CLASSIFY_ITEMS * maxLessons) break;
    }
    if (!added) break;
  }

  const chunks = chunkEvenly(selected, CLASSIFY_ITEMS).filter((c) => c.length >= 4);
  const suffixes = chunkSuffixes(chunks, (i) => `e${i.eventId}`);
  return chunks.map((items, idx) => {
    const part = chunks.length > 1 ? idx + 1 : undefined;
    const suffix = suffixes[idx];
    const atoms = [];

    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'classify', 'intro', suffix),
        type: 'reading',
        title: 'Which list is it on?',
        body:
          'Knowing an Event ID is half of it. The other half is knowing whether your SIEM already ' +
          'alerts on it, merely scores it, or only keeps it for the reconstruction afterwards — ' +
          'because that decides whether the alert in front of you is the whole story.',
        source: { path: corpora[0].path, lines: [1, 1] },
        teaches: [conceptTag('concept:corpus-membership')],
        seconds: SECONDS.reading,
        payload: {},
      })
    );
    atoms.push(
      makeInstructions({
        module,
        corpus: 'classify',
        heading: 'list membership',
        idSuffix: suffix,
        goal: 'Drop each Event ID onto the list it belongs to.',
        use: 'The three list descriptions from the opening sitting, and the cards you have reviewed since.',
        doneWhen: 'Every ID sits under one of the three lists.',
        source: { path: corpora[0].path, lines: [1, 1] },
        teaches: [conceptTag('concept:corpus-membership')],
        stepUp: 'This one pulls from every channel you have seen so far, not just the last sitting.',
      })
    );
    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'classify', 'drag', suffix),
        type: 'exercise',
        title: 'Sort Event IDs onto their list',
        body: 'Sigma alerts on it, Risk scores it, Forensics keeps it.',
        source: { path: corpora[0].path, lines: [1, 1] },
        requires: normalizeTags([
          conceptTag('concept:corpus-membership'),
          conceptTag('concept:corpus-purpose'),
          ...items.map((i) => i.tag),
        ]),
        difficulty: 'step-up',
        seconds: Math.min(180, 30 + items.length * 8),
        payload: {
          format: 'drag-classify',
          buckets,
          items: items.map((i) => ({ label: `${i.heading} ${i.eventId}`, bucket: `The ${i.corpus} list` })),
        },
      })
    );
    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'classify', 'quiz', suffix),
        type: 'quiz',
        title: 'List membership',
        body: 'Inline feedback, no results page.',
        source: { path: items[0].path, heading: items[0].heading, lines: [items[0].row.line, items[0].row.line] },
        requires: [items[0].tag, conceptTag('concept:corpus-membership')],
        seconds: SECONDS.quiz,
        payload: {
          format: 'multiple-choice',
          question: `${items[0].heading} Event ID ${items[0].eventId} — which list is it on?`,
          choices: buckets,
          answer_index: buckets.indexOf(`The ${items[0].corpus} list`),
          rationale: `${items[0].path}#${items[0].heading} is where this ID is listed.`,
        },
      })
    );

    return finalizeLesson({
      module,
      id: deterministicId(module.id, 'list-membership', suffix),
      title: `Which list is it on?${part ? ` — part ${part}` : ''}`,
      summary: 'Sort Event IDs by whether the SIEM alerts on them, scores them, or only keeps them for forensics.',
      atoms,
      provenanceBase,
      part,
    });
  });
}


function buildActionEventLessons({ module, pairs, provenanceBase, taught, headingsByEvent, exerciseSetId, note }) {
  // section 6.6 by construction: an action -> event pair is only usable once every Event ID
  // it names has actually been taught. Dropped pairs are reported, never silently skipped.
  const usable = [];
  const dropped = [];
  for (const pair of pairs) {
    const resolved = pair.event_ids.map((id) => resolveTaughtEvent(pair.channel, id, taught, headingsByEvent));
    if (resolved.every(Boolean)) {
      usable.push({
        ...pair,
        tags: resolved.map((r) => r.tag),
        taughtChannel: resolved[0].heading,
      });
    } else {
      dropped.push({
        action: pair.action,
        missing: pair.event_ids.filter((_, i) => !resolved[i]).map((id) => `${pair.channel} ${id}`),
      });
    }
  }
  if (dropped.length) {
    note(
      `${dropped.length}/${pairs.length} lab action→event pairs held back: their Event IDs are not ` +
        `taught by any preceding atom (requires ⊆ teaches). Examples: ` +
        dropped.slice(0, 3).map((d) => `${d.action} [${d.missing.join(', ')}]`).join('; ')
    );
  }
  if (usable.length < 4) {
    note('Not enough taught lab pairs to build an action→event lesson.');
    return [];
  }

  const chunks = chunkEvenly(usable, PAIR_ITEMS).filter((c) => c.length >= 3);
  const suffixes = chunkSuffixes(chunks, (i) => `e${i.event_ids[0]}`);
  return chunks.map((items, idx) => {
    const part = chunks.length > 1 ? idx + 1 : undefined;
    const suffix = suffixes[idx];
    const buckets = [...new Set(items.map((i) => `${i.taughtChannel} ${i.event_ids.join(', ')}`))];
    const atoms = [];

    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'action-event', 'intro', suffix),
        type: 'reading',
        title: 'What the attacker did, what the log said',
        body:
          'These pairs come from the lab telemetry generators in the source knowledge base. Each block ' +
          'there is labelled with the action it performs and the Event ID that action produces — ' +
          'ground truth, written by whoever wrote the generator.\n\n' +
          'Reading an alert backwards, from Event ID to action, is the whole job on a triage queue.',
        source: { path: items[0].source.path, lines: [items[0].source.lines[0], items[0].source.lines[1]] },
        teaches: [conceptTag('concept:action-to-event')],
        seconds: 50,
        payload: {},
      })
    );
    atoms.push(
      makeInstructions({
        module,
        corpus: 'lab',
        heading: 'action to event',
        idSuffix: suffix,
        goal: 'Drop each action onto the Event ID it produces.',
        use: `The Event ID cards you have already reviewed, plus the ground-truth pairs in ${exerciseSetId}.`,
        doneWhen: 'Every action sits under an Event ID.',
        source: { path: items[0].source.path, lines: [items[0].source.lines[0], items[0].source.lines[1]] },
        teaches: [conceptTag('concept:action-to-event')],
      })
    );
    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'action-event', 'drag', suffix),
        type: 'exercise',
        title: 'Action → Event ID',
        body: 'Ground truth from the lab generators. No trick answers.',
        source: { path: items[0].source.path, lines: [items[0].source.lines[0], items.at(-1).source.lines[1]] },
        requires: normalizeTags([conceptTag('concept:action-to-event'), ...items.flatMap((i) => i.tags)]),
        difficulty: 'standard',
        seconds: Math.min(180, 30 + items.length * 10),
        payload: {
          format: 'drag-classify',
          buckets,
          items: items.map((i) => ({
            label: i.scope ? `${i.action} (on a ${i.scope === 'dc' ? 'domain controller' : 'target system'})` : i.action,
            bucket: `${i.taughtChannel} ${i.event_ids.join(', ')}`,
          })),
        },
      })
    );
    atoms.push(
      makeAtom({
        id: deterministicId(module.id, 'action-event', 'quiz', suffix),
        type: 'quiz',
        title: 'Read it backwards',
        body: 'Inline feedback, no results page.',
        source: { path: items[0].source.path, lines: [items[0].source.lines[0], items[0].source.lines[1]] },
        requires: normalizeTags([conceptTag('concept:action-to-event'), ...items[0].tags]),
        seconds: SECONDS.quiz,
        payload: (() => {
          const choices = pickDistinctChoices(
            items[0].action,
            [...items, ...usable].map((i) => i.action)
          ).sort((a, b) => a.localeCompare(b));
          return {
          format: 'multiple-choice',
          question: `${items[0].taughtChannel} ${items[0].event_ids.join(', ')} just fired. Which action produced it?`,
          choices,
          answer_index: choices.indexOf(items[0].action),
          rationale: `${items[0].source.path}:${items[0].source.lines[0]} labels this block “${items[0].action}”.`,
          };
        })(),
      })
    );

    return finalizeLesson({
      module,
      id: deterministicId(module.id, 'action-to-event', suffix),
      title: `Action → Event ID${part ? ` — part ${part}` : ''}`,
      summary: 'Ground-truth pairs from the lab telemetry generators: what someone did, and what the log recorded.',
      atoms,
      provenanceBase,
      part,
    });
  });
}


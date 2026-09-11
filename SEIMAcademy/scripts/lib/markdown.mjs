/**
 * Markdown section + table parser for the Notable-Event-IDs corpus.
 *
 * Header-driven, never positional: the three source documents use five different
 * column layouts (`EventID | Description`, `... | Filter`, `... | ProviderName | ...`,
 * `Provider Name`, `Recommended Filter`), so columns are located by normalized
 * header name and a table whose headers are unrecognized is reported, not guessed at.
 */

// Deliberately unambiguous: one greedy tail, trailing hashes/space stripped linearly.
// The previous form (/^(#{1,6})\s+(.*?)\s*#*\s*$/) let four quantifiers compete for the
// same whitespace run, which backtracks superlinearly on a long crafted line.
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const stripHeadingTail = (text) => text.replace(/[ \t]*#*[ \t]*$/, '').trim();

/** Split a document into `##`-level (or deeper) sections with 1-based line spans. */
export function parseSections(lines, { minLevel = 2 } = {}) {
  const sections = [];
  let current = null;
  let inFence = false;

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const m = inFence ? null : line.match(HEADING_RE);
    if (m && m[1].length <= minLevel) {
      if (current) current.endLine = i; // previous line, 1-based
      current = { heading: stripHeadingTail(m[2]), level: m[1].length, startLine: i + 1, endLine: lines.length, body: [] };
      sections.push(current);
      return;
    }
    if (current) current.body.push(line);
  });

  // Preamble (everything before the first heading) is returned as a nameless section.
  const firstStart = sections.length ? sections[0].startLine : lines.length + 1;
  const preamble = {
    heading: null,
    level: 0,
    startLine: 1,
    endLine: Math.max(1, firstStart - 1),
    body: lines.slice(0, firstStart - 1),
  };
  return { preamble, sections };
}

// One character class, no overlapping quantifiers -- the previous form let two
// [\s:|-]* runs split the same dashes O(n^2) ways.
const SEPARATOR_ONLY = /^[\s:|-]+$/;
const SEPARATOR_RE = { test: (line) => { const t = line.trim(); return t.includes('-') && SEPARATOR_ONLY.test(t); } };

function splitRow(line) {
  // Trim the outer pipes, then split on unescaped pipes.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cur = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

const COLUMN_ALIASES = new Map([
  ['eventid', 'eventId'],
  ['event id', 'eventId'],
  ['providername', 'provider'],
  ['provider name', 'provider'],
  ['description', 'description'],
  ['filter', 'filter'],
  ['recommended filter', 'filter'],
]);

/**
 * Extract every pipe table in a section.
 * `startLine` is the 1-based document line of the section's first body line, so
 * every emitted row carries a real document line number for the `source.lines` field.
 */
export function parseTables(bodyLines, startLine) {
  const tables = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (!/^\s*\|/.test(line) || !bodyLines[i + 1] || !SEPARATOR_RE.test(bodyLines[i + 1])) {
      i += 1;
      continue;
    }
    const rawHeaders = splitRow(line);
    const columns = rawHeaders.map((h) => COLUMN_ALIASES.get(h.toLowerCase()) ?? null);
    const unknown = rawHeaders.filter((h, idx) => columns[idx] === null && h !== '');
    const headerLine = startLine + i;
    const rows = [];
    const wildcardRows = [];
    const rejectedRows = [];
    i += 2;
    while (i < bodyLines.length && /^\s*\|/.test(bodyLines[i])) {
      const raw = bodyLines[i];
      i += 1;
      // Two documents repeat the header (and its separator) partway down a table.
      // Skip both rather than emitting "EventID" and ":-:" as if they were data.
      if (SEPARATOR_RE.test(raw)) continue;
      const cells = splitRow(raw);
      if (cells.every((c) => c === '' || COLUMN_ALIASES.has(c.toLowerCase()))) continue;

      const row = { line: startLine + i - 1 };
      columns.forEach((col, idx) => {
        if (col) row[col] = (cells[idx] ?? '').trim();
      });
      const rawId = row.eventId ?? '';
      if (rawId === '') continue;
      // "*" is not a malformed Event ID -- it is a channel-level directive meaning
      // "collect everything from this channel". Kept separate so no downstream code sees
      // a row without an Event ID, and so the channel is not silently lost.
      if (rawId === '*') {
        wildcardRows.push({ ...row, eventId: null, eventIdRaw: rawId, wildcard: true });
        continue;
      }
      // Some cells hold several IDs for one description -- "8193, 8194", "8 15, 16, 33".
      // Each becomes its own row; anything non-numeric (e.g. a "*" wildcard) is rejected
      // and reported rather than silently turned into an atom.
      if (!/^[\d\s,]+$/.test(rawId)) {
        rejectedRows.push({ line: row.line, eventId: rawId, reason: 'non-numeric-event-id' });
        continue;
      }
      const ids = rawId.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger);
      if (ids.length === 0) {
        rejectedRows.push({ line: row.line, eventId: rawId, reason: 'no-event-id' });
        continue;
      }
      // "8193, 8194" is an unambiguous list. "8 15, 16, 33" mixes a bare space with
      // commas and most likely means a comma is missing -- same shape, very different
      // confidence, so it is surfaced separately rather than guessed at silently.
      const mixedSeparator = ids.length > 1 && /\d\s+\d/.test(rawId.trim());
      for (const id of ids) {
        rows.push({ ...row, eventId: id, eventIdRaw: rawId, split: ids.length > 1, mixedSeparator });
      }
    }
    tables.push({ headerLine, rawHeaders, columns, unknownColumns: unknown, rows, wildcardRows, rejectedRows });
  }
  return tables;
}

/** First non-empty, non-list, non-fence prose line of a block -- used for corpus summaries. */
export function firstProseLine(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('-') || t.startsWith('|') || t.startsWith('```') || t.startsWith('#')) continue;
    return t;
  }
  return '';
}

/** Collapse a source cell into safe single-line prose for an atom body/payload. */
export function cleanCell(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^`+|`+$/g, '')
    .trim();
}

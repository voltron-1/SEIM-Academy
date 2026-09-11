/**
 * Decision B -- Lab generators as exercise data. PARSE-ONLY.
 *
 * =====================================================================================
 *  HARD SAFETY CONSTRAINT (app-data-schema.md section 0)
 *
 *  Lab/Generate-Suspicious-Activity*.ps1 are LIVE TELEMETRY GENERATORS written for a
 *  throwaway lab domain. They create users, add accounts to Domain Admins, register
 *  services and scheduled tasks, and clear event logs.
 *
 *  This module reads them as UTF-8 TEXT and looks at COMMENT LINES ONLY. It must never
 *  execute them. It deliberately imports no child_process, no vm, and no shell: the file
 *  below is a pure string function, and that is the property to preserve in review.
 *  Every non-comment line is discarded before anything else happens.
 * =====================================================================================
 *
 * Two label shapes appear in the corpus:
 *
 *   Generate-Suspicious-Activity.ps1        # Create Local User (Security 4720)
 *   Generate-Suspicious-Activity-Sigma.ps1  # title: Possible DC Shadow Attack
 *                                           # id: 32e19d25-... (Security 4742, 5136)
 *
 * In the second shape the useful action label is the preceding `title:` line, so an
 * `id:`/`sid:` label looks back for the nearest title within TITLE_LOOKBACK lines.
 *
 * Generate-Suspicious-Activity-lolbins.ps1 labels its blocks with ATT&CK technique IDs
 * (`# Bitsadmin.exe T1105`) and carries no Event IDs. It correctly yields zero pairs;
 * that is not a parse failure.
 */

const COMMENT_RE = /^\s*#+\s?(.*)$/;
// The channel group deliberately excludes the space from its character class and adds
// explicit " word" repeats instead, so it cannot compete with the following \s+ for the
// same characters -- that overlap is what made the old form backtrack quadratically.
const EVENT_SPEC_RE =
  /^(.*?)\(\s*([A-Za-z][A-Za-z0-9/_.+-]*(?: [A-Za-z0-9/_.+-]+)*)\s+(\d+(?:\s*,\s*\d+)*)\s*(?:\bon\s+([A-Za-z][A-Za-z ]*?))?\s*\)\s*\.?\s*$/;
const TITLE_RE = /^s?(?:title)\s*:\s*(.+?)\s*$/i;
const ID_LABEL_RE = /^s?id\s*:\s*[0-9a-fA-F][0-9a-fA-F-]{7,}\s*$/;
const TITLE_LOOKBACK = 12;

/**
 * Command syntax that must never reach generated content (app-data-schema.md 6.10).
 * Exported so validate-content.mjs enforces the SAME rule -- three drifting copies of
 * this regex is how a safety gate ends up weaker than its own documentation.
 */
export const EXECUTABLE_HINT_RE =
  /(^|\s)(New|Set|Add|Remove|Invoke|Start|Stop|Get|Enable|Disable)-[A-Za-z]|[$][({]|\||;|&&/;

/** Longest comment line worth running the label regex over. */
export const MAX_COMMENT_LENGTH = 512;

function normalizeScope(raw) {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'dc' || s === 'a dc' || s === 'the dc') return 'dc';
  if (s.includes('target')) return 'target-system';
  return undefined;
}

/**
 * Extract `action -> event` ground-truth pairs from a PowerShell generator's comments.
 * @param {string} text  file contents, already read from disk by the caller
 * @param {string} relPath  repo-relative path, recorded as provenance
 * @returns {{pairs: Array, commentLines: number, rejected: Array}}
 */
export function extractEventLabels(text, relPath) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');

  // Step 1: reduce the file to comment text. Everything executable is dropped here.
  const comments = [];
  lines.forEach((line, idx) => {
    const m = line.match(COMMENT_RE);
    if (m) comments.push({ line: idx + 1, text: m[1].trim() });
  });

  const pairs = [];
  const rejected = [];
  const seen = new Set();

  for (let i = 0; i < comments.length; i += 1) {
    const { line, text: comment } = comments[i];
    if (comment.length > MAX_COMMENT_LENGTH) {
      rejected.push({ path: relPath, line, comment: comment.slice(0, 80), reason: 'over-length' });
      continue;
    }
    const spec = comment.match(EVENT_SPEC_RE);
    if (!spec) continue;

    let label = spec[1].trim().replace(/[-:\s]+$/, '').trim();
    const channel = spec[2].trim();
    const eventIds = spec[3].split(',').map((n) => Number(n.trim())).filter(Number.isInteger);
    const scope = normalizeScope(spec[4]);

    // `id: <uuid> (Security 4742, 5136)` -- the real label is the nearest preceding title.
    if (label === '' || ID_LABEL_RE.test(label)) {
      let title = '';
      for (let back = i - 1; back >= 0 && i - back <= TITLE_LOOKBACK; back -= 1) {
        const t = comments[back].text.match(TITLE_RE);
        if (t) { title = t[1].trim(); break; }
      }
      if (!title) {
        rejected.push({ path: relPath, line, comment, reason: 'no-action-label' });
        continue;
      }
      label = title;
    }

    if (!label || eventIds.length === 0) {
      rejected.push({ path: relPath, line, comment, reason: 'empty-label-or-ids' });
      continue;
    }
    if (EXECUTABLE_HINT_RE.test(label)) {
      // Belt and braces: a comment that looks like a command never becomes content.
      rejected.push({ path: relPath, line, comment, reason: 'looks-executable' });
      continue;
    }

    const key = `${label.toLowerCase()}|${channel.toLowerCase()}|${eventIds.join(',')}|${scope ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({
      action: label,
      channel,
      event_ids: eventIds,
      ...(scope ? { scope } : {}),
      source: { path: relPath, lines: [line, line] },
    });
  }

  // Stable order: by first source line, so output does not depend on Map iteration.
  pairs.sort((a, b) => a.source.lines[0] - b.source.lines[0]);
  return { pairs, commentLines: comments.length, rejected };
}

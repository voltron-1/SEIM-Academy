"""Independent verification of generated content against the source Markdown.

    python3 SEIMAcademy/scripts/verify-against-source.py

Deliberately does NOT reuse the pipeline's parser -- separate implementation, separate
language -- so a parser bug cannot validate its own output. validate-content.mjs checks
that the content is internally consistent and obeys the schema; this checks that it is
TRUE: every flashcard back, every match pair and every multiple-choice answer is compared
against the source table row it claims to come from.

That distinction is not theoretical. This script found a quiz in the "smaller channels"
lessons that named the wrong log channel for its answer -- schema-valid, internally
consistent, and factually wrong. Run it after any change to the parser or the lesson
builders.

Exits non-zero on any mismatch.
"""
import json, os, re, sys, collections

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.environ.get('SEIM_SOURCE_REPO') or os.path.join(os.path.dirname(REPO), 'SIEM')
GEN = os.path.join(REPO, 'SEIMAcademy', 'content')
DOCS = {'sigma': 'Logging/Notable-Event-IDs-Sigma.md',
        'risk': 'Logging/Notable-Event-IDs-Risk.md',
        'forensics': 'Logging/Notable-Event-IDs-Forensics.md'}

def slug(v):
    return re.sub(r'-{2,}', '-', re.sub(r'[^a-z0-9]+', '-', str(v).lower()).strip('-'))

def norm(v):
    return re.sub(r'\s+', ' ', (v or '')).strip().strip('`')

# --- independent parse ------------------------------------------------------------------
truth = {}          # (corpus, channel_slug, eventid) -> set of descriptions
channels = collections.defaultdict(set)
for corpus, rel in DOCS.items():
    heading, cols = None, None
    for raw in open(os.path.join(SRC, rel), encoding='utf-8').read().replace('\r\n', '\n').split('\n'):
        line = raw.rstrip()
        if line.startswith('## '):
            heading, cols = line[3:].strip(), None
            continue
        if not line.startswith('|') or heading is None:
            continue
        cells = [norm(c) for c in line.strip().strip('|').split('|')]
        low = [c.lower() for c in cells]
        if 'eventid' in low or 'event id' in low:
            cols = low
            continue
        if set(''.join(cells)) <= set(':- '):
            continue
        if cols is None:
            continue
        row = dict(zip(cols, cells))
        rawid = row.get('eventid') or row.get('event id') or ''
        if not re.fullmatch(r'[\d\s,]+', rawid or ''):
            continue
        desc = row.get('description', '')
        prov = row.get('providername') or row.get('provider name') or ''
        for eid in [int(x) for x in re.split(r'[\s,]+', rawid) if x]:
            truth.setdefault((corpus, slug(heading), eid), set()).add(desc or prov or f'Event {eid}')
            channels[corpus].add(slug(heading))

# --- compare ----------------------------------------------------------------------------
stats = collections.Counter()
problems = []
for fn in sorted(os.listdir(os.path.join(GEN, 'lessons'))):
    lesson = json.load(open(os.path.join(GEN, 'lessons', fn), encoding='utf-8'))
    corpus = next((t.split(':')[1] for a in lesson['atoms'] for t in a.get('teaches', []) if t.startswith('corpus:')), None)
    for atom in lesson['atoms']:
        if atom['type'] == 'flashcard':
            stats['flashcards'] += 1
            tag = next(t for t in atom['teaches'] if t.startswith('event:'))
            _, chan, eid = tag.split(':'); eid = int(eid)
            key = (corpus, chan, eid)
            if key not in truth:
                problems.append(f"{atom['id']}: {tag} not found in {corpus} source"); continue
            if norm(atom['payload']['back']) not in {norm(d) for d in truth[key]}:
                problems.append(f"{atom['id']}: back={atom['payload']['back']!r} not a source description for {tag}")
            else:
                stats['flashcards_verified'] += 1
            if f'Event ID {eid}' not in atom['payload']['front']:
                problems.append(f"{atom['id']}: front does not name Event ID {eid}")
        elif atom['type'] == 'quiz' and atom['payload'].get('format') == 'multiple-choice':
            stats['quizzes'] += 1
            p = atom['payload']
            if not (0 <= p['answer_index'] < len(p['choices'])):
                problems.append(f"{atom['id']}: answer_index out of range"); continue
            ans = p['choices'][p['answer_index']]
            m = re.search(r'which Event ID records: “(.+)”', p['question'])
            if m and ans.isdigit():
                chan = slug(atom['source'].get('heading', ''))
                key = (corpus, chan, int(ans))
                if key not in truth or norm(m.group(1)) not in {norm(d) for d in truth[key]}:
                    problems.append(f"{atom['id']}: answer {ans} does not record {m.group(1)!r} in source")
                else:
                    stats['quizzes_verified'] += 1
            else:
                stats['quizzes_other_form'] += 1
        elif atom['type'] == 'exercise' and atom['payload'].get('format') == 'match':
            for pair in atom['payload']['pairs']:
                stats['match_pairs'] += 1
                m = re.match(r'^(?:(.*) )?(\d+)(?: \(.*\))?$', pair['left'])
                if not m: problems.append(f"{atom['id']}: unparsable match left {pair['left']!r}"); continue
                chan = slug(m.group(1)) if m.group(1) else slug(atom['source'].get('heading', ''))
                key = (corpus, chan, int(m.group(2)))
                if key not in truth:
                    problems.append(f"{atom['id']}: match left {pair['left']!r} -> no source row"); continue
                if norm(pair['right']) not in {norm(d) for d in truth[key]}:
                    problems.append(f"{atom['id']}: match {pair['left']!r} -> {pair['right']!r} not in source")
                else:
                    stats['match_pairs_verified'] += 1

print('source rows parsed independently:', sum(len(v) for v in truth.values()))
for k in ['flashcards', 'flashcards_verified', 'quizzes', 'quizzes_verified', 'quizzes_other_form', 'match_pairs', 'match_pairs_verified']:
    print(f'  {k:24} {stats[k]}')
print('\nMISMATCHES:', len(problems))
for pr in problems[:15]:
    print('  -', pr)
sys.exit(1 if problems else 0)

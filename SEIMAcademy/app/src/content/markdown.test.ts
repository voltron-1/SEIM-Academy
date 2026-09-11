import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, isSafeHref, plainText } from './markdown.js';

test('a paragraph is one block with joined lines', () => {
  const blocks = parseMarkdown('first line\nsecond line');
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], { t: 'p', v: [{ t: 'text', v: 'first line second line' }] });
});

test('bold and inline code parse', () => {
  const [block] = parseMarkdown('the **Security** channel logs `4624`');
  assert.deepEqual(block, {
    t: 'p',
    v: [
      { t: 'text', v: 'the ' },
      { t: 'strong', v: [{ t: 'text', v: 'Security' }] },
      { t: 'text', v: ' channel logs ' },
      { t: 'code', v: '4624' },
    ],
  });
});

test('backticks are literal inside a code span', () => {
  const [block] = parseMarkdown('`**not bold**`');
  assert.deepEqual(block, { t: 'p', v: [{ t: 'code', v: '**not bold**' }] });
});

test('a fenced block keeps its newlines and is never parsed as prose', () => {
  const blocks = parseMarkdown('intro\n\n```\nindex=wineventlog **raw**\nline two\n```\n\nafter');
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[1], { t: 'pre', v: 'index=wineventlog **raw**\nline two' });
  assert.deepEqual(blocks[2], { t: 'p', v: [{ t: 'text', v: 'after' }] });
});

test('a blank line inside a fence does not split it', () => {
  const [block] = parseMarkdown('```\na\n\nb\n```');
  assert.deepEqual(block, { t: 'pre', v: 'a\n\nb' });
});

test('unordered lists collect their items', () => {
  const [block] = parseMarkdown('- one\n- two\n* three');
  assert.deepEqual(block, {
    t: 'ul',
    items: [[{ t: 'text', v: 'one' }], [{ t: 'text', v: 'two' }], [{ t: 'text', v: 'three' }]],
  });
});

test('repo-relative links are permitted', () => {
  assert.ok(isSafeHref('Logging/Notable-Event-IDs-Sigma.md'));
  assert.ok(isSafeHref('Logging/Notable-Event-IDs-Sigma.md#Security'));
  const [block] = parseMarkdown('see [the list](Logging/Notable-Event-IDs-Risk.md)');
  assert.equal(block!.t, 'p');
  assert.deepEqual((block as any).v[1], {
    t: 'link',
    href: 'Logging/Notable-Event-IDs-Risk.md',
    v: [{ t: 'text', v: 'the list' }],
  });
});

test('a link with a scheme renders as text and is never followed', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>',
    'http://example.com',
    '//example.com',
    'vbscript:x',
  ]) {
    assert.equal(isSafeHref(href), false, `${href} must be refused`);
    const [block] = parseMarkdown(`[click](${href})`);
    const kinds = (block as any).v.map((n: any) => n.t);
    assert.ok(!kinds.includes('link'), `${href} produced a link node`);
    assert.equal(plainText(parseMarkdown(`[click](${href})`)).includes('click'), true,
      'the text is shown literally rather than dropped');
  }
});

test('markup that is not in the subset survives as literal text', () => {
  // The content pipeline already rejects real tags. If one ever arrives, it must render
  // as characters on screen, not as an element.
  const text = plainText(parseMarkdown('Session <X> disconnected by <Y>'));
  assert.equal(text, 'Session <X> disconnected by <Y>');
});

test('an unterminated construct does not lose content', () => {
  assert.equal(plainText(parseMarkdown('**unclosed bold')), '**unclosed bold');
  assert.equal(plainText(parseMarkdown('`unclosed code')), '`unclosed code');
  assert.equal(plainText(parseMarkdown('[label](')), '[label](');
});

test('empty and whitespace bodies produce no blocks', () => {
  assert.deepEqual(parseMarkdown(''), []);
  assert.deepEqual(parseMarkdown('   \n\n  '), []);
});

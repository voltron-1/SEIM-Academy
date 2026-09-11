/**
 * Parser for the Markdown subset permitted in an atom `body`.
 *
 * app-data-schema.md §7 is normative and §6.10 backs it at build time, but the renderer
 * carries the real obligation: **parse with raw HTML disabled, treat every payload string
 * as text.** So this returns a small AST that the renderer turns into Preact nodes, and it
 * never produces an HTML string. There is no `innerHTML` anywhere in the path, which means
 * there is no configuration anyone can get wrong later.
 *
 * A general Markdown library would be more capable and would also accept far more than the
 * schema allows — including raw HTML, on by default in several popular parsers. The
 * permitted subset is small enough to parse directly, so it is parsed directly and there
 * is no Markdown dependency in the critical path.
 *
 * Permitted: **bold**, `code`, fenced code blocks, unordered lists, and links whose target
 * is repo-relative. Everything else renders as literal text rather than being dropped —
 * losing a learner's content is worse than showing an unstyled asterisk.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; v: Inline[] };

export type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'pre'; v: string };

/**
 * Repo-relative only. Anything with a scheme — `javascript:`, `data:`, `http:` — or a
 * protocol-relative `//host` is refused and the link renders as plain text. The build-time
 * check in the content pipeline should already have rejected such a string; this is the
 * second lock on the same door.
 */
const SAFE_HREF = /^(?!\/\/)(?![a-zA-Z][a-zA-Z0-9+.-]*:)[A-Za-z0-9._~\-/#]+$/;

export const isSafeHref = (href: string): boolean => SAFE_HREF.test(href);

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest.length > 0) {
    // Inline code wins over everything: backticks are literal inside a code span.
    const code = rest.match(/^`([^`]+)`/);
    if (code) {
      out.push({ t: 'code', v: code[1]! });
      rest = rest.slice(code[0].length);
      continue;
    }
    const strong = rest.match(/^\*\*([^*]+)\*\*/);
    if (strong) {
      out.push({ t: 'strong', v: parseInline(strong[1]!) });
      rest = rest.slice(strong[0].length);
      continue;
    }
    const link = rest.match(/^\[([^\]]*)\]\(([^)\s]+)\)/);
    if (link) {
      const [, label, href] = link;
      if (isSafeHref(href!)) out.push({ t: 'link', href: href!, v: parseInline(label!) });
      else out.push({ t: 'text', v: link[0] }); // shown literally, never followed
      rest = rest.slice(link[0].length);
      continue;
    }
    // Plain run: up to the next character that could start a construct.
    const next = rest.slice(1).search(/[`*[]/);
    const take = next === -1 ? rest.length : next + 1;
    const last = out[out.length - 1];
    if (last?.t === 'text') last.v += rest.slice(0, take);
    else out.push({ t: 'text', v: rest.slice(0, take) });
    rest = rest.slice(take);
  }
  return out;
}

export function parseMarkdown(body: string): Block[] {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ t: 'p', v: parseInline(paragraph.join(' ').trim()) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ t: 'ul', items: list.map((i) => parseInline(i)) });
    list = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (/^\s*```/.test(line)) {
      flushAll();
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) {
        fence.push(lines[i]!);
        i += 1;
      }
      blocks.push({ t: 'pre', v: fence.join('\n') });
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]!);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

/** Flattened text, for aria-labels and for search later. Never used for rendering. */
export function plainText(blocks: Block[]): string {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((n) => (n.t === 'text' || n.t === 'code' ? n.v : inline(n.v)))
      .join('');
  return blocks
    .map((b) => (b.t === 'pre' ? b.v : b.t === 'ul' ? b.items.map(inline).join(' ') : inline(b.v)))
    .join('\n');
}

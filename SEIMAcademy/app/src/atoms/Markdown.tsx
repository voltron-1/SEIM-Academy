import { parseMarkdown, type Block, type Inline } from '../content/markdown';

/**
 * Renders the permitted Markdown subset as Preact nodes.
 *
 * There is no `innerHTML` and no `dangerouslySetInnerHTML` in this file, and no Markdown
 * library behind it. Text reaches the DOM as text nodes, which is the renderer obligation
 * app-data-schema.md §7 makes normative — not a parser setting someone can flip later.
 */

function renderInline(nodes: Inline[]) {
  return nodes.map((node, i) => {
    switch (node.t) {
      case 'strong':
        return <strong key={i}>{renderInline(node.v)}</strong>;
      case 'code':
        return <code key={i}>{node.v}</code>;
      case 'link':
        // Repo-relative by construction — the parser refuses anything with a scheme.
        return (
          <a key={i} href={node.href} rel="noopener noreferrer">
            {renderInline(node.v)}
          </a>
        );
      default:
        return <span key={i}>{node.v}</span>;
    }
  });
}

function renderBlock(block: Block, i: number) {
  switch (block.t) {
    case 'pre':
      return (
        <pre key={i}>
          <code>{block.v}</code>
        </pre>
      );
    case 'ul':
      return (
        <ul key={i}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    default:
      return <p key={i}>{renderInline(block.v)}</p>;
  }
}

export function Markdown({ body }: { body: string }) {
  return <>{parseMarkdown(body).map(renderBlock)}</>;
}

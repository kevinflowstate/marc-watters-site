import { reportBlocks, reportInline } from "@/lib/ops/workspace-presentation";

function InlineText({ text }: { text: string }) {
  return reportInline(text).map((node, i) =>
    node.type === "strong" ? (
      <strong key={i}>{node.text}</strong>
    ) : node.type === "link" ? (
      <a key={i} href={node.href} target="_blank" rel="noreferrer noopener">
        {node.text}
      </a>
    ) : (
      <span key={i}>{node.text}</span>
    ),
  );
}

/** Restricted Markdown only: no HTML interpretation, scripts or embedded media. */
export function ReportText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`ws-reading ${className}`}>
      {reportBlocks(text).map((block, i) => {
        if (block.type === "heading")
          return <h3 key={i}><InlineText text={block.text} /></h3>;
        if (block.type === "list") {
          const items = block.items.map((item, index) => <li key={index}><InlineText text={item} /></li>);
          return block.ordered
            ? <ol key={i} start={block.start}>{items}</ol>
            : <ul key={i}>{items}</ul>;
        }
        return <p key={i}><InlineText text={block.text} /></p>;
      })}
    </div>
  );
}

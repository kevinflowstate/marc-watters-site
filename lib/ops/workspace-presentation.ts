import type { WorkspaceResult } from "./workspace-types";

/** A deliberately small text format. HTML is always text, never markup. */
export type ReportInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };
export type ReportBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; start: number; items: string[] };

export function presentationHref(value: string): string | null {
  if (!value || value !== value.trim() || /[\u0000-\u0020\u007f\\]/.test(value))
    return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function sourceLinkLabel(label: string, href: string): string {
  if (
    label.trim() &&
    !/^(?:source|link|record|document|open|view|https?:\/\/.*)$/i.test(label.trim()) &&
    !/^(?:acct|in|pi|ch|cus)_[a-z\d]+$/i.test(label.trim())
  ) return label;
  if (href.startsWith("/")) return "Open in the portal";
  try {
    const url = new URL(href);
    const host = url.hostname;
    if (host === "dashboard.stripe.com")
      return url.pathname.includes("/invoices/") ? "View invoice in Stripe" : "Open Stripe";
    if (host === "docs.google.com") return "View Google document";
    if (host === "drive.google.com") return "Open in Google Drive";
    if (host === "fathom.video" || host.endsWith(".fathom.video")) return "Open recording in Fathom";
    return `Open ${host.replace(/^www\./, "")}`;
  } catch {
    return label.trim() || "View source";
  }
}

/** Convert supported emphasis and links into data, without interpreting HTML. */
export function reportInline(text: string): ReportInline[] {
  const nodes: ReportInline[] = [];
  const token = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>]+)/g;
  let cursor = 0;
  for (const match of text.matchAll(token)) {
    const at = match.index!;
    if (at > cursor) nodes.push({ type: "text", text: text.slice(cursor, at) });
    if (match[1]) {
      nodes.push({ type: "strong", text: match[1] });
    } else {
      const raw = match[3] || match[4];
      const trailing = match[4] ? raw.match(/[.,;!?]+$/)?.[0] || "" : "";
      const destination = trailing ? raw.slice(0, -trailing.length) : raw;
      const href = presentationHref(destination);
      if (href) {
        nodes.push({ type: "link", text: sourceLinkLabel(match[2] || "", href), href });
        if (trailing) nodes.push({ type: "text", text: trailing });
      } else {
        nodes.push({ type: "text", text: match[0] });
      }
    }
    cursor = at + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: "text", text: text.slice(cursor) });
  return nodes;
}

/** Preserve every line and amount; only the document's structure is interpreted. */
export function reportBlocks(text: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      // A blank line ends a paragraph or list, even if the next block is the same kind.
      blocks.push({ type: "paragraph", text: "" });
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.+?)(?:\s+#+)?$/)
      || line.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }
    const item = line.match(/^(?:([-*•])\s+|(\d+)[.)]\s+)(.+)$/);
    const previous = blocks[blocks.length - 1];
    if (item) {
      const ordered = !!item[2];
      if (previous?.type === "list" && previous.ordered === ordered) previous.items.push(item[3]);
      else blocks.push({ type: "list", ordered, start: ordered ? Number(item[2]) : 1, items: [item[3]] });
    } else if (previous?.type === "paragraph" && previous.text) {
      previous.text += `\n${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  return blocks.filter((block) => block.type !== "paragraph" || block.text);
}

export function readableResultTitle(result: Pick<WorkspaceResult, "title" | "kind">): string {
  return result.title
    .replace(/^Thursday-workflow business report\s*[—–-]\s*manual draft\s*/i, "Weekly business update · ")
    .replace(/^Daily attention brief\s*[—–-]\s*/i, "Daily brief · ")
    .replace(/^Payment exceptions\s*[—–-]\s*/i, "Payment review · ")
    .replace(/\s*[—–-]\s*historical private draft\s*$/i, "")
    .replace(/\s*[—–-]\s*UNAPPROVED\s*$/i, " · draft for review");
}

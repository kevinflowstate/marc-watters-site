import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportText } from "../components/ops/workspace/ReportText";
import {
  presentationHref,
  readableResultTitle,
  reportBlocks,
  reportInline,
  sourceLinkLabel,
} from "../lib/ops/workspace-presentation";

describe("human-readable workspace reports", () => {
  it("renders real headings, paragraphs and lists while preserving figures and missing information", () => {
    const text = "## Payments checked\nInvoices created: £900.00.\n\n**Still missing**\n- Accounting information is not connected.\n- No invoices were created in this account during 2–4 November.\n\n**Eimear’s next steps**\n1. Check the invoice.\n2. Add your observations.";
    const html = renderToStaticMarkup(createElement(ReportText, { text }));
    expect(html).toContain("<h3><span>Payments checked</span></h3>");
    expect(html).toContain("<h3><span>Still missing</span></h3>");
    expect(html).toContain("<ul>");
    expect(html).toContain('<ol start="1">');
    expect(html).toContain("£900.00");
    expect(html).toContain("No invoices were created");
    expect(html).not.toContain("No money received");
    expect(html).toContain("Accounting information is not connected.");
  });

  it("does not guess the meaning of an unnamed account or alter the original input", () => {
    const text = "second — 2–4 November\nReturned invoices: 0; recorded amount_paid £0.00 GBP.";
    expect(reportBlocks(text)).toEqual([{ type: "paragraph", text }]);
    expect(text).toContain("second");
    expect(reportInline(text).map((node) => node.text).join("")).toBe(text);
  });

  it("keeps separate paragraphs and lists, including non-one numbered list starts", () => {
    expect(reportBlocks("First paragraph\ncontinued.\n\nSecond paragraph.\n\n3. Third step\n4. Fourth step\n\n- A different list")).toEqual([
      { type: "paragraph", text: "First paragraph\ncontinued." },
      { type: "paragraph", text: "Second paragraph." },
      { type: "list", ordered: true, start: 3, items: ["Third step", "Fourth step"] },
      { type: "list", ordered: false, start: 1, items: ["A different list"] },
    ]);
  });

  it("shows meaningful source labels and preserves deliberate labels", () => {
    const url = "https://dashboard.stripe.com/acct_example/invoices/in_example";
    expect(sourceLinkLabel("Source", url)).toBe("View invoice in Stripe");
    expect(sourceLinkLabel("James’s November invoice", url)).toBe("James’s November invoice");
    expect(reportInline(`Invoice paid. Source: ${url}.`)).toEqual([
      { type: "text", text: "Invoice paid. Source: " },
      { type: "link", text: "View invoice in Stripe", href: url },
      { type: "text", text: "." },
    ]);
  });

  it("escapes HTML and rejects executable, credentialled and protocol-relative links", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,test", "//example.com", "/\\example.com", "https://name:password@example.com", "https://example.com/\nnext"]) {
      expect(presentationHref(href)).toBeNull();
    }
    expect(presentationHref("/admin/work?task=test")).toBe("/admin/work?task=test");
    const html = renderToStaticMarkup(createElement(ReportText, {
      text: '<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))\n\n[View invoice](https://example.com/invoice)\n\nStatus: **Needs a review**.',
    }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://example.com/invoice"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain("<strong>Needs a review</strong>");
  });

  it("removes known working jargon from titles without changing their dates or claims", () => {
    expect(readableResultTitle({ kind: "weekly_report", title: "Thursday-workflow business report — manual draft 6 November 2026" }))
      .toBe("Weekly business update · 6 November 2026");
    expect(readableResultTitle({ kind: "sales_review", title: "Paul Duff sales-call review — 19 October 2026 — historical private draft" }))
      .toBe("Paul Duff sales-call review — 19 October 2026");
    expect(readableResultTitle({ kind: "payments", title: "No payment issues found" })).toBe("No payment issues found");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionAvailability,
  ActionResults,
  PaymentReviews,
  contentPostLabel,
} from "../components/admin/AutomationReviewPanels";
import type { ArtifactItem, OpsArtifact } from "../lib/ops/action-types";

const artifact = {
  kind: "content",
  payload: { posts: [
    { post_id: "first", caption: "First caption" },
    { post_id: "second", caption: "Second caption" },
  ] },
} as unknown as OpsArtifact;
const item = (key: string): ArtifactItem => ({
  id: key, artifact_id: "review", item_key: key, status: "pending",
  receipt: null, error: null, started_at: null, finished_at: null,
  updated_at: "2026-11-06T18:00:00Z",
});

describe("prepared work a reviewer can identify correctly", () => {
  it("distinguishes unchecked action settings from confirmed off", () => {
    const unknown = renderToStaticMarkup(createElement(ActionAvailability, { title: "Content scheduling", enabled: null }));
    const off = renderToStaticMarkup(createElement(ActionAvailability, { title: "Content scheduling", enabled: false }));
    const on = renderToStaticMarkup(createElement(ActionAvailability, { title: "Content scheduling", enabled: true }));
    expect(unknown).toContain(">Not checked</span>");
    expect(unknown).not.toContain(">Off</span>");
    expect(off).toContain(">Off</span>");
    expect(on).toContain(">On</span>");
  });

  it("keeps original post numbers when results arrive in another order", () => {
    const html = renderToStaticMarkup(createElement(ActionResults, { artifact, items: [item("second"), item("first")] }));
    expect(html.indexOf("Post 2")).toBeLessThan(html.indexOf("Second caption"));
    expect(html.indexOf("Second caption")).toBeLessThan(html.indexOf("Post 1"));
    expect(html.indexOf("Post 1")).toBeLessThan(html.indexOf("First caption"));
    expect(contentPostLabel(artifact.payload, "second")).toBe("Post 2");
  });

  it("does not attach an unmatched receipt to an arbitrary post", () => {
    const html = renderToStaticMarkup(createElement(ActionResults, { artifact, items: [item("unmatched")] }));
    expect(html).toContain("Post reference needs checking");
    expect(html).not.toMatch(/Post 1|Post 2|First caption|Second caption/);
  });

  it("does not call payment reminders off while their state is unavailable", () => {
    const html = renderToStaticMarkup(createElement(PaymentReviews, { cases: [], remindersEnabled: null }));
    expect(html).toContain("Reminder settings have not been confirmed");
    expect(html).not.toContain("Automatic reminders are off");
    expect(html).toContain("does not confirm that every payment account has been checked");
  });
});

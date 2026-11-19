import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import SessionRegistration from "../components/webinar/SessionRegistration";

afterEach(() => vi.unstubAllGlobals());

function render(now: string, enabled = true) {
  // This repository's Vitest transform uses classic JSX for component imports.
  vi.stubGlobal("React", React);
  return renderToStaticMarkup(React.createElement(SessionRegistration, {
    enabled,
    forms: { "1pm": "lunchtime-form", "7pm": "evening-form" },
    nowMs: Date.parse(now),
  }));
}

it("gives a fresh visitor a useful next step after both sessions close", () => {
  const html = render("2026-12-09T19:00:00Z");
  expect(html).toContain("Registration has closed.");
  expect(html).toContain('href="/book-marc"');
  expect(html).not.toContain("above to save your place");
  expect(html).not.toContain("<iframe");
});

it("still offers the evening choice after the lunchtime session starts", () => {
  const html = render("2026-12-09T13:00:00Z");
  expect(html).not.toContain("Registration has closed.");
  expect(html).toContain("above to save your place");
});

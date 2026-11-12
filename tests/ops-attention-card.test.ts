import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpsTask } from "../lib/ops/types";

const fixture = vi.hoisted(() => ({ tasks: null as OpsTask[] | null, failed: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: () => undefined,
    // tasks starts null, failed starts false: tell them apart by the initial value.
    useState: (initial: unknown) => [typeof initial === "boolean" ? fixture.failed : fixture.tasks, () => undefined],
  };
});

import AttentionCard from "../components/ops/AttentionCard";

const task = (status: OpsTask["status"], kind: OpsTask["kind"] = "approval") =>
  ({ status, kind }) as OpsTask;
// The counts render as chips; compare the visible text with the tags stripped.
const render = () =>
  renderToStaticMarkup(createElement(AttentionCard))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("dashboard work counts", () => {
  beforeEach(() => { fixture.tasks = null; fixture.failed = false; });

  it("keeps requested changes open without claiming another approval is needed", () => {
    fixture.tasks = [task("rejected")];
    expect(render()).toContain("1 open 0 approvals 0 flags");
  });

  it("counts pending decisions separately from approved work and ordinary flags", () => {
    fixture.tasks = [
      task("awaiting_approval"), task("approved"), task("rejected"),
      task("open", "flag"), task("done"), task("cancelled"),
    ];
    expect(render()).toContain("4 open 1 approval 1 flag");
  });

  it("distinguishes loading, an empty checked queue and unavailable work", () => {
    expect(render()).toContain("Loading...");
    expect(render()).not.toContain("Work queue unavailable");
    fixture.failed = true;
    expect(render()).toContain("Work queue unavailable");
    fixture.failed = false;
    fixture.tasks = [];
    expect(render()).toContain("0 open 0 approvals 0 flags");
  });
});

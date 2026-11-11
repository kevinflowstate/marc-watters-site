import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OpsTask } from "../lib/ops/types";

const fixture = vi.hoisted(() => ({ tasks: null as OpsTask[] | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: () => undefined,
    useState: () => [fixture.tasks, () => undefined],
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
  beforeEach(() => { fixture.tasks = null; });

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

  it("distinguishes an empty checked queue from unavailable work", () => {
    expect(render()).toContain("Work queue unavailable");
    fixture.tasks = [];
    expect(render()).toContain("0 open 0 approvals 0 flags");
  });
});

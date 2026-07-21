import { describe, expect, it } from "vitest";
import {
  appendPlanItem,
  commitPlanItemDrafts,
  countPlanItems,
} from "../lib/business-plan-drafts";
import type { BusinessPlanPhase } from "../lib/types";

function phase(items: string[] = []): BusinessPlanPhase {
  return {
    id: "phase-1",
    name: "Phase 1",
    notes: "",
    order_index: 0,
    linked_trainings: [],
    items: items.map((title, index) => ({
      id: `existing-${index}`,
      category: "Phase 1",
      title,
      completed: false,
    })),
  };
}

describe("business plan action item drafts", () => {
  it("retains five sequentially added action items", () => {
    let phases = [phase()];

    for (let index = 1; index <= 5; index += 1) {
      phases = appendPlanItem(phases, "phase-1", `Action ${index}`, () => `new-${index}`);
    }

    expect(phases[0].items.map((item) => item.title)).toEqual([
      "Action 1",
      "Action 2",
      "Action 3",
      "Action 4",
      "Action 5",
    ]);
    expect(countPlanItems(phases)).toBe(5);
  });

  it("commits unfinished text when the plan is saved", () => {
    const phases = commitPlanItemDrafts(
      [phase(["Existing 1", "Existing 2", "Existing 3"])],
      { "phase-1": "  Final pending action  " },
      () => "pending-4",
    );

    expect(phases[0].items).toHaveLength(4);
    expect(phases[0].items[3]).toMatchObject({
      id: "pending-4",
      title: "Final pending action",
      completed: false,
    });
  });

  it("does not add empty drafts", () => {
    const original = [phase(["Existing"])];
    const phases = commitPlanItemDrafts(original, { "phase-1": "   " });

    expect(phases).toEqual(original);
    expect(countPlanItems(phases)).toBe(1);
  });
});

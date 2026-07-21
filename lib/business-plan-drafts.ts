import type { BusinessPlanItem, BusinessPlanPhase } from "./types";

export type PlanItemDrafts = Record<string, string>;

export function appendPlanItem(
  phases: BusinessPlanPhase[],
  phaseId: string,
  title: string,
  createId: () => string = () => crypto.randomUUID(),
): BusinessPlanPhase[] {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return phases;

  return phases.map((phase) => {
    if (phase.id !== phaseId) return phase;

    const item: BusinessPlanItem = {
      id: createId(),
      category: phase.name,
      title: trimmedTitle,
      completed: false,
    };

    return { ...phase, items: [...phase.items, item] };
  });
}

export function commitPlanItemDrafts(
  phases: BusinessPlanPhase[],
  drafts: PlanItemDrafts,
  createId: () => string = () => crypto.randomUUID(),
): BusinessPlanPhase[] {
  return phases.map((phase) => {
    const title = drafts[phase.id]?.trim();
    if (!title) return phase;

    const item: BusinessPlanItem = {
      id: createId(),
      category: phase.name,
      title,
      completed: false,
    };

    return { ...phase, items: [...phase.items, item] };
  });
}

export function countPlanItems(phases: BusinessPlanPhase[]): number {
  return phases.reduce((total, phase) => total + phase.items.length, 0);
}

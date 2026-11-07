"use client";

import { useEffect, useState } from "react";
import { needsApproval } from "@/lib/ops/workspace";
import type { OpsTask } from "@/lib/ops/types";

/** Approvals waiting for Marc or Eimear, for the nav badge. Non-critical UI state. */
export function useWorkspaceDecideCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/work", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { tasks?: OpsTask[] };
        if (!cancelled) setCount((data.tasks || []).filter(needsApproval).length);
      } catch {
        // The badge is a convenience; the page itself reports errors.
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return count;
}

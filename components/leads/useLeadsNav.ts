"use client";

import { useEffect, useState } from "react";

/** Whether this admin can see the Leads tab, and how many Instagram DMs are waiting. */
export function useLeadsNav() {
  const [state, setState] = useState({ access: false, waiting: 0 });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/leads/count", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setState({ access: Boolean(body.access), waiting: Number(body.waiting) || 0 });
      } catch {
        // Non-critical UI state
      }
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  return state;
}

"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";

export function useManagementRole() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      try {
        const response = await fetch("/api/portal/me");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && ["admin", "growth_operator"].includes(data.role)) {
          setRole(data.role);
        }
      } catch {
        // Middleware and server APIs remain the security boundary.
      }
    }
    loadRole();
    return () => { cancelled = true; };
  }, []);

  return role;
}

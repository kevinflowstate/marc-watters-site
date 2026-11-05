"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isClosed } from "@/lib/ops/workspace";
import type { OpsTask } from "@/lib/ops/types";
export default function AttentionCard() {
  const [tasks, setTasks] = useState<OpsTask[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/admin/work")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setTasks(d.tasks);
        })
        .catch(() => {});
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  const open = tasks?.filter((t) => !isClosed(t));
  return (
    <div className="v2-surface p-5 mb-6">
      <Link
        href="/admin/work"
        className="font-heading font-bold text-accent-bright"
      >
        Open your workspace →
      </Link>
      <p className="text-text-secondary text-sm mt-2">
        {open
          ? `${open.length} open · ${open.filter((t) => t.kind === "approval").length} approvals · ${open.filter((t) => t.kind === "flag").length} flags`
          : "Work queue unavailable"}
      </p>
      <div className="flex gap-4 text-sm mt-3">
        <Link href="/admin/reports">Reports</Link>
        <Link href="/admin/work">Tasks & approvals</Link>
        <Link href="/admin/settings">Settings</Link>
      </div>
    </div>
  );
}

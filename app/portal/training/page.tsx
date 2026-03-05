"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientModule } from "@/lib/types";

export default function TrainingLibrary() {
  const [modules, setModules] = useState<ClientModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/training");
        if (res.ok) {
          const data = await res.json();
          setModules(data.modules || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColors = {
    in_progress: "border-[rgba(34,114,222,0.3)] bg-[rgba(34,114,222,0.05)]",
    completed: "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]",
  };

  const statusLabels: Record<string, string> = {
    in_progress: "In Progress",
    completed: "Completed",
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Training Library</h1>
        <p className="text-text-secondary mt-1">Work through each module at your own pace.</p>
      </div>

      {loading ? (
        <div className="text-text-muted">Loading modules...</div>
      ) : modules.length === 0 ? (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-secondary">No training modules assigned yet.</p>
          <p className="text-text-muted text-sm mt-2">Marc will assign your modules shortly.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {modules.map((cm, i) => {
            const mod = cm.module;
            if (!mod) return null;
            const displayStatus = cm.status === "locked" ? "in_progress" : cm.status;
            return (
              <Link
                key={cm.id}
                href={`/portal/training/${mod.id}`}
                className={`block border rounded-2xl p-6 transition-all duration-200 no-underline hover:border-accent/40 ${statusColors[displayStatus as keyof typeof statusColors] || statusColors.in_progress}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center text-accent-bright font-bold text-sm flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-bold text-text-primary">{mod.title}</h3>
                      <p className="text-text-secondary text-sm mt-1">{mod.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full flex-shrink-0 ${
                    displayStatus === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                    "bg-accent/10 text-accent-bright"
                  }`}>
                    {statusLabels[displayStatus] || "In Progress"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

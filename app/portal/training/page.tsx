"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientModule, ModuleContent } from "@/lib/types";

const moduleColors = [
  { bg: "from-blue-600/20 to-blue-900/40", icon: "text-blue-400" },
  { bg: "from-emerald-600/20 to-emerald-900/40", icon: "text-emerald-400" },
  { bg: "from-purple-600/20 to-purple-900/40", icon: "text-purple-400" },
  { bg: "from-amber-600/20 to-amber-900/40", icon: "text-amber-400" },
  { bg: "from-rose-600/20 to-rose-900/40", icon: "text-rose-400" },
  { bg: "from-cyan-600/20 to-cyan-900/40", icon: "text-cyan-400" },
];

const moduleIcons = [
  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((cm, i) => {
            const mod = cm.module;
            if (!mod) return null;
            const color = moduleColors[i % moduleColors.length];
            const icon = moduleIcons[i % moduleIcons.length];
            const lessonCount = mod.content?.length || 0;
            const totalDuration = mod.content?.reduce((sum: number, c: ModuleContent) => sum + (c.duration_minutes || 0), 0) || 0;

            return (
              <Link
                key={cm.id}
                href={`/portal/training/${mod.id}`}
                className="group relative block bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden transition-all duration-300 no-underline hover:-translate-y-1 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.3),0_0_40px_rgba(34,114,222,0.06)] will-change-transform"
              >
                {/* Bento dot pattern */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] z-10 pointer-events-none" />
                {/* Bento gradient border */}
                <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                {/* Cover */}
                <div className={`relative h-36 bg-gradient-to-br ${color.bg} overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10">
                    <svg className="absolute -right-4 -top-4 w-32 h-32" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3">
                      <circle cx="60" cy="60" r="50" />
                      <circle cx="60" cy="60" r="30" />
                      <circle cx="60" cy="60" r="10" />
                      {Array.from({ length: 8 }).map((_, j) => {
                        const a = (j / 8) * Math.PI * 2;
                        return <line key={j} x1={60 + Math.cos(a) * 10} y1={60 + Math.sin(a) * 10} x2={60 + Math.cos(a) * 50} y2={60 + Math.sin(a) * 50} />;
                      })}
                    </svg>
                  </div>

                  {/* Module number */}
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                    {i + 1}
                  </div>

                  {/* Status badge */}
                  <div className="absolute top-4 right-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      cm.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-accent/20 text-blue-300 border border-accent/30"
                    }`}>
                      {cm.status === "completed" ? "Completed" : "In Progress"}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                    <svg className={`w-6 h-6 ${color.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                    </svg>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-heading font-bold text-text-primary text-[0.95rem] mb-2 group-hover:text-accent-bright transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
                    {mod.description}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      {lessonCount} lessons
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {totalDuration} min
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

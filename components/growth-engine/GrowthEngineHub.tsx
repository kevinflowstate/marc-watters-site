"use client";

import { useEffect, useState } from "react";
import GrowthEngineManager from "@/components/growth-engine/GrowthEngineManager";
import PipelineBoard from "@/components/growth-engine/PipelineBoard";

type Tab = "pipeline" | "clients";

const TABS: { value: Tab; label: string }[] = [
  { value: "pipeline", label: "Pipeline" },
  { value: "clients", label: "Live clients" },
];

/** Admin > Growth Engine. Pipeline of consultations, then the live client delivery portfolio. */
export default function GrowthEngineHub() {
  const [tab, setTab] = useState<Tab>("pipeline");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the deep link once after hydration
    if (fromUrl === "clients") setTab("clients");
  }, []);

  function choose(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "pipeline") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <div className="ws ws-page ge-hub">
      <header className="ws-ph ge-hub-head">
        <div className="min-w-0">
          <p className="ge-eyebrow">
            <span className="ge-eyebrow-mark" aria-hidden>B</span>
            CBB Growth Engine
          </p>
          <h1 className="ws-title">Growth Engine</h1>
          <p className="ws-meta mt-1 max-w-2xl">
            {tab === "pipeline"
              ? "Every consultation booked with Kevin, from first call to signed. Drag a card to move it on."
              : "Strategy, implementation and weekly reporting for clients on the Growth Engine."}
          </p>
        </div>
        <div className="ge-tabs" role="tablist" aria-label="Growth Engine views">
          <span className="ge-tabs-glide" style={{ transform: `translateX(${tab === "pipeline" ? 0 : 100}%)` }} aria-hidden />
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => choose(t.value)}
              className="ge-tab ws-focus"
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "pipeline" ? <PipelineBoard /> : <GrowthEngineManager embedded />}
    </div>
  );
}

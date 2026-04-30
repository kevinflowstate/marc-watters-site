"use client";

import { useState, useEffect } from "react";

const PLAYBOOK_FORM_ID = "lv6sRqrQk55IMR4Vv3Sw";

export default function PlaybookCTA({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const existing = document.getElementById("ghl-form-embed-js");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "ghl-form-embed-js";
        script.src =
          "https://link.constructionbusinessblueprint.co.uk/js/form_embed.js";
        script.async = true;
        document.body.appendChild(script);
      }
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-sm" />

          <div
            className="relative z-10 w-full max-w-[500px] mx-4 bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(34,114,222,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[3px] gradient-accent" />

            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-text-muted hover:text-text-primary hover:bg-[rgba(255,255,255,0.1)] transition-all z-10"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="px-6 pt-6 pb-2 text-center">
              <div className="font-heading text-[1.3rem] font-black tracking-[-0.5px] mb-1">
                Get the{" "}
                <span className="text-accent-bright">10-Step Playbook</span>
              </div>
              <p className="text-text-muted text-[0.82rem]">
                Drop your details. Watch the video. Download the PDF.
              </p>
            </div>

            <div className="px-6 pb-6">
              <iframe
                src={`https://link.constructionbusinessblueprint.co.uk/widget/form/${PLAYBOOK_FORM_ID}`}
                style={{
                  width: "100%",
                  height: "420px",
                  border: "none",
                  borderRadius: "3px",
                }}
                data-form-id={PLAYBOOK_FORM_ID}
                title="Playbook Form"
                scrolling="no"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

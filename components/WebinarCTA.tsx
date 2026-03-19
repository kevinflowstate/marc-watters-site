"use client";

import { useState, useEffect } from "react";

export default function WebinarCTA({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      // Load GHL form embed script
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative z-10 w-full max-w-[500px] mx-4 bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(34,114,222,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="h-[3px] gradient-accent" />

            {/* Close button */}
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

            {/* Header */}
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="font-heading text-[1.3rem] font-black tracking-[-0.5px] mb-1">
                Register for{" "}
                <span className="text-accent-bright">Time Profit Control</span>
              </div>
              <p className="text-text-muted text-[0.82rem]">
                Wednesday 1st April at 7pm - Live on Zoom
              </p>
            </div>

            {/* GHL Form */}
            <div className="px-6 pb-6">
              <iframe
                src="https://link.constructionbusinessblueprint.co.uk/widget/form/qK8QPo1a2iMJzRRRpqdX"
                style={{
                  width: "100%",
                  height: "373px",
                  border: "none",
                  borderRadius: "3px",
                }}
                data-form-id="qK8QPo1a2iMJzRRRpqdX"
                title="Webinar Form"
                scrolling="no"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

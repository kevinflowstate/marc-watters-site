"use client";

import { useState, useEffect } from "react";
import Script from "next/script";

export default function BookCallPopup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
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
            className="relative z-10 w-full max-w-[700px] max-h-[90vh] mx-4 bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(34,114,222,0.1)]"
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
                Book a Call with{" "}
                <span className="text-accent-bright">Marc</span>
              </div>
              <p className="text-text-muted text-[0.82rem]">
                No sales pitch. Just a straight-talking business deep dive.
              </p>
            </div>

            {/* GHL Booking Calendar */}
            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
              <iframe
                src="https://link.constructionbusinessblueprint.co.uk/widget/booking/4SOIodvlfHYmyzKvIAmn"
                style={{
                  width: "100%",
                  height: "750px",
                  border: "none",
                }}
                id="booking-popup-frame"
                title="Book a Strategy Call"
                scrolling="no"
              />
            </div>
          </div>
        </div>
      )}

      {open && (
        <Script
          src="https://link.constructionbusinessblueprint.co.uk/js/form_embed.js"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}

"use client";

import { useEffect } from "react";

export default function StatCounter() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const target = parseInt(el.dataset.count || "0");
            if (!target || el.dataset.animated) return;
            el.dataset.animated = "true";
            const suffix = el.textContent?.replace(/[0-9]/g, "") || "";
            let current = 0;
            const step = target / 40;
            const interval = setInterval(() => {
              current += step;
              if (current >= target) {
                current = target;
                clearInterval(interval);
              }
              el.textContent = Math.floor(current) + suffix;
            }, 30);
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll("[data-count]").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
}

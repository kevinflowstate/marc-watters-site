"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function getThemeKey(userId: string) {
  return `portal-theme-${userId}`;
}

export function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Always start dark until we know the user
    document.documentElement.classList.remove("light");
    // Clean up old global key from before per-user theming
    localStorage.removeItem("portal-theme");

    async function loadUserTheme() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const saved = localStorage.getItem(getThemeKey(user.id)) as "dark" | "light" | null;
        if (saved) {
          setThemeState(saved);
          document.documentElement.classList.toggle("light", saved === "light");
        }
      }
    }
    loadUserTheme();
  }, []);

  function setTheme(t: "dark" | "light") {
    setThemeState(t);
    if (userId) {
      localStorage.setItem(getThemeKey(userId), t);
    }
    document.documentElement.classList.toggle("light", t === "light");
  }

  return { theme, setTheme };
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

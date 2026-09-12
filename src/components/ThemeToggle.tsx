"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "homehub-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Reads a browser-only API (localStorage), so it can't run during the
    // server render — the mismatch between server ("system") and the
    // stored client preference is expected and resolves on this first tick.
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "system", icon: Monitor, label: "System" },
    { value: "dark", icon: Moon, label: "Dark" },
  ];

  return (
    <div className="glass-pill relative inline-flex p-1">
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => choose(value)}
            className="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ color: active ? "white" : "var(--ink-soft)" }}
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-active"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

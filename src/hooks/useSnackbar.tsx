"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type SnackbarAction = { label: string; onClick: () => void };
type SnackbarMessage = { id: number; text: string; action?: SnackbarAction };

const AUTO_DISMISS_MS = 5000;

const SnackbarContext = createContext<((text: string, action?: SnackbarAction) => void) | null>(null);

/** M3 snackbar: a transient, inverse-surface toast for confirming an
 * action (optionally with an undo/retry button), auto-dismissing after a
 * few seconds. Mount once near the app root; call useSnackbar() anywhere
 * under it. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<SnackbarMessage[]>([]);

  const show = useCallback((text: string, action?: SnackbarAction) => {
    const id = Date.now() + Math.random();
    setQueue((prev) => [...prev, { id, text, action }]);
    setTimeout(() => setQueue((prev) => prev.filter((m) => m.id !== id)), AUTO_DISMISS_MS);
  }, []);

  const current = queue[0];

  function dismiss(id: number) {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex items-center gap-4 rounded-2xl px-4 py-3 text-sm"
              style={{
                background: "var(--m3-inverse-surface)",
                color: "var(--m3-inverse-on-surface)",
                boxShadow: "var(--elevation-3)",
              }}
            >
              <span>{current.text}</span>
              {current.action && (
                <button
                  onClick={() => {
                    current.action?.onClick();
                    dismiss(current.id);
                  }}
                  className="shrink-0 rounded-lg px-1 py-0.5 text-sm font-semibold"
                  style={{ color: "var(--m3-inverse-primary)" }}
                >
                  {current.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SnackbarContext.Provider>
  );
}

/** Returns a function to show a snackbar message, optionally with an action button. */
export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within a SnackbarProvider");
  return ctx;
}

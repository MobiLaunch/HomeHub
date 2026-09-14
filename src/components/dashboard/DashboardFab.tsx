"use client";

import { useState } from "react";
import { mutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useRipple } from "@/hooks/useRipple";
import { useSnackbar } from "@/hooks/useSnackbar";

const STICKER_PALETTE = ["⭐", "❤️", "🎉", "☕️", "🌿", "🐶", "🏀", "🎵", "📌", "✅"];
const NOTE_COLORS = ["#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];

type Panel = null | "note" | "sticker";

/**
 * M3 expressive FAB with a speed-dial: quick-add a note or a sticker from
 * anywhere on the dashboard, without scrolling to the Corkboard tile. Posts
 * to the same endpoints Corkboard reads via SWR, so the `mutate` calls here
 * update it immediately wherever it's scrolled to.
 */
export function DashboardFab() {
  const [panel, setPanel] = useState<Panel>(null);
  const showSnackbar = useSnackbar();
  const { onPointerDown: fabRippleDown, rippleLayer: fabRipple } = useRipple<HTMLButtonElement>();

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next));
  }

  async function quickAddNote(text: string) {
    if (!text.trim()) return;
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, color }),
    });
    mutate("/api/notes");
    setPanel(null);
    showSnackbar("Note added");
  }

  async function quickAddSticker(emoji: string) {
    const x = 0.4 + Math.random() * 0.2;
    const y = 0.3 + Math.random() * 0.3;
    await fetch("/api/stickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, x, y }),
    });
    mutate("/api/stickers");
    setPanel(null);
    showSnackbar("Sticker added");
  }

  return (
    <>
      <AnimatePresence>
        {panel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPanel(null)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.2)" }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {panel === "note" && <QuickNotePanel onSubmit={quickAddNote} />}
          {panel === "sticker" && <QuickStickerPanel onPick={quickAddSticker} />}
        </AnimatePresence>

        <AnimatePresence>
          {panel && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="flex flex-col gap-3"
            >
              <MiniFab icon="sticky_note_2" label="Add note" onClick={() => togglePanel("note")} highlighted={panel === "note"} />
              <MiniFab icon="auto_awesome" label="Add sticker" onClick={() => togglePanel("sticker")} highlighted={panel === "sticker"} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setPanel((p) => (p ? null : "note"))}
          onPointerDown={fabRippleDown}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          className="ripple-surface flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{
            background: "var(--m3-tertiary-container)",
            color: "var(--m3-on-tertiary-container)",
            boxShadow: "var(--elevation-3)",
          }}
          aria-label={panel ? "Close quick add" : "Quick add"}
        >
          {fabRipple}
          <motion.span animate={{ rotate: panel ? 135 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>
            <Icon name="add" className="h-6 w-6" weight={600} />
          </motion.span>
        </motion.button>
      </div>
    </>
  );
}

function MiniFab({
  icon,
  label,
  onClick,
  highlighted,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  highlighted: boolean;
}) {
  const { onPointerDown, rippleLayer } = useRipple<HTMLButtonElement>();
  return (
    <motion.button
      onClick={onClick}
      onPointerDown={onPointerDown}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="ripple-surface flex items-center gap-2 rounded-2xl py-2.5 pl-3 pr-4 text-sm font-medium"
      style={{
        background: highlighted ? "var(--accent)" : "var(--surface-card-strong)",
        color: highlighted ? "var(--on-accent)" : "var(--ink)",
        boxShadow: "var(--elevation-2)",
      }}
    >
      {rippleLayer}
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </motion.button>
  );
}

function QuickNotePanel({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <motion.form
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
        setText("");
      }}
      className="glass-strong flex w-72 flex-col gap-2 p-4"
    >
      <p className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
        Quick note
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a note for the house…"
          className="glass-pill flex-1 px-3 py-2 text-sm outline-none"
          style={{ color: "var(--ink)" }}
        />
        <button
          type="submit"
          className="glass-pill flex h-9 w-9 shrink-0 items-center justify-center"
          aria-label="Save note"
        >
          <Icon name="add" className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </button>
      </div>
    </motion.form>
  );
}

function QuickStickerPanel({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className="glass-strong grid w-64 grid-cols-5 gap-1 p-3"
    >
      {STICKER_PALETTE.map((emoji) => (
        <motion.button
          key={emoji}
          onClick={() => onPick(emoji)}
          whileHover={{ scale: 1.25 }}
          whileTap={{ scale: 0.85 }}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}

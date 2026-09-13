"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import { useSnackbar } from "@/hooks/useSnackbar";
import { mutate } from "swr";

type Note = { id: string; text: string; color: string };

const COLORS = ["#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];

export function NotesTile() {
  const { data } = useLive<{ notes: Note[] }>("/api/notes", 15_000);
  const notes = data?.notes ?? [];
  const [draft, setDraft] = useState("");
  const showSnackbar = useSnackbar();

  async function addNote() {
    if (!draft.trim()) return;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    setDraft("");
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft, color }),
    });
    mutate("/api/notes");
  }

  async function removeNote(note: Note) {
    mutate(
      "/api/notes",
      (current: { notes: Note[] } | undefined) =>
        current && { notes: current.notes.filter((n) => n.id !== note.id) },
      { revalidate: false },
    );
    await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    mutate("/api/notes");
    showSnackbar("Note deleted", {
      label: "Undo",
      onClick: async () => {
        await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: note.text, color: note.color }),
        });
        mutate("/api/notes");
      },
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="Leave a note for the house…"
          className="glass-pill flex-1 px-4 py-2 text-sm outline-none transition-shadow focus:ring-2"
          style={{ color: "var(--ink)", "--tw-ring-color": "var(--accent-soft)" } as React.CSSProperties}
        />
        <motion.button
          onClick={addNote}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92, rotate: -8 }}
          className="glass-pill flex h-9 w-9 shrink-0 items-center justify-center"
          aria-label="Add note"
        >
          <Icon name="add" className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </motion.button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        <AnimatePresence initial={false}>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, scale: 0.5, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 8, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              whileHover={{ y: -3, rotate: -1.5 }}
              className="group relative rounded-2xl p-3 text-xs shadow-sm"
              style={{ background: note.color, color: "#1f2430" }}
            >
              <p className="pr-4 leading-snug break-words">{note.text}</p>
              <button
                onClick={() => removeNote(note)}
                className="absolute right-1.5 top-1.5 rounded-full p-1 opacity-0 transition group-hover:opacity-70 hover:!opacity-100"
                aria-label="Delete note"
              >
                <Icon name="delete" className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {notes.length === 0 && (
          <p className="col-span-full py-6 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
            No notes yet — leave one above.
          </p>
        )}
      </div>
    </div>
  );
}

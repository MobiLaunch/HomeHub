"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import { mutate } from "swr";

type Note = { id: string; text: string; color: string };

const COLORS = ["#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];

export function NotesTile() {
  const { data } = useLive<{ notes: Note[] }>("/api/notes", 15_000);
  const notes = data?.notes ?? [];
  const [draft, setDraft] = useState("");

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

  async function removeNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    mutate("/api/notes");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          placeholder="Leave a note for the house…"
          className="glass-pill flex-1 px-4 py-2 text-sm outline-none"
          style={{ color: "var(--ink)" }}
        />
        <button
          onClick={addNote}
          className="glass-pill flex h-9 w-9 shrink-0 items-center justify-center"
          aria-label="Add note"
        >
          <Plus className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="group relative rounded-2xl p-3 text-xs shadow-sm"
            style={{ background: note.color, color: "#1f2430" }}
          >
            <p className="pr-4 leading-snug break-words">{note.text}</p>
            <button
              onClick={() => removeNote(note.id)}
              className="absolute right-1.5 top-1.5 rounded-full p-1 opacity-0 transition group-hover:opacity-70"
              aria-label="Delete note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="col-span-full py-6 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
            No notes yet — leave one above.
          </p>
        )}
      </div>
    </div>
  );
}

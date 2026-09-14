"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mutate } from "swr";
import { Icon } from "@/components/Icon";
import { useLive } from "@/hooks/useLive";
import { useSnackbar } from "@/hooks/useSnackbar";

type Note = { id: string; text: string; color: string; x: number; y: number; rotation: number };
type Sticker = { id: string; emoji: string; x: number; y: number; rotation: number };
type BoardItem =
  | { kind: "note"; id: string; x: number; y: number; rotation: number; note: Note }
  | { kind: "sticker"; id: string; x: number; y: number; rotation: number; sticker: Sticker };

const STICKER_PALETTE = ["⭐", "❤️", "🎉", "☕️", "🌿", "🐶", "🏀", "🎵", "📌", "✅"];
const NOTE_COLORS = ["#fde68a", "#a7f3d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];
const TAP_MOVE_THRESHOLD_PX = 6;

function keyOf(item: BoardItem) {
  return `${item.kind}:${item.id}`;
}

/**
 * Notes and stickers share one drag canvas — the Note model already had
 * unused x/y/rotation fields sitting dead (the original design clearly
 * intended this; NotesTile never wired it up), so this reuses that instead
 * of adding new state.
 */
export function Corkboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: notesData } = useLive<{ notes: Note[] }>("/api/notes", 15_000);
  const { data: stickersData } = useLive<{ stickers: Sticker[] }>("/api/stickers", 20_000);
  const notes = notesData?.notes ?? [];
  const stickers = stickersData?.stickers ?? [];
  const showSnackbar = useSnackbar();

  const items: BoardItem[] = [
    ...notes.map((n): BoardItem => ({ kind: "note", id: n.id, x: n.x, y: n.y, rotation: n.rotation, note: n })),
    ...stickers.map((s): BoardItem => ({ kind: "sticker", id: s.id, x: s.x, y: s.y, rotation: s.rotation, sticker: s })),
  ];

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | "note" | "sticker">(null);
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  function onPointerDown(e: React.PointerEvent, item: BoardItem) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragKey(keyOf(item));
    pointerDownAt.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragPos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragKey) return;
    if (pointerDownAt.current) {
      const dx = e.clientX - pointerDownAt.current.x;
      const dy = e.clientY - pointerDownAt.current.y;
      if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) didDrag.current = true;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDragPos({ x, y });
  }

  async function commitDrag(item: BoardItem, pos: { x: number; y: number }) {
    if (item.kind === "note") {
      mutate(
        "/api/notes",
        (current: { notes: Note[] } | undefined) =>
          current && { notes: current.notes.map((n) => (n.id === item.id ? { ...n, x: pos.x, y: pos.y } : n)) },
        { revalidate: false },
      );
      await fetch(`/api/notes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: pos.x, y: pos.y }),
      });
    } else {
      mutate(
        "/api/stickers",
        (current: { stickers: Sticker[] } | undefined) =>
          current && { stickers: current.stickers.map((s) => (s.id === item.id ? { ...s, x: pos.x, y: pos.y } : s)) },
        { revalidate: false },
      );
      await fetch(`/api/stickers/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: pos.x, y: pos.y }),
      });
    }
  }

  async function onPointerUp() {
    if (!dragKey) return;
    const key = dragKey;
    const pos = dragPos;
    const wasTap = !didDrag.current;
    const item = items.find((i) => keyOf(i) === key);
    setDragKey(null);
    setDragPos(null);

    if (wasTap) {
      // A tap (not a drag) selects the item to reveal its edit/delete
      // affordances, rather than committing a no-op position update.
      setSelectedKey((current) => (current === key ? null : key));
      return;
    }
    setSelectedKey(null);
    if (!pos || !item) return;
    await commitDrag(item, pos);
  }

  async function removeItem(item: BoardItem) {
    setSelectedKey(null);
    if (item.kind === "note") {
      const note = item.note;
      mutate(
        "/api/notes",
        (current: { notes: Note[] } | undefined) => current && { notes: current.notes.filter((n) => n.id !== note.id) },
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
            body: JSON.stringify({ text: note.text, color: note.color, x: note.x, y: note.y, rotation: note.rotation }),
          });
          mutate("/api/notes");
        },
      });
    } else {
      const sticker = item.sticker;
      mutate(
        "/api/stickers",
        (current: { stickers: Sticker[] } | undefined) =>
          current && { stickers: current.stickers.filter((s) => s.id !== sticker.id) },
        { revalidate: false },
      );
      await fetch(`/api/stickers/${sticker.id}`, { method: "DELETE" });
      mutate("/api/stickers");
      showSnackbar("Sticker removed", {
        label: "Undo",
        onClick: async () => {
          await fetch("/api/stickers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji: sticker.emoji, x: sticker.x, y: sticker.y, rotation: sticker.rotation }),
          });
          mutate("/api/stickers");
        },
      });
    }
  }

  async function saveNote(note: Note, text: string) {
    mutate(
      "/api/notes",
      (current: { notes: Note[] } | undefined) =>
        current && { notes: current.notes.map((n) => (n.id === note.id ? { ...n, text } : n)) },
      { revalidate: false },
    );
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    mutate("/api/notes");
  }

  async function addNote(text: string) {
    if (!text.trim()) return;
    setMenu(null);
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), color }),
    });
    mutate("/api/notes");
  }

  async function addSticker(emoji: string) {
    setMenu(null);
    // Placement only happens in response to a click on the emoji picker,
    // never during render — safe despite the linter's static call-graph heuristic.
    // eslint-disable-next-line react-hooks/purity
    const x = 0.3 + Math.random() * 0.4;
    // eslint-disable-next-line react-hooks/purity
    const y = 0.25 + Math.random() * 0.4;
    await fetch("/api/stickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, x, y }),
    });
    mutate("/api/stickers");
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelectedKey(null);
      }}
      className="relative h-80 select-none overflow-hidden rounded-2xl"
      style={{ background: "var(--glass-fill-strong)" }}
    >
      <AnimatePresence>
        {items.map((item) => {
          const key = keyOf(item);
          const isDragging = key === dragKey && dragPos;
          const x = isDragging ? dragPos!.x : item.x;
          const y = isDragging ? dragPos!.y : item.y;

          if (item.kind === "sticker") {
            return (
              <BoardStickerItem
                key={key}
                sticker={item.sticker}
                x={x}
                y={y}
                isDragging={Boolean(isDragging)}
                isSelected={key === selectedKey}
                onPointerDown={(e) => onPointerDown(e, item)}
                onDelete={() => removeItem(item)}
              />
            );
          }
          return (
            <BoardNoteItem
              key={key}
              note={item.note}
              x={x}
              y={y}
              isDragging={Boolean(isDragging)}
              isSelected={key === selectedKey}
              isEditing={key === editingKey}
              onPointerDown={(e) => onPointerDown(e, item)}
              onStartEdit={() => {
                setSelectedKey(null);
                setEditingKey(key);
              }}
              onStopEdit={() => setEditingKey(null)}
              onSave={(text) => saveNote(item.note, text)}
              onDelete={() => removeItem(item)}
            />
          );
        })}
      </AnimatePresence>

      <div className="absolute bottom-2 right-2">
        <AnimatePresence>
          {menu === "note" && (
            <QuickNotePanel key="note-panel" onSubmit={addNote} onClose={() => setMenu(null)} />
          )}
          {menu === "sticker" && (
            <motion.div
              key="sticker-panel"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="glass mb-2 grid grid-cols-5 gap-1 p-2"
            >
              {STICKER_PALETTE.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => addSticker(emoji)}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.85 }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-lg"
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {menu === null && (
              <>
                <motion.button
                  key="note-fab"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setMenu("note")}
                  className="glass-pill flex h-9 w-9 items-center justify-center"
                  aria-label="Add note"
                >
                  <Icon name="sticky_note_2" className="h-4 w-4" style={{ color: "var(--accent)" }} />
                </motion.button>
                <motion.button
                  key="sticker-fab"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setMenu("sticker")}
                  className="glass-pill flex h-9 w-9 items-center justify-center"
                  aria-label="Add sticker"
                >
                  <Icon name="auto_awesome" className="h-4 w-4" style={{ color: "var(--accent)" }} />
                </motion.button>
              </>
            )}
          </AnimatePresence>
          {menu !== null && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setMenu(null)}
              className="glass-pill flex h-9 w-9 items-center justify-center"
              aria-label="Close"
            >
              <Icon name="close" className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
            </motion.button>
          )}
        </div>
      </div>

      {items.length === 0 && menu === null && (
        <p
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs"
          style={{ color: "var(--ink-soft)" }}
        >
          Drag notes and stickers anywhere on the board
        </p>
      )}
    </div>
  );
}

function BoardStickerItem({
  sticker,
  x,
  y,
  isDragging,
  isSelected,
  onPointerDown,
  onDelete,
}: {
  sticker: Sticker;
  x: number;
  y: number;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDelete: () => void;
}) {
  return (
    <motion.button
      onPointerDown={onPointerDown}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="group absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center text-3xl leading-none active:cursor-grabbing"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${isDragging ? 1.3 : 1})`,
        filter: isDragging ? "drop-shadow(0 10px 18px rgba(0,0,0,0.35))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
        transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease",
        touchAction: "none",
      }}
    >
      <span className="inline-block transition-transform duration-150 group-hover:scale-125">{sticker.emoji}</span>
      {isSelected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: "var(--m3-error)", color: "var(--m3-on-error)" }}
          aria-label={`Remove ${sticker.emoji} sticker`}
        >
          <Icon name="close" className="h-3 w-3" />
        </motion.span>
      )}
    </motion.button>
  );
}

function BoardNoteItem({
  note,
  x,
  y,
  isDragging,
  isSelected,
  isEditing,
  onPointerDown,
  onStartEdit,
  onStopEdit,
  onSave,
  onDelete,
}: {
  note: Note;
  x: number;
  y: number;
  isDragging: boolean;
  isSelected: boolean;
  isEditing: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(note.text);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  function commit() {
    onStopEdit();
    const trimmed = draftRef.current.trim();
    if (trimmed && trimmed !== note.text) onSave(trimmed);
    else setDraft(note.text);
  }

  function cancel() {
    setDraft(note.text);
    onStopEdit();
  }

  // The textarea's native `blur` event fires unreliably here — sometimes
  // immediately after `autoFocus` takes effect, with no user interaction at
  // all — so committing on blur silently discards edits. Commit instead on
  // explicit signals: Enter/Escape (below) and a real pointerdown outside
  // this note while it's being edited.
  useEffect(() => {
    if (!isEditing) return;
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) commit();
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  return (
    <motion.div
      ref={rootRef}
      onPointerDown={(e) => {
        if (!isEditing) onPointerDown(e);
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="group absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl p-2.5 text-[11px] leading-snug shadow-sm"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        background: note.color,
        color: "#1f2430",
        cursor: isEditing ? "text" : "grab",
        transform: `translate(-50%, -50%) rotate(${note.rotation}deg) scale(${isDragging ? 1.08 : 1})`,
        filter: isDragging ? "drop-shadow(0 10px 18px rgba(0,0,0,0.3))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease",
        touchAction: "none",
      }}
    >
      {isEditing ? (
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="w-full resize-none bg-transparent leading-snug outline-none"
        />
      ) : (
        <p className="break-words">{note.text}</p>
      )}

      {isSelected && !isEditing && (
        <div className="absolute -right-1.5 -top-1.5 flex gap-1">
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            aria-label="Edit note"
          >
            <Icon name="edit" className="h-3 w-3" />
          </motion.span>
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: "var(--m3-error)", color: "var(--m3-on-error)" }}
            aria-label="Delete note"
          >
            <Icon name="close" className="h-3 w-3" />
          </motion.span>
        </div>
      )}
    </motion.div>
  );
}

function QuickNotePanel({ onSubmit, onClose }: { onSubmit: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <motion.form
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
        setText("");
      }}
      className="glass mb-2 flex w-56 gap-2 p-2"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Leave a note…"
        className="glass-pill flex-1 px-3 py-1.5 text-xs outline-none"
        style={{ color: "var(--ink)" }}
      />
      <button type="submit" className="glass-pill flex h-8 w-8 shrink-0 items-center justify-center" aria-label="Save note">
        <Icon name="add" className="h-4 w-4" style={{ color: "var(--accent)" }} />
      </button>
    </motion.form>
  );
}

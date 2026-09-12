"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useLive } from "@/hooks/useLive";
import { mutate } from "swr";

type Sticker = { id: string; emoji: string; x: number; y: number; rotation: number };

const PALETTE = ["⭐", "❤️", "🎉", "☕️", "🌿", "🐶", "🏀", "🎵", "📌", "✅"];

export function StickerBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data } = useLive<{ stickers: Sticker[] }>("/api/stickers", 20_000);
  const stickers = data?.stickers ?? [];
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function onPointerDown(e: React.PointerEvent, sticker: Sticker) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(sticker.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDragPos({ x, y });
  }

  async function onPointerUp() {
    if (!dragId || !dragPos) {
      setDragId(null);
      return;
    }
    const id = dragId;
    const pos = dragPos;
    setDragId(null);
    setDragPos(null);
    mutate(
      "/api/stickers",
      (current: { stickers: Sticker[] } | undefined) =>
        current && {
          stickers: current.stickers.map((s) => (s.id === id ? { ...s, x: pos.x, y: pos.y } : s)),
        },
      { revalidate: false },
    );
    await fetch(`/api/stickers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: pos.x, y: pos.y }),
    });
  }

  async function addSticker(emoji: string) {
    setPickerOpen(false);
    // Placement only happens in response to a click on the emoji picker, never
    // during render — safe despite the linter's static call-graph heuristic.
    // eslint-disable-next-line react-hooks/purity
    const x = 0.4 + Math.random() * 0.2;
    // eslint-disable-next-line react-hooks/purity
    const y = 0.3 + Math.random() * 0.3;
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
      className="relative h-64 select-none overflow-hidden rounded-2xl"
      style={{ background: "var(--glass-fill-strong)" }}
    >
      <AnimatePresence>
        {stickers.map((sticker) => {
          const isDragging = sticker.id === dragId && dragPos;
          const x = isDragging ? dragPos!.x : sticker.x;
          const y = isDragging ? dragPos!.y : sticker.y;
          return (
            <motion.button
              key={sticker.id}
              onPointerDown={(e) => onPointerDown(e, sticker)}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="group absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center text-3xl leading-none active:cursor-grabbing"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${isDragging ? 1.3 : 1})`,
                filter: isDragging
                  ? "drop-shadow(0 10px 18px rgba(0,0,0,0.35))"
                  : "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
                transition: isDragging
                  ? "none"
                  : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease",
                touchAction: "none",
              }}
            >
              <span className="inline-block transition-transform duration-150 group-hover:scale-125">
                {sticker.emoji}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      <div className="absolute bottom-2 right-2">
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="glass mb-2 grid grid-cols-5 gap-1 p-2"
            >
              {PALETTE.map((emoji) => (
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
        <motion.button
          onClick={() => setPickerOpen((o) => !o)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          animate={{ rotate: pickerOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="glass-pill flex h-9 w-9 items-center justify-center"
          aria-label="Add sticker"
        >
          <Plus className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </motion.button>
      </div>

      {stickers.length === 0 && !pickerOpen && (
        <p
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs"
          style={{ color: "var(--ink-soft)" }}
        >
          Drag stickers anywhere on the board
        </p>
      )}
    </div>
  );
}

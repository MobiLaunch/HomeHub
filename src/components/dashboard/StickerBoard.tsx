"use client";

import { useRef, useState } from "react";
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
      {stickers.map((sticker) => {
        const isDragging = sticker.id === dragId && dragPos;
        const x = isDragging ? dragPos!.x : sticker.x;
        const y = isDragging ? dragPos!.y : sticker.y;
        return (
          <button
            key={sticker.id}
            onPointerDown={(e) => onPointerDown(e, sticker)}
            className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center text-3xl leading-none active:cursor-grabbing"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              touchAction: "none",
            }}
          >
            {sticker.emoji}
          </button>
        );
      })}

      <div className="absolute bottom-2 right-2">
        {pickerOpen && (
          <div className="glass mb-2 grid grid-cols-5 gap-1 p-2">
            {PALETTE.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addSticker(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-lg hover:bg-black/5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="glass-pill flex h-9 w-9 items-center justify-center"
          aria-label="Add sticker"
        >
          <Plus className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </button>
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

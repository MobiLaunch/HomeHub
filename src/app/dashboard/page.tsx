"use client";

import { useEffect, useState } from "react";
import { CalendarDays, MessageSquare, Bell, StickyNote, Sparkles } from "lucide-react";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { Tile } from "@/components/dashboard/Tile";
import { CalendarTile } from "@/components/dashboard/CalendarTile";
import { MessagesTile } from "@/components/dashboard/MessagesTile";
import { LiveActivityStack } from "@/components/dashboard/LiveActivityStack";
import { NotesTile } from "@/components/dashboard/NotesTile";
import { StickerBoard } from "@/components/dashboard/StickerBoard";

type TilePref = { tileType: string; enabled: boolean; position: number; size: "sm" | "md" | "lg" };

const TILE_REGISTRY: Record<
  string,
  { title: string; icon: React.ReactNode; render: () => React.ReactNode }
> = {
  calendar: {
    title: "Today & upcoming",
    icon: <CalendarDays className="h-4 w-4" />,
    render: () => <CalendarTile />,
  },
  messages: {
    title: "Messages",
    icon: <MessageSquare className="h-4 w-4" />,
    render: () => <MessagesTile />,
  },
  notifications: {
    title: "Live activity",
    icon: <Bell className="h-4 w-4" />,
    render: () => <LiveActivityStack />,
  },
  notes: {
    title: "Notes",
    icon: <StickyNote className="h-4 w-4" />,
    render: () => <NotesTile />,
  },
  stickers: {
    title: "Sticker board",
    icon: <Sparkles className="h-4 w-4" />,
    render: () => <StickerBoard />,
  },
};

export default function DashboardPage() {
  const [householdName, setHouseholdName] = useState("Home");
  const [tiles, setTiles] = useState<TilePref[] | null>(null);

  useEffect(() => {
    fetch("/api/household")
      .then((r) => r.json())
      .then((json) => setHouseholdName(json.household?.name ?? "Home"));
    fetch("/api/tiles")
      .then((r) => r.json())
      .then((json) => setTiles(json.tiles));
  }, []);

  const visibleTiles = (tiles ?? [])
    .filter((t) => t.enabled && TILE_REGISTRY[t.tileType])
    .sort((a, b) => a.position - b.position);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <GreetingHeader householdName={householdName} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleTiles.map((tile, index) => {
          const meta = TILE_REGISTRY[tile.tileType];
          return (
            <Tile key={tile.tileType} title={meta.title} icon={meta.icon} size={tile.size} index={index}>
              {meta.render()}
            </Tile>
          );
        })}
      </div>
    </main>
  );
}

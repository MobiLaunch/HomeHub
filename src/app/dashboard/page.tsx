"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { Tile } from "@/components/dashboard/Tile";
import { CalendarTile } from "@/components/dashboard/CalendarTile";
import { MessagesTile } from "@/components/dashboard/MessagesTile";
import { LiveActivityStack } from "@/components/dashboard/LiveActivityStack";
import { NotesTile } from "@/components/dashboard/NotesTile";
import { StickerBoard } from "@/components/dashboard/StickerBoard";
import { FacebookInsightsTile } from "@/components/dashboard/FacebookInsightsTile";
import { SpotifyWidget } from "@/components/dashboard/SpotifyWidget";

type TilePref = { tileType: string; enabled: boolean; position: number; size: "sm" | "md" | "lg" };

const TILE_REGISTRY: Record<string, { title: string; icon: React.ReactNode; render: () => React.ReactNode }> = {
  calendar: { title: "Family calendar", icon: <Icon name="calendar_month" />, render: () => <CalendarTile /> },
  messages: { title: "Messages", icon: <Icon name="forum" />, render: () => <MessagesTile /> },
  notifications: { title: "Live activity", icon: <Icon name="notifications" />, render: () => <LiveActivityStack /> },
  notes: { title: "Notes", icon: <Icon name="sticky_note_2" />, render: () => <NotesTile /> },
  stickers: { title: "Sticker board", icon: <Icon name="auto_awesome" />, render: () => <StickerBoard /> },
  facebook_insights: {
    title: "Page insights",
    icon: <Icon name="thumb_up" />,
    render: () => <FacebookInsightsTile />,
  },
  spotify: { title: "Now playing", icon: <Icon name="graphic_eq" />, render: () => <SpotifyWidget /> },
};

export default function DashboardPage() {
  const [householdName, setHouseholdName] = useState("Home");
  const [tiles, setTiles] = useState<TilePref[] | null>(null);

  useEffect(() => {
    fetch("/api/household").then((r) => r.json()).then((json) => setHouseholdName(json.household?.name ?? "Home"));
    fetch("/api/tiles").then((r) => r.json()).then((json) => setTiles(json.tiles));
  }, []);

  const visibleTiles = (tiles ?? []).filter((t) => t.enabled && TILE_REGISTRY[t.tileType]).sort((a, b) => a.position - b.position);
  const calendar = visibleTiles.find((t) => t.tileType === "calendar");
  const secondary = visibleTiles.filter((t) => t.tileType !== "calendar");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <GreetingHeader householdName={householdName} />
      {calendar && (
        <Tile title={TILE_REGISTRY.calendar.title} icon={TILE_REGISTRY.calendar.icon} size="lg" index={0}>
          <CalendarTile />
        </Tile>
      )}
      {secondary.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {secondary.map((tile, index) => {
            const meta = TILE_REGISTRY[tile.tileType];
            return <Tile key={tile.tileType} title={meta.title} icon={meta.icon} size={tile.size} index={index + 1}>{meta.render()}</Tile>;
          })}
        </div>
      )}
    </main>
  );
}

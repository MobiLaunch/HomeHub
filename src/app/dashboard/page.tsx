"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { Tile } from "@/components/dashboard/Tile";
import { CalendarTile } from "@/components/dashboard/CalendarTile";
import { MessagesTile } from "@/components/dashboard/MessagesTile";
import { LiveActivityStack } from "@/components/dashboard/LiveActivityStack";
import { Corkboard } from "@/components/dashboard/Corkboard";
import { FacebookInsightsTile } from "@/components/dashboard/FacebookInsightsTile";
import { SpotifyWidget } from "@/components/dashboard/SpotifyWidget";
import { DashboardFab } from "@/components/dashboard/DashboardFab";
import { CastButton } from "@/components/dashboard/CastButton";
import { TileActivityProvider, useTileActivitySnapshot } from "@/hooks/useTileActivity";

type TilePref = { tileType: string; enabled: boolean; position: number; size: "sm" | "md" | "lg" };

const TILE_REGISTRY: Record<string, { title: string; icon: React.ReactNode; render: () => React.ReactNode }> = {
  calendar: { title: "Family calendar", icon: <Icon name="calendar_month" />, render: () => <CalendarTile /> },
  messages: { title: "Messages", icon: <Icon name="forum" />, render: () => <MessagesTile /> },
  notifications: { title: "Live activity", icon: <Icon name="notifications" />, render: () => <LiveActivityStack /> },
  corkboard: { title: "Corkboard", icon: <Icon name="push_pin" />, render: () => <Corkboard /> },
  facebook_insights: {
    title: "Page insights",
    icon: <Icon name="thumb_up" />,
    render: () => <FacebookInsightsTile />,
  },
  spotify: { title: "Now playing", icon: <Icon name="graphic_eq" />, render: () => <SpotifyWidget /> },
};

export default function DashboardPage() {
  return (
    <TileActivityProvider>
      <DashboardContent />
    </TileActivityProvider>
  );
}

function DashboardContent() {
  const [householdName, setHouseholdName] = useState("Home");
  const [tiles, setTiles] = useState<TilePref[] | null>(null);
  const activity = useTileActivitySnapshot();

  useEffect(() => {
    fetch("/api/household").then((r) => r.json()).then((json) => setHouseholdName(json.household?.name ?? "Home"));
    fetch("/api/tiles").then((r) => r.json()).then((json) => setTiles(json.tiles));
  }, []);

  const visibleTiles = (tiles ?? []).filter((t) => t.enabled && TILE_REGISTRY[t.tileType]).sort((a, b) => a.position - b.position);
  const calendar = visibleTiles.find((t) => t.tileType === "calendar");

  // Tiles reorder and grow live: whichever secondary tile currently has the
  // highest reported activity score moves to the front. On phones they become
  // a native-feeling horizontal snap carousel; larger screens retain the grid.
  const secondary = visibleTiles
    .filter((t) => t.tileType !== "calendar")
    .map((t) => ({ ...t, ...(activity[t.tileType] ?? { score: 0, boostSize: false }) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.position - b.position));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GreetingHeader householdName={householdName} />
        </div>
        <div className="shrink-0 pt-1">
          <CastButton />
        </div>
      </div>

      {calendar && (
        <Tile
          title={TILE_REGISTRY.calendar.title}
          icon={TILE_REGISTRY.calendar.icon}
          size="lg"
          index={0}
          active={(activity.calendar?.score ?? 0) > 0}
        >
          <CalendarTile />
        </Tile>
      )}

      {secondary.length > 0 && (
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
          aria-label="Dashboard cards"
        >
          {secondary.map((tile, index) => {
            const meta = TILE_REGISTRY[tile.tileType];
            return (
              <div key={tile.tileType} className="w-[calc(100vw-2rem)] shrink-0 snap-center sm:w-auto sm:shrink">
                <Tile
                  title={meta.title}
                  icon={meta.icon}
                  size={tile.boostSize ? "lg" : tile.size}
                  index={index + 1}
                  active={tile.boostSize}
                >
                  {meta.render()}
                </Tile>
              </div>
            );
          })}
        </div>
      )}
      <DashboardFab />
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Icon } from "@/components/Icon";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { Tile } from "@/components/dashboard/Tile";
import { SortableTile } from "@/components/dashboard/SortableTile";
import { CustomizeToolbar } from "@/components/dashboard/CustomizeToolbar";
import { CalendarTile } from "@/components/dashboard/CalendarTile";
import { MessagesTile } from "@/components/dashboard/MessagesTile";
import { LiveActivityStack } from "@/components/dashboard/LiveActivityStack";
import { Corkboard } from "@/components/dashboard/Corkboard";
import { FacebookInsightsTile } from "@/components/dashboard/FacebookInsightsTile";
import { SpotifyWidget } from "@/components/dashboard/SpotifyWidget";
import { DashboardFab } from "@/components/dashboard/DashboardFab";
import { CastButton } from "@/components/dashboard/CastButton";
import { TileActivityProvider } from "@/hooks/useTileActivity";
import { useDashboardLayout, type TileSize } from "@/hooks/useDashboardLayout";

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
  const { displayTiles, customizing, setCustomizing, reorder, resize } = useDashboardLayout();

  useEffect(() => {
    fetch("/api/household").then((r) => r.json()).then((json) => setHouseholdName(json.household?.name ?? "Home"));
  }, []);

  const tiles = displayTiles.filter((t) => TILE_REGISTRY[t.tileType]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tiles.map((t) => t.tileType);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    reorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GreetingHeader householdName={householdName} />
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <button
            onClick={() => setCustomizing((c) => !c)}
            className="glass-pill flex items-center gap-1.5 px-3.5 py-2"
            style={{ color: customizing ? "var(--accent)" : "var(--ink-soft)" }}
            aria-pressed={customizing}
          >
            <Icon name="dashboard_customize" className="h-4 w-4" filled={customizing} />
            <span className="m3-label-large hidden sm:inline">{customizing ? "Editing" : "Customize"}</span>
          </button>
          <CastButton />
        </div>
      </div>

      {tiles.length > 0 &&
        (customizing ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tiles.map((t) => t.tileType)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map((tile, index) => {
                  const meta = TILE_REGISTRY[tile.tileType];
                  return (
                    <SortableTile
                      key={tile.tileType}
                      id={tile.tileType}
                      title={meta.title}
                      icon={meta.icon}
                      size={tile.size}
                      index={index}
                      customizing
                      onResize={(size: TileSize) => resize(tile.tileType, size)}
                    >
                      {meta.render()}
                    </SortableTile>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
            aria-label="Dashboard cards"
          >
            {tiles.map((tile, index) => {
              const meta = TILE_REGISTRY[tile.tileType];
              const size = tile.boostSize ? "xl" : tile.size;
              return (
                <div
                  key={tile.tileType}
                  className={`w-[calc(100vw-2rem)] shrink-0 snap-center sm:w-auto sm:shrink ${
                    size === "lg" ? "sm:col-span-2" : size === "xl" ? "sm:col-span-2 lg:col-span-3" : ""
                  }`}
                >
                  <Tile title={meta.title} icon={meta.icon} size={size} index={index} active={tile.boostSize}>
                    {meta.render()}
                  </Tile>
                </div>
              );
            })}
          </div>
        ))}

      {customizing ? <CustomizeToolbar onDone={() => setCustomizing(false)} /> : <DashboardFab />}
    </main>
  );
}

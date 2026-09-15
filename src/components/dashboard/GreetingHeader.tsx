"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/Icon";

type Weather = { temperature: number; code: number; location: string };

function greetingFor(hour: number) {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Winding down?";
}

function weatherIcon(code: number) {
  if (code === 0 || code === 1) return <Icon name="clear_day" className="h-5 w-5" filled />;
  if (code <= 3) return <Icon name="partly_cloudy_day" className="h-5 w-5" filled />;
  if (code >= 51 && code <= 67) return <Icon name="rainy" className="h-5 w-5" filled />;
  return <Icon name="cloud" className="h-5 w-5" filled />;
}

export function GreetingHeader({ householdName }: { householdName: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    // Real-time clock: the initial tick has to happen after mount to avoid
    // a server/client hydration mismatch on the rendered time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(coords.latitude));
        url.searchParams.set("longitude", String(coords.longitude));
        url.searchParams.set("current", "temperature_2m,weather_code");
        url.searchParams.set("temperature_unit", "fahrenheit");
        const response = await fetch(url);
        if (!response.ok) return;
        const json = await response.json();
        setWeather({ temperature: Math.round(json.current.temperature_2m), code: json.current.weather_code, location: "Current location" });
      } catch {
        // Weather is supplemental; keep the dashboard usable if it fails.
      }
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 5000 });
  }, []);

  return (
    <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.p key={now ? greetingFor(now.getHours()) : "hello"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="m3-headline-small" style={{ color: "var(--ink)" }}>
            {now ? greetingFor(now.getHours()) : "Hello"}, {householdName}
          </motion.p>
        </AnimatePresence>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div>
            <p className="m3-display-medium" style={{ color: "var(--ink)" }}>{now ? now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "--:--"}</p>
            <p className="m3-body-medium mt-1" style={{ color: "var(--ink-soft)" }}>{now?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          {weather && (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--glass-fill-strong)", color: "var(--ink)" }}>
              {weatherIcon(weather.code)}
              <div>
                <p className="m3-title-large leading-none">{weather.temperature}°F</p>
                <p className="m3-label-small mt-1 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}><Icon name="location_on" className="h-3 w-3" />{weather.location}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Link href="/settings" aria-label="Settings">
        <motion.span whileHover={{ rotate: 75 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="glass-pill flex h-11 w-11 shrink-0 items-center justify-center">
          <Icon name="settings" className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
        </motion.span>
      </Link>
    </motion.header>
  );
}

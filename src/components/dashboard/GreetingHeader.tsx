"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";

function greetingFor(hour: number) {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Winding down?";
}

export function GreetingHeader({ householdName }: { householdName: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Real-time clock: syncing to the external "wall clock" is exactly what
    // effects are for, and the initial tick has to happen after mount to
    // avoid a server/client hydration mismatch on the rendered time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-between gap-4"
    >
      <div>
        <AnimatePresence mode="wait">
          <motion.p
            key={now ? greetingFor(now.getHours()) : "hello"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-3xl font-semibold tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            {now ? greetingFor(now.getHours()) : "Hello"}, {householdName}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : ""}
          {now
            ? ` · ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </p>
      </div>
      <Link href="/settings" aria-label="Settings">
        <motion.span
          whileHover={{ rotate: 75 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="glass-pill flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <Settings className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
        </motion.span>
      </Link>
    </motion.header>
  );
}

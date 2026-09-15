"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { HubMark } from "@/components/HubMark";

const MIN_SPLASH_MS = 1100;

export default function SplashPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    async function decide() {
      let setupCompleted = false;
      try {
        const res = await fetch("/api/household");
        const json = await res.json();
        setupCompleted = Boolean(json.household?.setupCompleted);
      } catch {
        setupCompleted = false;
      }

      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;
      setStatus("ready");
      router.replace(setupCompleted ? "/dashboard" : "/setup");
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ opacity: status === "ready" ? 0 : 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        <HubMark size={84} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex flex-col items-center gap-1"
        >
          <h1 className="m3-headline-medium" style={{ color: "var(--ink)" }}>
            HomeHub
          </h1>
          <p className="m3-body-medium" style={{ color: "var(--ink-soft)" }}>
            Your household, at a glance.
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}

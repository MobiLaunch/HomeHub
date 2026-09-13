"use client";

import { motion, AnimatePresence } from "framer-motion";

/** M3 small badge: a plain attention dot, or a numeric badge when `count` is given. */
export function Badge({ count, visible = true }: { count?: number; visible?: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className={
            count
              ? "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold"
              : "h-2 w-2 rounded-full"
          }
          style={{ background: "var(--m3-error)", color: "var(--m3-on-error)" }}
        >
          {count ? (count > 99 ? "99+" : count) : null}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

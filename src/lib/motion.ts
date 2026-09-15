import type { Transition } from "framer-motion";

/**
 * M3 Expressive motion scheme, adapted from Compose's `MotionScheme` to
 * framer-motion `Transition`s. Two families:
 *
 * - `spatial` — for position, size, and shape changes. Springs that
 *   overshoot and settle with a bit of bounce, so movement feels alive
 *   rather than mechanical. This is the "Expressive" scheme (as opposed to
 *   Standard's more subdued bounce) — the default everywhere in this app.
 * - `effects` — for color and opacity changes, where overshoot would look
 *   like a glitch. Eased, no bounce.
 *
 * Each family has three speeds: `fast` (small components — switches,
 * buttons, icon morphs), `default` (medium — sheets, cards, tile reflow),
 * and `slow` (large/full-screen transitions). Reach for these instead of
 * hand-rolling a new spring/duration per component, so motion reads as one
 * consistent system.
 */
export const spatial: Record<"fast" | "default" | "slow", Transition> = {
  fast: { type: "spring", stiffness: 700, damping: 30 },
  default: { type: "spring", stiffness: 400, damping: 28 },
  slow: { type: "spring", stiffness: 220, damping: 26 },
};

export const effects: Record<"fast" | "default" | "slow", Transition> = {
  fast: { duration: 0.15, ease: [0.2, 0, 0, 1] },
  default: { duration: 0.3, ease: [0.2, 0, 0, 1] },
  slow: { duration: 0.5, ease: [0.2, 0, 0, 1] },
};

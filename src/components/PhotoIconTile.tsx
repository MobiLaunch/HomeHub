"use client";

import Image from "next/image";
import { Icon } from "@/components/Icon";

/**
 * A device's "face": real product/room art when a `photoUrl` is available
 * (the smart-home kit's signature — photography, not icons), falling back
 * to today's tonal icon circle when it isn't. None of the current Home
 * Status integrations (Kasa/Tapo/Ecobee/August) return a photo yet, so this
 * renders the icon fallback everywhere today — it's here so art can be
 * wired in later with zero call-site changes.
 */
export function PhotoIconTile({
  photoUrl,
  icon,
  iconColor = "var(--accent)",
  size = 36,
  alt,
}: {
  photoUrl?: string;
  icon: string;
  iconColor?: string;
  size?: number;
  alt: string;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, boxShadow: "var(--elevation-1)" }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "var(--accent-soft)" }}
    >
      <Icon name={icon} className="h-[45%] w-[45%]" style={{ color: iconColor }} />
    </div>
  );
}

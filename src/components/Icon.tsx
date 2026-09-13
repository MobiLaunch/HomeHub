const SIZE_CLASS: Record<string, number> = {
  "h-3 w-3": 12,
  "h-3.5 w-3.5": 14,
  "h-4 w-4": 16,
  "h-5 w-5": 20,
  "h-6 w-6": 24,
};

/**
 * Renders a Material Symbols Rounded glyph. The icon font is ligature-driven
 * (the glyph name is the text content) and sized/weighted via
 * font-variation-settings instead of swapping SVG files — `className` still
 * accepts the same Tailwind `h-* w-*` sizing utilities the old lucide-react
 * icons used, so call sites didn't need to change their sizing.
 */
export function Icon({
  name,
  className = "h-4 w-4",
  filled = false,
  weight = 400,
  style,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  style?: React.CSSProperties;
}) {
  const size = SIZE_CLASS[className] ?? 16;
  return (
    <span
      className={`material-symbols-rounded inline-flex shrink-0 items-center justify-center align-middle ${className}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

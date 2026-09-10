import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HomeHub",
  description: "Your household, at a glance.",
};

// Applies the stored theme choice before paint, on every page — a plain
// inline script rather than a React effect, since an effect only runs (and
// only exists) on pages that mount the settings toggle, and would otherwise
// flash the wrong theme on first paint everywhere else.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("homehub-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="aurora-field" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

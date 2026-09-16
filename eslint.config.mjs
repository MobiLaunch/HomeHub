import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Its own self-contained package with its own eslint config (see
    // homebridge-homehub/eslint.config.js) — a separate Node/ESM Homebridge
    // plugin, not part of the Next.js app.
    "homebridge-homehub/**",
  ]),
]);

export default eslintConfig;

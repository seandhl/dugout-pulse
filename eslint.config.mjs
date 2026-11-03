import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["**/*.{jsx,tsx}"], rules: jsxA11y.flatConfigs.recommended.rules },
  globalIgnores([
    ".next/**",
    ".next-ingest-e2e/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

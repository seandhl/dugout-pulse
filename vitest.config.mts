import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./tests/unit/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/unit/native-coverage.ts"],
    maxWorkers: 2,
    testTimeout: 30000,
  },
});

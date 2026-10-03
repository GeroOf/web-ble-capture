import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 15000,
  },
});

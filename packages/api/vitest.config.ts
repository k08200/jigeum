import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    // Scope vitest to api unit/integration suites only. Without `include`,
    // vitest walks up the monorepo and picks up Playwright e2e specs from
    // packages/web/e2e which fail because they require a Playwright runner.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    root: __dirname,
  },
});

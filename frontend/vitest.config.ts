import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vitest configuration for the CryptEdu frontend.
//
// Notes:
// - `jsdom` environment is required for component tests using
//   `@testing-library/react` (e.g. LessonPlayerScreen tests).
// - `setupFiles` registers the MSW server and Jest-DOM matchers before any
//   test runs. See `src/__tests__/setup.ts`.
// - `globals: true` enables `describe`, `it`, `expect` without imports so
//   that test files line up with the project conventions.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
  },
});

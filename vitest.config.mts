import { defineConfig } from "vitest/config";

// Run tests in UTC so that Japan-time bugs (deadlines, school year) show up.
// Set before workers start so they inherit it.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve the same "@/" alias as tsconfig without pulling in an extra plugin.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

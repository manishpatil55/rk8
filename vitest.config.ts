import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // same "@/" alias as tsconfig, without an extra plugin
      "@": src,
      // `import "server-only"` throws outside Next's bundler — stub it for tests
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DB-backed suites open SQLite under RK8_DATA_DIR; keep it off the repo's data/
    env: {
      RK8_DATA_DIR: path.join(tmpdir(), "rk8-vitest"),
      APP_URL: "http://localhost:3000",
    },
  },
});

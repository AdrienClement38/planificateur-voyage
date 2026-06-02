import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Logique pure (src/domain) + API serveur (server/) : environnement Node.
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    // Les tests API utilisent une base PGlite isolée (jamais ./data/dev).
    env: { PGLITE_DIR: "./data/test" },
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/lib/**", "server/**"],
    },
  },
});

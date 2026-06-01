import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // La logique métier de src/domain est pure : un environnement Node suffit.
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/lib/**"],
    },
  },
});

import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuration Capacitor : emballe le build web (`dist`) dans une app native.
 *
 * Sur mobile, l'app est un bundle statique : elle appelle l'API à distance
 * (AlwaysData) via `VITE_API_BASE_URL`, injectée au moment du build mobile
 * (voir scripts `build:mobile` dans package.json et la doc de déploiement).
 */
const config: CapacitorConfig = {
  appId: "com.cotripper.app",
  appName: "Co-Tripper",
  webDir: "dist",
};

export default config;

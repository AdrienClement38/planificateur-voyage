/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base d'URL de l'API.
   * - Web (AlwaysData) : laisser vide → chemins relatifs `/api/...`.
   * - Mobile (Capacitor) : URL absolue du serveur, ex. `https://xxx.alwaysdata.net`.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * CLI : applique les migrations (`npm run db:migrate`).
 * La logique est dans `migrate-runner.ts` (réutilisée par le serveur au démarrage).
 */
import { runMigrations } from "./migrate-runner";

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db:migrate] échec :", err);
    process.exit(1);
  });

import { migrateDb } from "./client";

/**
 * Applique les migrations en attente sur la base courante (PostgreSQL en prod,
 * PGlite en dev/test). Appelée au démarrage du serveur et par `npm run db:migrate`.
 */
export async function runMigrations(): Promise<void> {
  await migrateDb();
  console.log("[migrate] base à jour.");
}

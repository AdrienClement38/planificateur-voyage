import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { mkdirSync, existsSync, cpSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

/** Dossier de persistance de la base locale (PGlite). Surchargé par `PGLITE_DIR` (tests). */
export const LOCAL_DB_DIR = process.env.PGLITE_DIR || "./data/dev";
const MIGRATIONS_FOLDER = "./server/db/migrations";
const BACKUPS_DIR = "./data/.backups";
const BACKUPS_KEEP = 8;

/**
 * Sauvegarde AUTOMATIQUE de la base de dev à CHAQUE démarrage, AVANT que PGlite
 * n'ouvre le dossier → copie À FROID (donc cohérente, sans verrou). Rotation : on ne
 * garde que les `BACKUPS_KEEP` plus récentes. Filet de sécurité essentiel : PGlite
 * (Postgres en WASM) peut se corrompre si le process est tué EN PLEINE ÉCRITURE (et
 * sous Windows un arrêt propre n'est pas garanti). Avec ces snapshots tournants, on a
 * TOUJOURS un point de restauration récent et sain. Ne s'applique qu'à la VRAIE base
 * de dev (jamais aux bases temporaires de test, ni en prod où Postgres gère ses backups).
 */
function backupLocalDb(dir: string): void {
  try {
    if (process.env.PGLITE_DIR) return; // base de test → pas de sauvegarde
    if (!existsSync(join(dir, "PG_VERSION"))) return; // base neuve/vide → rien à sauver
    mkdirSync(BACKUPS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    cpSync(dir, join(BACKUPS_DIR, `dev-${stamp}`), { recursive: true });
    // Rotation : tri lexical = chronologique (ISO) → on supprime les plus anciennes.
    const snaps = readdirSync(BACKUPS_DIR)
      .filter((n) => n.startsWith("dev-"))
      .sort();
    for (const old of snaps.slice(0, -BACKUPS_KEEP)) {
      rmSync(join(BACKUPS_DIR, old), { recursive: true, force: true });
    }
    console.log(`[backup] base sauvegardée (${snaps.length}/${BACKUPS_KEEP}).`);
  } catch {
    // Une sauvegarde qui échoue ne doit JAMAIS empêcher le serveur de démarrer.
  }
}

let database: NodePgDatabase<typeof schema>;
let migrateFn: () => Promise<void>;
let closeFn: () => Promise<void> = async () => {};

/**
 * Instance Drizzle unique + sa fonction de migration (même connexion).
 * - `DATABASE_URL` défini (prod) → PostgreSQL via `pg`.
 * - sinon (dev/test) → PGlite (Postgres embarqué, fichier local).
 */
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const d = drizzlePg(pool, { schema });
  database = d;
  migrateFn = () => migratePg(d, { migrationsFolder: MIGRATIONS_FOLDER });
  closeFn = () => pool.end();
} else {
  mkdirSync(LOCAL_DB_DIR, { recursive: true });
  backupLocalDb(LOCAL_DB_DIR); // snapshot À FROID avant l'ouverture par PGlite
  const client = new PGlite(LOCAL_DB_DIR);
  const d = drizzlePglite(client, { schema });
  // API de requête identique (même dialecte pg-core) : cast sûr à l'usage.
  database = d as unknown as NodePgDatabase<typeof schema>;
  migrateFn = () => migratePglite(d, { migrationsFolder: MIGRATIONS_FOLDER });
  closeFn = () => client.close();
}

export const db = database;
/** Applique les migrations sur l'instance courante (utilisé au démarrage + tests). */
export const migrateDb = migrateFn;
/** Ferme PROPREMENT la base (flush + libération du verrou) — appelé à l'arrêt du serveur. */
export const closeDb = (): Promise<void> => closeFn();
export { schema };

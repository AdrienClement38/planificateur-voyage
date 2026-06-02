import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

/** Dossier de persistance de la base locale (PGlite). Surchargé par `PGLITE_DIR` (tests). */
export const LOCAL_DB_DIR = process.env.PGLITE_DIR || "./data/dev";
const MIGRATIONS_FOLDER = "./server/db/migrations";

let database: NodePgDatabase<typeof schema>;
let migrateFn: () => Promise<void>;

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
} else {
  mkdirSync(LOCAL_DB_DIR, { recursive: true });
  const client = new PGlite(LOCAL_DB_DIR);
  const d = drizzlePglite(client, { schema });
  // API de requête identique (même dialecte pg-core) : cast sûr à l'usage.
  database = d as unknown as NodePgDatabase<typeof schema>;
  migrateFn = () => migratePglite(d, { migrationsFolder: MIGRATIONS_FOLDER });
}

export const db = database;
/** Applique les migrations sur l'instance courante (utilisé au démarrage + tests). */
export const migrateDb = migrateFn;
export { schema };

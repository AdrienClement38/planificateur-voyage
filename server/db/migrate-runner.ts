import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { LOCAL_DB_DIR } from "./client";

const migrationsFolder = "./server/db/migrations";

/**
 * Applique les migrations en attente.
 * - prod (`DATABASE_URL`) → PostgreSQL ;
 * - dev → PGlite local.
 *
 * Appelée au démarrage du serveur (auto-migration) et par `npm run db:migrate`.
 */
export async function runMigrations(): Promise<void> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    await pool.end();
    console.log("[migrate] PostgreSQL à jour.");
  } else {
    const client = new PGlite(LOCAL_DB_DIR);
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder });
    await client.close();
    console.log(`[migrate] PGlite local à jour (${LOCAL_DB_DIR}).`);
  }
}

/**
 * Applique les migrations SQL générées (`server/db/migrations`) à la base :
 * - prod (`DATABASE_URL` défini) → PostgreSQL via `pg`,
 * - dev → PGlite (Postgres embarqué local).
 *
 * Usage : `npm run db:migrate`.
 */
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { LOCAL_DB_DIR } from "./client";

const migrationsFolder = "./server/db/migrations";

async function run() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    await pool.end();
    console.log("[db:migrate] PostgreSQL à jour.");
  } else {
    const client = new PGlite(LOCAL_DB_DIR);
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder });
    await client.close();
    console.log(`[db:migrate] PGlite local à jour (${LOCAL_DB_DIR}).`);
  }
}

run().catch((err) => {
  console.error("[db:migrate] échec :", err);
  process.exit(1);
});

import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

/** Dossier de persistance de la base locale (PGlite). Ignoré par git. */
export const LOCAL_DB_DIR = "./data/dev";

/**
 * Instance Drizzle unique pour toute l'app.
 * - `DATABASE_URL` défini (prod, AlwaysData) → vrai PostgreSQL via `pg`.
 * - sinon (dev) → PGlite (Postgres embarqué, persistant dans un fichier local).
 *
 * Le type est unifié sur `NodePgDatabase` : l'API de requête est identique
 * (même dialecte pg-core), donc le cast pour PGlite est sans risque à l'usage.
 */
export const db: NodePgDatabase<typeof schema> = process.env.DATABASE_URL
  ? drizzlePg(new Pool({ connectionString: process.env.DATABASE_URL, max: 4 }), {
      schema,
    })
  : (drizzlePglite(new PGlite(LOCAL_DB_DIR), {
      schema,
    }) as unknown as NodePgDatabase<typeof schema>);

export { schema };

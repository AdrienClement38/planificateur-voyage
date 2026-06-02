import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";

/** Durée de vie d'une session (30 jours). */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const SESSION_COOKIE = "session";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
}

/** Crée une session pour un utilisateur et renvoie le jeton opaque + l'expiration. */
export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

/** Valide un jeton de session ; renvoie l'utilisateur ou null (et purge si expiré). */
export async function validateSession(
  token: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatar: users.avatar,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token));

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatar: row.avatar,
  };
}

/** Supprime une session (déconnexion). */
export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

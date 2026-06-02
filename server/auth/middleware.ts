import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, validateSession } from "./session";

/** Extrait le jeton de session : cookie (web) ou en-tête `Authorization: Bearer` (mobile). */
export function getSessionToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

/** Attache `req.user` si une session valide est présente (sinon laisse passer). */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getSessionToken(req);
  if (token) {
    const user = await validateSession(token);
    if (user) req.user = user;
  }
  next();
}

/** Refuse l'accès (401) si aucun utilisateur authentifié. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  next();
}

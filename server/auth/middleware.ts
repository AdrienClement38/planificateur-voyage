import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, validateSession } from "./session";

/** Attache `req.user` si une session valide est présente (sinon laisse passer). */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
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

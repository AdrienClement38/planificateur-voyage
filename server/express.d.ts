import type { SessionUser } from "./auth/session";

// Augmente le type Request d'Express pour exposer l'utilisateur authentifié.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};

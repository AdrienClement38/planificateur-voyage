import { Router, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  createSession,
  invalidateSession,
  SESSION_COOKIE,
} from "../auth/session";
import { requireAuth } from "../auth/middleware";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères minimum"),
  displayName: z.string().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides.", issues: parsed.error.issues });
    return;
  }
  const email = parsed.data.email.toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Cet email est déjà utilisé." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName: parsed.data.displayName })
    .returning();

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar },
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  const email = parsed.data.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    res.status(401).json({ error: "Email ou mot de passe incorrect." });
    return;
  }

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar },
  });
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await invalidateSession(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/me — mise à jour du profil (nom affiché, avatar)
router.patch("/me", requireAuth, async (req, res) => {
  const parsed = z
    .object({
      displayName: z.string().min(1).max(60).optional(),
      avatar: z.string().max(1000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  if (Object.keys(parsed.data).length > 0) {
    await db.update(users).set(parsed.data).where(eq(users.id, req.user!.id));
  }
  const [u] = await db.select().from(users).where(eq(users.id, req.user!.id));
  res.json({
    user: { id: u.id, email: u.email, displayName: u.displayName, avatar: u.avatar },
  });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { trips, tripMembers } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { loadTripAggregate } from "../services/trip-aggregate";

const router = Router();
router.use(requireAuth);

/** Renvoie la ligne d'appartenance (ou null) d'un utilisateur à un voyage. */
async function getMembership(tripId: string, userId: string) {
  const [m] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  return m ?? null;
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  targetDays: z.number().int().min(1).max(60).optional(),
  budgetType: z.enum(["Économique", "Modéré", "Luxe"]).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  selectedDestination: z.string().max(200).optional(),
  targetDays: z.number().int().min(1).max(60).optional(),
  budgetType: z.enum(["Économique", "Modéré", "Luxe"]).optional(),
  averageLodgingCostPerNight: z.number().int().min(0).optional(),
  averageLocalTransportCostPerDay: z.number().int().min(0).optional(),
  externalTransportCost: z.number().int().min(0).optional(),
});

// GET /api/trips — voyages dont l'utilisateur est membre (résumés)
router.get("/", async (req, res) => {
  const rows = await db
    .select({
      id: trips.id,
      name: trips.name,
      description: trips.description,
      selectedDestination: trips.selectedDestination,
      targetDays: trips.targetDays,
      budgetType: trips.budgetType,
    })
    .from(trips)
    .innerJoin(tripMembers, eq(tripMembers.tripId, trips.id))
    .where(eq(tripMembers.userId, req.user!.id));
  res.json({ trips: rows });
});

// POST /api/trips — créer un voyage (le créateur devient membre/owner)
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides.", issues: parsed.error.issues });
    return;
  }
  const [trip] = await db
    .insert(trips)
    .values({
      ownerId: req.user!.id,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      targetDays: parsed.data.targetDays ?? 4,
      budgetType: parsed.data.budgetType ?? "Modéré",
    })
    .returning();
  await db
    .insert(tripMembers)
    .values({ tripId: trip.id, userId: req.user!.id, role: "owner" });

  res.status(201).json({ trip: await loadTripAggregate(trip.id) });
});

// GET /api/trips/:id — agrégat complet (membre requis)
router.get("/:id", async (req, res) => {
  if (!(await getMembership(req.params.id, req.user!.id))) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  const trip = await loadTripAggregate(req.params.id);
  if (!trip) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  res.json({ trip });
});

// PATCH /api/trips/:id — réglages scalaires (membre requis)
router.patch("/:id", async (req, res) => {
  if (!(await getMembership(req.params.id, req.user!.id))) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  if (Object.keys(parsed.data).length > 0) {
    await db.update(trips).set(parsed.data).where(eq(trips.id, req.params.id));
  }
  res.json({ trip: await loadTripAggregate(req.params.id) });
});

// DELETE /api/trips/:id — suppression (propriétaire uniquement)
router.delete("/:id", async (req, res) => {
  const [trip] = await db.select().from(trips).where(eq(trips.id, req.params.id));
  if (!trip) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  if (trip.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Seul le créateur peut supprimer ce voyage." });
    return;
  }
  await db.delete(trips).where(eq(trips.id, req.params.id));
  res.status(204).end();
});

// POST /api/trips/:id/join — rejoindre un voyage via un lien partagé
router.post("/:id/join", async (req, res) => {
  const [trip] = await db.select().from(trips).where(eq(trips.id, req.params.id));
  if (!trip) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  if (!(await getMembership(req.params.id, req.user!.id))) {
    await db
      .insert(tripMembers)
      .values({ tripId: req.params.id, userId: req.user!.id, role: "member" });
  }
  res.json({ trip: await loadTripAggregate(req.params.id) });
});

export default router;

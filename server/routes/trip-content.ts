import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  tripMembers,
  availabilities,
  destinations,
  destinationVotes,
  activities,
  activityVotes,
  itineraryDays,
  events,
  messages,
  documents,
  photos,
} from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { loadTripAggregate } from "../services/trip-aggregate";

const router = Router();
router.use(requireAuth);

/** Garde : l'utilisateur courant doit être membre du voyage `:id`. */
async function requireMembership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const [m] = await db
    .select()
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, req.params.id),
        eq(tripMembers.userId, req.user!.id),
      ),
    );
  if (!m) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  next();
}

/** Répond avec l'agrégat à jour du voyage (état serveur courant). */
async function respondTrip(res: Response, tripId: string): Promise<void> {
  res.json({ trip: await loadTripAggregate(tripId) });
}

// Note : le vote ne définit PAS automatiquement la destination du voyage.
// La destination est choisie à la création ou via une action explicite
// (PATCH /api/trips/:id { selectedDestination }). Le vote n'est qu'un signal.

// ------------------------------------------------------------------ Disponibilités
router.post("/:id/availabilities", requireMembership, async (req, res) => {
  const parsed = z
    .object({ start: z.string(), end: z.string() })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dates invalides." });
    return;
  }
  await db.insert(availabilities).values({
    tripId: req.params.id,
    userId: req.user!.id,
    start: parsed.data.start,
    end: parsed.data.end,
  });
  await respondTrip(res, req.params.id);
});

router.delete("/:id/availabilities/:availId", requireMembership, async (req, res) => {
  // On ne peut supprimer que ses propres disponibilités.
  await db
    .delete(availabilities)
    .where(
      and(
        eq(availabilities.id, req.params.availId),
        eq(availabilities.tripId, req.params.id),
        eq(availabilities.userId, req.user!.id),
      ),
    );
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Destinations
router.post("/:id/destinations", requireMembership, async (req, res) => {
  const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nom invalide." });
    return;
  }
  const [dest] = await db
    .insert(destinations)
    .values({
      tripId: req.params.id,
      name: parsed.data.name,
      proposedBy: req.user!.displayName,
    })
    .returning();
  // Auto-vote du proposant.
  await db.insert(destinationVotes).values({ destinationId: dest.id, userId: req.user!.id });
  await respondTrip(res, req.params.id);
});

router.delete("/:id/destinations/:destId", requireMembership, async (req, res) => {
  await db
    .delete(destinations)
    .where(and(eq(destinations.id, req.params.destId), eq(destinations.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});

router.post("/:id/destinations/:destId/vote", requireMembership, async (req, res) => {
  const existing = await db
    .select()
    .from(destinationVotes)
    .where(
      and(
        eq(destinationVotes.destinationId, req.params.destId),
        eq(destinationVotes.userId, req.user!.id),
      ),
    );
  if (existing.length > 0) {
    await db
      .delete(destinationVotes)
      .where(
        and(
          eq(destinationVotes.destinationId, req.params.destId),
          eq(destinationVotes.userId, req.user!.id),
        ),
      );
  } else {
    await db
      .insert(destinationVotes)
      .values({ destinationId: req.params.destId, userId: req.user!.id });
  }
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Activités
const activityInput = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  cost: z.number().int().default(0),
  category: z.string().default(""),
  proposedBy: z.string().optional(),
  source: z.string().optional(),
  rating: z.number().optional(),
  reviewsCount: z.number().int().optional(),
  duration: z.string().optional(),
  bookingUrl: z.string().optional(),
});

router.post("/:id/activities", requireMembership, async (req, res) => {
  const parsed = activityInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Activité invalide." });
    return;
  }
  const [act] = await db
    .insert(activities)
    .values({ tripId: req.params.id, ...parsed.data })
    .returning();
  await db.insert(activityVotes).values({ activityId: act.id, userId: req.user!.id });
  await respondTrip(res, req.params.id);
});

router.post("/:id/activities/bulk", requireMembership, async (req, res) => {
  const parsed = z.array(activityInput).safeParse(req.body?.activities);
  if (!parsed.success) {
    res.status(400).json({ error: "Liste d'activités invalide." });
    return;
  }
  if (parsed.data.length > 0) {
    await db
      .insert(activities)
      .values(parsed.data.map((a) => ({ tripId: req.params.id, ...a })));
  }
  await respondTrip(res, req.params.id);
});

router.delete("/:id/activities/:actId", requireMembership, async (req, res) => {
  await db
    .delete(activities)
    .where(and(eq(activities.id, req.params.actId), eq(activities.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});

router.post("/:id/activities/:actId/vote", requireMembership, async (req, res) => {
  const existing = await db
    .select()
    .from(activityVotes)
    .where(
      and(
        eq(activityVotes.activityId, req.params.actId),
        eq(activityVotes.userId, req.user!.id),
      ),
    );
  if (existing.length > 0) {
    await db
      .delete(activityVotes)
      .where(
        and(
          eq(activityVotes.activityId, req.params.actId),
          eq(activityVotes.userId, req.user!.id),
        ),
      );
  } else {
    await db
      .insert(activityVotes)
      .values({ activityId: req.params.actId, userId: req.user!.id });
  }
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Itinéraire
const itinerarySchema = z.array(
  z.object({
    day: z.number().int(),
    title: z.string().default(""),
    events: z
      .array(
        z.object({
          time: z.string(),
          description: z.string(),
          cost: z.number().int().default(0),
        }),
      )
      .default([]),
  }),
);

// Remplace tout l'itinéraire (génération / planification auto).
router.put("/:id/itinerary", requireMembership, async (req, res) => {
  const parsed = itinerarySchema.safeParse(req.body?.itinerary);
  if (!parsed.success) {
    res.status(400).json({ error: "Itinéraire invalide." });
    return;
  }
  await db.delete(itineraryDays).where(eq(itineraryDays.tripId, req.params.id));
  for (const day of parsed.data) {
    const [d] = await db
      .insert(itineraryDays)
      .values({ tripId: req.params.id, day: day.day, title: day.title })
      .returning();
    if (day.events.length > 0) {
      await db.insert(events).values(day.events.map((e) => ({ dayId: d.id, ...e })));
    }
  }
  await respondTrip(res, req.params.id);
});

// Ajoute un événement à un jour (crée le jour s'il manque).
router.post("/:id/events", requireMembership, async (req, res) => {
  const parsed = z
    .object({
      day: z.number().int().min(1),
      time: z.string(),
      description: z.string().min(1),
      cost: z.number().int().default(0),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Événement invalide." });
    return;
  }
  let [dayRow] = await db
    .select()
    .from(itineraryDays)
    .where(and(eq(itineraryDays.tripId, req.params.id), eq(itineraryDays.day, parsed.data.day)));
  if (!dayRow) {
    [dayRow] = await db
      .insert(itineraryDays)
      .values({
        tripId: req.params.id,
        day: parsed.data.day,
        title: `Jour ${parsed.data.day}`,
      })
      .returning();
  }
  await db.insert(events).values({
    dayId: dayRow.id,
    time: parsed.data.time,
    description: parsed.data.description,
    cost: parsed.data.cost,
  });
  await respondTrip(res, req.params.id);
});

router.delete("/:id/events/:eventId", requireMembership, async (req, res) => {
  // Vérifie que l'événement appartient bien à un jour de ce voyage.
  const dayIds = (
    await db
      .select({ id: itineraryDays.id })
      .from(itineraryDays)
      .where(eq(itineraryDays.tripId, req.params.id))
  ).map((d) => d.id);
  if (dayIds.length > 0) {
    await db
      .delete(events)
      .where(and(eq(events.id, req.params.eventId), inArray(events.dayId, dayIds)));
  }
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Messages (append-only)
router.post("/:id/messages", requireMembership, async (req, res) => {
  const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message vide." });
    return;
  }
  await db
    .insert(messages)
    .values({ tripId: req.params.id, userId: req.user!.id, text: parsed.data.text });
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Documents
router.post("/:id/documents", requireMembership, async (req, res) => {
  const parsed = z
    .object({
      name: z.string().min(1),
      type: z.enum(["pdf", "image", "doc", "other"]).default("other"),
      size: z.string().default(""),
      url: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Document invalide." });
    return;
  }
  await db
    .insert(documents)
    .values({ tripId: req.params.id, uploadedBy: req.user!.id, ...parsed.data });
  await respondTrip(res, req.params.id);
});

router.delete("/:id/documents/:docId", requireMembership, async (req, res) => {
  await db
    .delete(documents)
    .where(and(eq(documents.id, req.params.docId), eq(documents.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});

// ------------------------------------------------------------------ Photos
router.post("/:id/photos", requireMembership, async (req, res) => {
  const parsed = z
    .object({ url: z.string().min(1), caption: z.string().default("") })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Photo invalide." });
    return;
  }
  await db
    .insert(photos)
    .values({ tripId: req.params.id, uploadedBy: req.user!.id, ...parsed.data });
  await respondTrip(res, req.params.id);
});

router.delete("/:id/photos/:photoId", requireMembership, async (req, res) => {
  await db
    .delete(photos)
    .where(and(eq(photos.id, req.params.photoId), eq(photos.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});

export default router;

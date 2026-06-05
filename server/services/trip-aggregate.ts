import { eq, inArray, asc } from "drizzle-orm";
import { db } from "../db/client";
import {
  trips,
  tripMembers,
  users,
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
import type { Trip } from "../../src/types";

/** Regroupe des valeurs par clé. */
function groupBy<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const r of rows) {
    const k = key(r);
    (out[k] ??= []).push(r);
  }
  return out;
}

/**
 * Charge un voyage et toutes ses sous-collections, recomposés dans la forme
 * dénormalisée `Trip` attendue par le frontend (votes en tableaux d'IDs, etc.).
 * Renvoie `null` si le voyage n'existe pas.
 */
export async function loadTripAggregate(tripId: string): Promise<Trip | null> {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) return null;

  // Lot 1 : requêtes indépendantes lancées en parallèle (sur PostgreSQL/pool =
  // vrai parallélisme ; sur PGlite = file d'attente, sans surcoût).
  const [memberRows, availRows, destRows, actRows, dayRows, msgRows, docRows, photoRows] =
    await Promise.all([
      db
        .select({ id: users.id, name: users.displayName, avatar: users.avatar })
        .from(tripMembers)
        .innerJoin(users, eq(tripMembers.userId, users.id))
        .where(eq(tripMembers.tripId, tripId)),
      db.select().from(availabilities).where(eq(availabilities.tripId, tripId)),
      db.select().from(destinations).where(eq(destinations.tripId, tripId)),
      db
        .select()
        .from(activities)
        .where(eq(activities.tripId, tripId))
        .orderBy(asc(activities.sortRank), asc(activities.createdAt)),
      db
        .select()
        .from(itineraryDays)
        .where(eq(itineraryDays.tripId, tripId))
        .orderBy(asc(itineraryDays.day)),
      db
        .select({
          id: messages.id,
          senderId: messages.userId,
          senderName: users.displayName,
          senderAvatar: users.avatar,
          text: messages.text,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.tripId, tripId))
        .orderBy(asc(messages.createdAt)),
      db.select().from(documents).where(eq(documents.tripId, tripId)),
      db.select().from(photos).where(eq(photos.tripId, tripId)),
    ]);

  // Lot 2 : votes + événements (dépendent des IDs du lot 1), en parallèle.
  const destIds = destRows.map((d) => d.id);
  const actIds = actRows.map((a) => a.id);
  const dayIds = dayRows.map((d) => d.id);
  const [destVoteRows, actVoteRows, eventRows] = await Promise.all([
    destIds.length
      ? db.select().from(destinationVotes).where(inArray(destinationVotes.destinationId, destIds))
      : Promise.resolve([]),
    actIds.length
      ? db.select().from(activityVotes).where(inArray(activityVotes.activityId, actIds))
      : Promise.resolve([]),
    dayIds.length
      ? db.select().from(events).where(inArray(events.dayId, dayIds))
      : Promise.resolve([]),
  ]);
  const destVotesById = groupBy(destVoteRows, (v) => v.destinationId);
  const actVotesById = groupBy(actVoteRows, (v) => v.activityId);
  const eventsByDay = groupBy(eventRows, (e) => e.dayId);

  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    selectedDestination: trip.selectedDestination,
    targetDays: trip.targetDays,
    budgetType: trip.budgetType as Trip["budgetType"],
    averageLodgingCostPerNight: trip.averageLodgingCostPerNight,
    averageLocalTransportCostPerDay: trip.averageLocalTransportCostPerDay,
    externalTransportCost: trip.externalTransportCost,
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar ?? "",
    })),
    availabilities: availRows.map((a) => ({
      id: a.id,
      memberId: a.userId,
      start: a.start,
      end: a.end,
    })),
    destinations: destRows.map((d) => ({
      id: d.id,
      name: d.name,
      proposedBy: d.proposedBy,
      votes: (destVotesById[d.id] ?? []).map((v) => v.userId),
    })),
    activities: actRows.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      cost: a.cost,
      category: a.category,
      proposedBy: a.proposedBy ?? undefined,
      votes: (actVotesById[a.id] ?? []).map((v) => v.userId),
      source: (a.source as Trip["activities"][number]["source"]) ?? undefined,
      rating: a.rating ?? undefined,
      reviewsCount: a.reviewsCount ?? undefined,
      duration: a.duration ?? undefined,
      bookingUrl: a.bookingUrl ?? undefined,
      imageUrl: a.imageUrl ?? undefined,
    })),
    itinerary: dayRows.map((d) => ({
      day: d.day,
      title: d.title,
      events: (eventsByDay[d.id] ?? [])
        .map((e) => ({
          id: e.id,
          time: e.time,
          endTime: e.endTime ?? undefined,
          description: e.description,
          cost: e.cost,
          bookingUrl: e.bookingUrl ?? undefined,
        }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    })),
    messages: msgRows.map((m) => ({
      id: m.id,
      senderId: m.senderId ?? "system",
      senderName: m.senderName ?? "Système",
      senderAvatar: m.senderAvatar ?? "",
      text: m.text,
      timestamp: m.createdAt.toISOString(),
    })),
    documents: docRows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as Trip["documents"][number]["type"],
      uploadedBy: d.uploadedBy ?? "",
      size: d.size,
      date: d.createdAt.toISOString(),
      url: d.url ?? undefined,
    })),
    photos: photoRows.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      uploadedBy: p.uploadedBy ?? "",
      date: p.createdAt.toISOString(),
    })),
  };
}

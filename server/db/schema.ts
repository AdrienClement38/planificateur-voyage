/**
 * Schéma de base de données (Drizzle, dialecte PostgreSQL).
 *
 * Un seul dialecte partout : PostgreSQL en production (AlwaysData) et PGlite
 * (Postgres embarqué) en local — pas de divergence SQLite/Postgres.
 *
 * Les votes (tableaux d'IDs côté localStorage) deviennent des tables de liaison
 * normalisées (`destination_votes`, `activity_votes`).
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // jeton de session opaque
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  selectedDestination: text("selected_destination").notNull().default(""),
  targetDays: integer("target_days").notNull().default(4),
  budgetType: text("budget_type").notNull().default("Modéré"),
  averageLodgingCostPerNight: integer("avg_lodging").notNull().default(70),
  averageLocalTransportCostPerDay: integer("avg_local_transport")
    .notNull()
    .default(15),
  externalTransportCost: integer("external_transport_cost")
    .notNull()
    .default(150),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // "owner" | "member"
  },
  (t) => [primaryKey({ columns: [t.tripId, t.userId] })],
);

export const availabilities = pgTable("availabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  start: text("start").notNull(), // YYYY-MM-DD
  end: text("end").notNull(),
});

export const destinations = pgTable("destinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  proposedBy: text("proposed_by").notNull().default(""),
});

export const destinationVotes = pgTable(
  "destination_votes",
  {
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.destinationId, t.userId] })],
);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  cost: integer("cost").notNull().default(0),
  category: text("category").notNull().default(""),
  proposedBy: text("proposed_by"),
  source: text("source"), // "GetYourGuide" | "Airbnb Expériences" | "Google Activités"
  rating: real("rating"),
  reviewsCount: integer("reviews_count"),
  duration: text("duration"),
  bookingUrl: text("booking_url"),
});

export const activityVotes = pgTable(
  "activity_votes",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.userId] })],
);

export const itineraryDays = pgTable("itinerary_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  title: text("title").notNull().default(""),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayId: uuid("day_id")
    .notNull()
    .references(() => itineraryDays.id, { onDelete: "cascade" }),
  time: text("time").notNull(),
  description: text("description").notNull(),
  cost: integer("cost").notNull().default(0),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // null = système
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  type: text("type").notNull().default("other"),
  size: text("size").notNull().default(""),
  url: text("url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  url: text("url").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

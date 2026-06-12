var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express5 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_compression = __toESM(require("compression"), 1);
var import_express_rate_limit2 = __toESM(require("express-rate-limit"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);

// server/routes/auth.ts
var import_express = require("express");
var import_zod = require("zod");
var import_drizzle_orm4 = require("drizzle-orm");
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// server/db/client.ts
var import_node_postgres = require("drizzle-orm/node-postgres");
var import_pglite = require("drizzle-orm/pglite");
var import_migrator = require("drizzle-orm/node-postgres/migrator");
var import_migrator2 = require("drizzle-orm/pglite/migrator");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_pg = require("pg");
var import_pglite2 = require("@electric-sql/pglite");

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activities: () => activities,
  activityVotes: () => activityVotes,
  availabilities: () => availabilities,
  destinationVotes: () => destinationVotes,
  destinations: () => destinations,
  documents: () => documents,
  events: () => events,
  itineraryDays: () => itineraryDays,
  messages: () => messages,
  photos: () => photos,
  sessions: () => sessions,
  tripMembers: () => tripMembers,
  trips: () => trips,
  users: () => users
});
var import_pg_core = require("drizzle-orm/pg-core");
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  email: (0, import_pg_core.text)("email").notNull().unique(),
  passwordHash: (0, import_pg_core.text)("password_hash").notNull(),
  displayName: (0, import_pg_core.text)("display_name").notNull(),
  avatar: (0, import_pg_core.text)("avatar"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var sessions = (0, import_pg_core.pgTable)("sessions", {
  id: (0, import_pg_core.text)("id").primaryKey(),
  // jeton de session opaque
  userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: (0, import_pg_core.timestamp)("expires_at").notNull()
});
var trips = (0, import_pg_core.pgTable)("trips", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  ownerId: (0, import_pg_core.uuid)("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description").notNull().default(""),
  selectedDestination: (0, import_pg_core.text)("selected_destination").notNull().default(""),
  targetDays: (0, import_pg_core.integer)("target_days").notNull().default(4),
  budgetType: (0, import_pg_core.text)("budget_type").notNull().default("Mod\xE9r\xE9"),
  averageLodgingCostPerNight: (0, import_pg_core.integer)("avg_lodging").notNull().default(70),
  averageLocalTransportCostPerDay: (0, import_pg_core.integer)("avg_local_transport").notNull().default(15),
  externalTransportCost: (0, import_pg_core.integer)("external_transport_cost").notNull().default(150),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
});
var tripMembers = (0, import_pg_core.pgTable)(
  "trip_members",
  {
    tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: (0, import_pg_core.text)("role").notNull().default("member")
    // "owner" | "member"
  },
  (t) => [
    (0, import_pg_core.primaryKey)({ columns: [t.tripId, t.userId] }),
    (0, import_pg_core.index)("trip_members_user_idx").on(t.userId)
  ]
);
var availabilities = (0, import_pg_core.pgTable)("availabilities", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  start: (0, import_pg_core.text)("start").notNull(),
  // YYYY-MM-DD
  end: (0, import_pg_core.text)("end").notNull()
}, (t) => [(0, import_pg_core.index)("availabilities_trip_idx").on(t.tripId)]);
var destinations = (0, import_pg_core.pgTable)("destinations", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  name: (0, import_pg_core.text)("name").notNull(),
  proposedBy: (0, import_pg_core.text)("proposed_by").notNull().default("")
}, (t) => [(0, import_pg_core.index)("destinations_trip_idx").on(t.tripId)]);
var destinationVotes = (0, import_pg_core.pgTable)(
  "destination_votes",
  {
    destinationId: (0, import_pg_core.uuid)("destination_id").notNull().references(() => destinations.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" })
  },
  (t) => [(0, import_pg_core.primaryKey)({ columns: [t.destinationId, t.userId] })]
);
var activities = (0, import_pg_core.pgTable)("activities", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  name: (0, import_pg_core.text)("name").notNull(),
  description: (0, import_pg_core.text)("description").notNull().default(""),
  cost: (0, import_pg_core.integer)("cost").notNull().default(0),
  category: (0, import_pg_core.text)("category").notNull().default(""),
  proposedBy: (0, import_pg_core.text)("proposed_by"),
  source: (0, import_pg_core.text)("source"),
  // "GetYourGuide" | "Airbnb Expériences" | "Google Activités"
  rating: (0, import_pg_core.real)("rating"),
  reviewsCount: (0, import_pg_core.integer)("reviews_count"),
  duration: (0, import_pg_core.text)("duration"),
  bookingUrl: (0, import_pg_core.text)("booking_url"),
  imageUrl: (0, import_pg_core.text)("image_url"),
  // photo réelle si la source en fournit une, sinon null
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow(),
  sortRank: (0, import_pg_core.integer)("sort_rank")
  // rang de popularité (ordre d'affichage garanti)
}, (t) => [(0, import_pg_core.index)("activities_trip_idx").on(t.tripId)]);
var activityVotes = (0, import_pg_core.pgTable)(
  "activity_votes",
  {
    activityId: (0, import_pg_core.uuid)("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
    userId: (0, import_pg_core.uuid)("user_id").notNull().references(() => users.id, { onDelete: "cascade" })
  },
  (t) => [(0, import_pg_core.primaryKey)({ columns: [t.activityId, t.userId] })]
);
var itineraryDays = (0, import_pg_core.pgTable)("itinerary_days", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  day: (0, import_pg_core.integer)("day").notNull(),
  title: (0, import_pg_core.text)("title").notNull().default("")
}, (t) => [(0, import_pg_core.index)("itinerary_days_trip_idx").on(t.tripId)]);
var events = (0, import_pg_core.pgTable)("events", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  dayId: (0, import_pg_core.uuid)("day_id").notNull().references(() => itineraryDays.id, { onDelete: "cascade" }),
  time: (0, import_pg_core.text)("time").notNull(),
  // heure de début "HH:MM"
  endTime: (0, import_pg_core.text)("end_time"),
  // heure de fin "HH:MM" (null = non renseignée)
  description: (0, import_pg_core.text)("description").notNull(),
  cost: (0, import_pg_core.integer)("cost").notNull().default(0),
  bookingUrl: (0, import_pg_core.text)("booking_url")
  // lien de l'offre (depuis la suggestion)
}, (t) => [(0, import_pg_core.index)("events_day_idx").on(t.dayId)]);
var messages = (0, import_pg_core.pgTable)("messages", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: (0, import_pg_core.uuid)("user_id").references(() => users.id, { onDelete: "set null" }),
  // null = système
  text: (0, import_pg_core.text)("text").notNull(),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
}, (t) => [(0, import_pg_core.index)("messages_trip_idx").on(t.tripId)]);
var documents = (0, import_pg_core.pgTable)("documents", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  uploadedBy: (0, import_pg_core.uuid)("uploaded_by").references(() => users.id, {
    onDelete: "set null"
  }),
  name: (0, import_pg_core.text)("name").notNull(),
  type: (0, import_pg_core.text)("type").notNull().default("other"),
  size: (0, import_pg_core.text)("size").notNull().default(""),
  url: (0, import_pg_core.text)("url"),
  // Fichiers réellement téléversés (sinon 0 / null pour les entrées par URL).
  sizeBytes: (0, import_pg_core.integer)("size_bytes").notNull().default(0),
  mimeType: (0, import_pg_core.text)("mime_type"),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
}, (t) => [(0, import_pg_core.index)("documents_trip_idx").on(t.tripId)]);
var photos = (0, import_pg_core.pgTable)("photos", {
  id: (0, import_pg_core.uuid)("id").primaryKey().defaultRandom(),
  tripId: (0, import_pg_core.uuid)("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  uploadedBy: (0, import_pg_core.uuid)("uploaded_by").references(() => users.id, {
    onDelete: "set null"
  }),
  url: (0, import_pg_core.text)("url").notNull(),
  caption: (0, import_pg_core.text)("caption").notNull().default(""),
  createdAt: (0, import_pg_core.timestamp)("created_at").notNull().defaultNow()
}, (t) => [(0, import_pg_core.index)("photos_trip_idx").on(t.tripId)]);

// server/db/client.ts
var LOCAL_DB_DIR = process.env.PGLITE_DIR || "./data/dev";
var MIGRATIONS_FOLDER = "./server/db/migrations";
var BACKUPS_DIR = "./data/.backups";
var BACKUPS_KEEP = 8;
function backupLocalDb(dir) {
  try {
    if (process.env.PGLITE_DIR) return;
    if (!(0, import_node_fs.existsSync)((0, import_node_path.join)(dir, "PG_VERSION"))) return;
    (0, import_node_fs.mkdirSync)(BACKUPS_DIR, { recursive: true });
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    (0, import_node_fs.cpSync)(dir, (0, import_node_path.join)(BACKUPS_DIR, `dev-${stamp}`), { recursive: true });
    const snaps = (0, import_node_fs.readdirSync)(BACKUPS_DIR).filter((n) => n.startsWith("dev-")).sort();
    for (const old of snaps.slice(0, -BACKUPS_KEEP)) {
      (0, import_node_fs.rmSync)((0, import_node_path.join)(BACKUPS_DIR, old), { recursive: true, force: true });
    }
    console.log(`[backup] base sauvegard\xE9e (${snaps.length}/${BACKUPS_KEEP}).`);
  } catch {
  }
}
var database;
var migrateFn;
var closeFn = async () => {
};
if (process.env.DATABASE_URL) {
  const pool = new import_pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const d = (0, import_node_postgres.drizzle)(pool, { schema: schema_exports });
  database = d;
  migrateFn = () => (0, import_migrator.migrate)(d, { migrationsFolder: MIGRATIONS_FOLDER });
  closeFn = () => pool.end();
} else {
  (0, import_node_fs.mkdirSync)(LOCAL_DB_DIR, { recursive: true });
  backupLocalDb(LOCAL_DB_DIR);
  const client = new import_pglite2.PGlite(LOCAL_DB_DIR);
  const d = (0, import_pglite.drizzle)(client, { schema: schema_exports });
  database = d;
  migrateFn = () => (0, import_migrator2.migrate)(d, { migrationsFolder: MIGRATIONS_FOLDER });
  closeFn = () => client.close();
}
var db = database;
var migrateDb = migrateFn;
var closeDb = () => closeFn();

// server/auth/password.ts
var import_argon2 = require("@node-rs/argon2");
function hashPassword(password) {
  return (0, import_argon2.hash)(password);
}
function verifyPassword(hashStr, password) {
  return (0, import_argon2.verify)(hashStr, password);
}

// server/auth/session.ts
var import_node_crypto = require("node:crypto");
var import_drizzle_orm = require("drizzle-orm");
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var SESSION_COOKIE = "session";
async function createSession(userId) {
  const token = (0, import_node_crypto.randomBytes)(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}
async function validateSession(token) {
  const rows = await db.select({
    id: users.id,
    email: users.email,
    displayName: users.displayName,
    avatar: users.avatar,
    expiresAt: sessions.expiresAt
  }).from(sessions).innerJoin(users, (0, import_drizzle_orm.eq)(sessions.userId, users.id)).where((0, import_drizzle_orm.eq)(sessions.id, token));
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where((0, import_drizzle_orm.eq)(sessions.id, token));
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatar: row.avatar
  };
}
async function invalidateSession(token) {
  await db.delete(sessions).where((0, import_drizzle_orm.eq)(sessions.id, token));
}

// server/auth/middleware.ts
function getSessionToken(req) {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return void 0;
}
async function attachUser(req, _res, next) {
  const token = getSessionToken(req);
  if (token) {
    const user = await validateSession(token);
    if (user) req.user = user;
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  next();
}

// server/services/trip-aggregate.ts
var import_drizzle_orm2 = require("drizzle-orm");
function groupBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = key(r);
    (out[k] ??= []).push(r);
  }
  return out;
}
async function loadTripAggregate(tripId) {
  const [trip] = await db.select().from(trips).where((0, import_drizzle_orm2.eq)(trips.id, tripId));
  if (!trip) return null;
  const [memberRows, availRows, destRows, actRows, dayRows, msgRows, docRows, photoRows] = await Promise.all([
    db.select({ id: users.id, name: users.displayName, avatar: users.avatar }).from(tripMembers).innerJoin(users, (0, import_drizzle_orm2.eq)(tripMembers.userId, users.id)).where((0, import_drizzle_orm2.eq)(tripMembers.tripId, tripId)),
    db.select().from(availabilities).where((0, import_drizzle_orm2.eq)(availabilities.tripId, tripId)),
    db.select().from(destinations).where((0, import_drizzle_orm2.eq)(destinations.tripId, tripId)),
    db.select().from(activities).where((0, import_drizzle_orm2.eq)(activities.tripId, tripId)).orderBy((0, import_drizzle_orm2.asc)(activities.sortRank), (0, import_drizzle_orm2.asc)(activities.createdAt)),
    db.select().from(itineraryDays).where((0, import_drizzle_orm2.eq)(itineraryDays.tripId, tripId)).orderBy((0, import_drizzle_orm2.asc)(itineraryDays.day)),
    db.select({
      id: messages.id,
      senderId: messages.userId,
      senderName: users.displayName,
      senderAvatar: users.avatar,
      text: messages.text,
      createdAt: messages.createdAt
    }).from(messages).leftJoin(users, (0, import_drizzle_orm2.eq)(messages.userId, users.id)).where((0, import_drizzle_orm2.eq)(messages.tripId, tripId)).orderBy((0, import_drizzle_orm2.asc)(messages.createdAt)),
    db.select().from(documents).where((0, import_drizzle_orm2.eq)(documents.tripId, tripId)),
    db.select().from(photos).where((0, import_drizzle_orm2.eq)(photos.tripId, tripId))
  ]);
  const destIds = destRows.map((d) => d.id);
  const actIds = actRows.map((a) => a.id);
  const dayIds = dayRows.map((d) => d.id);
  const [destVoteRows, actVoteRows, eventRows] = await Promise.all([
    destIds.length ? db.select().from(destinationVotes).where((0, import_drizzle_orm2.inArray)(destinationVotes.destinationId, destIds)) : Promise.resolve([]),
    actIds.length ? db.select().from(activityVotes).where((0, import_drizzle_orm2.inArray)(activityVotes.activityId, actIds)) : Promise.resolve([]),
    dayIds.length ? db.select().from(events).where((0, import_drizzle_orm2.inArray)(events.dayId, dayIds)) : Promise.resolve([])
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
    budgetType: trip.budgetType,
    averageLodgingCostPerNight: trip.averageLodgingCostPerNight,
    averageLocalTransportCostPerDay: trip.averageLocalTransportCostPerDay,
    externalTransportCost: trip.externalTransportCost,
    members: memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar ?? ""
    })),
    availabilities: availRows.map((a) => ({
      id: a.id,
      memberId: a.userId,
      start: a.start,
      end: a.end
    })),
    destinations: destRows.map((d) => ({
      id: d.id,
      name: d.name,
      proposedBy: d.proposedBy,
      votes: (destVotesById[d.id] ?? []).map((v) => v.userId)
    })),
    activities: actRows.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      cost: a.cost,
      category: a.category,
      proposedBy: a.proposedBy ?? void 0,
      votes: (actVotesById[a.id] ?? []).map((v) => v.userId),
      source: a.source ?? void 0,
      rating: a.rating ?? void 0,
      reviewsCount: a.reviewsCount ?? void 0,
      duration: a.duration ?? void 0,
      bookingUrl: a.bookingUrl ?? void 0,
      imageUrl: a.imageUrl ?? void 0
    })),
    itinerary: dayRows.map((d) => ({
      day: d.day,
      title: d.title,
      events: (eventsByDay[d.id] ?? []).map((e) => ({
        id: e.id,
        time: e.time,
        endTime: e.endTime ?? void 0,
        description: e.description,
        cost: e.cost,
        bookingUrl: e.bookingUrl ?? void 0
      })).sort((a, b) => a.time.localeCompare(b.time))
    })),
    messages: msgRows.map((m) => ({
      id: m.id,
      senderId: m.senderId ?? "system",
      senderName: m.senderName ?? "Syst\xE8me",
      senderAvatar: m.senderAvatar ?? "",
      text: m.text,
      timestamp: m.createdAt.toISOString()
    })),
    documents: docRows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      uploadedBy: d.uploadedBy ?? "",
      size: d.size,
      date: d.createdAt.toISOString(),
      url: d.url ?? void 0
    })),
    photos: photoRows.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      uploadedBy: p.uploadedBy ?? "",
      date: p.createdAt.toISOString()
    }))
  };
}

// server/realtime.ts
var import_ws = require("ws");
var import_drizzle_orm3 = require("drizzle-orm");
var rooms = /* @__PURE__ */ new Map();
var wss = null;
function parseToken(req) {
  const url = new URL(req.url ?? "", "http://localhost");
  const q = url.searchParams.get("token");
  if (q) return q;
  const cookie = req.headers.cookie;
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
  }
  return void 0;
}
function leave(ws) {
  if (!ws.tripId) return;
  const set = rooms.get(ws.tripId);
  set?.delete(ws);
  if (set && set.size === 0) rooms.delete(ws.tripId);
  ws.tripId = void 0;
}
function send(ws, payload) {
  if (ws.readyState === import_ws.WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function initRealtime(server) {
  wss = new import_ws.WebSocketServer({ noServer: true });
  server.on("upgrade", async (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) return;
    const token = parseToken(req);
    const user = token ? await validateSession(token) : null;
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c = ws;
      c.userId = user.id;
      wss.emit("connection", c, req);
    });
  });
  wss.on("connection", (ws) => {
    ws.on("message", async (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === "subscribe" && typeof msg.tripId === "string") {
        const [m] = await db.select().from(tripMembers).where((0, import_drizzle_orm3.and)((0, import_drizzle_orm3.eq)(tripMembers.tripId, msg.tripId), (0, import_drizzle_orm3.eq)(tripMembers.userId, ws.userId)));
        if (!m) return;
        leave(ws);
        ws.tripId = msg.tripId;
        let set = rooms.get(msg.tripId);
        if (!set) {
          set = /* @__PURE__ */ new Set();
          rooms.set(msg.tripId, set);
        }
        set.add(ws);
        send(ws, { type: "subscribed", tripId: msg.tripId });
      } else if (msg.type === "unsubscribe") {
        leave(ws);
      }
    });
    ws.on("close", () => leave(ws));
    ws.on("error", () => leave(ws));
  });
}
function broadcastTrip(tripId, trip) {
  const set = rooms.get(tripId);
  if (!set) return;
  for (const ws of set) send(ws, { type: "trip:updated", trip });
}
function broadcastTripDeleted(tripId) {
  const set = rooms.get(tripId);
  if (!set) return;
  for (const ws of set) send(ws, { type: "trip:deleted", tripId });
}

// server/routes/auth.ts
var router = (0, import_express.Router)();
var authLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de tentatives. R\xE9essayez dans quelques minutes." }
});
var signupSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(8, "8 caract\xE8res minimum"),
  displayName: import_zod.z.string().min(1).max(60)
});
var loginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(1)
});
function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/"
  });
}
router.post("/signup", authLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides.", issues: parsed.error.issues });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where((0, import_drizzle_orm4.eq)(users.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Cet email est d\xE9j\xE0 utilis\xE9." });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db.insert(users).values({ email, passwordHash, displayName: parsed.data.displayName }).returning();
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar },
    token
    // pour le client mobile (Authorization: Bearer) ; le web utilise le cookie
  });
});
router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const [user] = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.email, email));
  if (!user || !await verifyPassword(user.passwordHash, parsed.data.password)) {
    res.status(401).json({ error: "Email ou mot de passe incorrect." });
    return;
  }
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar },
    token
  });
});
router.post("/logout", async (req, res) => {
  const token = getSessionToken(req);
  if (token) await invalidateSession(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
router.patch("/me", requireAuth, async (req, res) => {
  const parsed = import_zod.z.object({
    displayName: import_zod.z.string().min(1).max(60).optional(),
    avatar: import_zod.z.string().max(1e3).optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  if (Object.keys(parsed.data).length > 0) {
    await db.update(users).set(parsed.data).where((0, import_drizzle_orm4.eq)(users.id, req.user.id));
  }
  const [u] = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.id, req.user.id));
  const memberTrips = await db.select({ tripId: tripMembers.tripId }).from(tripMembers).where((0, import_drizzle_orm4.eq)(tripMembers.userId, req.user.id));
  for (const t of memberTrips) {
    broadcastTrip(t.tripId, await loadTripAggregate(t.tripId));
  }
  res.json({
    user: { id: u.id, email: u.email, displayName: u.displayName, avatar: u.avatar }
  });
});
router.get("/export", requireAuth, async (req, res) => {
  const [u] = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.id, req.user.id));
  const memberTripIds = await db.select({ tripId: tripMembers.tripId }).from(tripMembers).where((0, import_drizzle_orm4.eq)(tripMembers.userId, req.user.id));
  const trips2 = (await Promise.all(memberTripIds.map((m) => loadTripAggregate(m.tripId)))).filter(Boolean);
  res.setHeader("Content-Disposition", 'attachment; filename="co-traveler-export.json"');
  res.json({
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    account: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatar: u.avatar,
      createdAt: u.createdAt
    },
    trips: trips2
  });
});
router.delete("/me", requireAuth, async (req, res) => {
  await db.delete(users).where((0, import_drizzle_orm4.eq)(users.id, req.user.id));
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});
var auth_default = router;

// server/routes/trips.ts
var import_express2 = require("express");
var import_zod2 = require("zod");
var import_drizzle_orm5 = require("drizzle-orm");

// server/services/http.ts
var UA = "Co-Traveler/1.0 (https://co-tripper.example; contact@co-tripper.example)";
async function fetchJson(url, ms = 6e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// server/services/cache.ts
function capMap(map, max2) {
  while (map.size > max2) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

// server/services/geo.ts
async function geocode(destination) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    destination
  )}&format=json&limit=1`;
  const data = await fetchJson(url);
  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
function placeRank(osmValue) {
  if (osmValue === "city") return 0;
  if (osmValue === "village" || osmValue === "hamlet" || osmValue === "isolated_dwelling" || osmValue === "farm" || osmValue === "locality" || osmValue === "suburb" || osmValue === "neighbourhood" || osmValue === "quarter")
    return 2;
  return 1;
}
function photonToCitySuggestions(data) {
  const features = data?.features;
  if (!Array.isArray(features)) return [];
  const ranked = [];
  const seen = /* @__PURE__ */ new Set();
  for (const f of features) {
    const p = f.properties ?? {};
    const name = p.name?.trim();
    if (!name || p.type !== "city") continue;
    const lon = f.geometry?.coordinates?.[0];
    const lat = f.geometry?.coordinates?.[1];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const country = p.country?.trim() || void 0;
    const county = p.county?.trim();
    const withCounty = p.osm_value !== "city" && county && county !== name ? county : null;
    const label = [name, withCounty, country].filter(Boolean).join(", ");
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      city: {
        label,
        name,
        country,
        countryCode: p.countrycode?.toUpperCase(),
        region: p.state?.trim() || county || void 0,
        // sous-titre = région (le dépt est déjà dans le label si commune)
        lat,
        lon
      },
      rank: placeRank(p.osm_value),
      idx: ranked.length
      // ordre Photon, pour un tri stable explicite
    });
  }
  return ranked.sort((a, b) => a.rank - b.rank || a.idx - b.idx).map((r) => r.city);
}
var GEO_CACHE = /* @__PURE__ */ new Map();
var GEO_TTL = 10 * 60 * 1e3;
var GEO_CACHE_MAX = 1e3;
async function suggestCities(query, limit = 6) {
  const q = query.trim();
  if (q.length < 2) return [];
  const cap = Math.min(Math.max(limit, 1), 10);
  const cacheKey = `${cap}|${q.toLowerCase()}`;
  const hit = GEO_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < GEO_TTL) return hit.items;
  const url = `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&lang=fr&layer=city&limit=${Math.min(cap * 3, 20)}`;
  const data = await fetchJson(url, 6e3);
  const items = photonToCitySuggestions(data).slice(0, cap);
  if (items.length > 0) GEO_CACHE.set(cacheKey, { at: Date.now(), items });
  capMap(GEO_CACHE, GEO_CACHE_MAX);
  return items;
}

// server/services/core.ts
function mapsLink(name, dest) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${dest}`)}`;
}

// server/services/foursquare.ts
function fsqCategory(cats) {
  const n = (cats?.[0]?.name || "").toLowerCase();
  if (/spa|bath|sauna|wellness|massage|hammam|thermal|therme|onsen/.test(n))
    return "Bien-\xEAtre";
  if (/museum|gallery|\bart\b|theater|theatre|historic|monument|church|temple|cathedral|mosque|synagogue|landmark|memorial|castle|palace|heritage|cultural|library|exhibit|opera/.test(
    n
  ))
    return "Culture";
  if (/park|garden|mountain|lake|beach|trail|scenic|nature|forest|waterfall|\bhill\b|valley|river|island|\bcave\b|viewpoint|lookout|botanical|reserve|glacier/.test(
    n
  ))
    return "Nature";
  if (/amusement|aquarium|\bzoo\b|cable car|funicular|gondola|cog railway|\bski\b|climb|water park|theme|luge|toboggan|playground|recreation|golf|bowling|arcade|stadium|arena|adventure|rafting|kayak|\bboat\b|cruise|entertainment/.test(
    n
  ))
    return "Loisir";
  if (/restaurant|food|café|cafe|\bbar\b|bistro|brasserie|winery|brewery|eatery|diner/.test(
    n
  ))
    return "Gastronomie";
  if (/shop|mall|store|boutique|market/.test(n)) return "Shopping";
  return "Visite";
}
async function discoverFoursquare(lat, lon, destination) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7e3);
  try {
    const fields = "fsq_place_id,name,categories,website,location";
    const url = `https://places-api.foursquare.com/places/search?ll=${lat},${lon}&radius=8000&limit=50&fields=${encodeURIComponent(fields)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Places-Api-Version": "2025-06-17",
        Accept: "application/json"
      },
      signal: ctrl.signal
    });
    if (!res.ok) return [];
    const j = await res.json();
    const out = [];
    for (const p of j.results ?? []) {
      if (!p.name) continue;
      const category = fsqCategory(p.categories);
      if (category === "Visite" || category === "Gastronomie" || category === "Shopping")
        continue;
      const catName = p.categories?.[0]?.name;
      out.push({
        name: p.name,
        description: (catName || p.location?.formatted_address || `Lieu r\xE9el \xE0 ${destination}.`).slice(0, 240),
        category,
        duration: category === "Bien-\xEAtre" ? "demi-journ\xE9e" : "1h30",
        bookingUrl: mapsLink(p.name, destination),
        provider: "Foursquare"
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// server/services/enrich.ts
async function fetchExtracts(titles) {
  const out = {};
  if (titles.length === 0) return out;
  const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exsentences=2&redirects=1&titles=${encodeURIComponent(
    titles.join("|")
  )}&format=json`;
  const data = await fetchJson(url);
  for (const p of Object.values(data?.query?.pages ?? {})) {
    if (p.title && p.extract) out[p.title] = p.extract;
  }
  return out;
}
async function enrichBatch(batch) {
  const titles = batch.map((p) => p.wikiTitle || p.name).join("|");
  const url = `https://fr.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=extracts|pageimages|langlinks&exintro&explaintext&exsentences=2&exlimit=20&lllimit=500&piprop=thumbnail&pithumbsize=800&pilimit=50&titles=${encodeURIComponent(titles)}`;
  let data = await fetchJson(url, 1e4);
  if (!data?.query?.pages) {
    await new Promise((r) => setTimeout(r, 700));
    data = await fetchJson(url, 1e4);
  }
  const q = data?.query;
  if (!q?.pages) return;
  const imgByTitle = {};
  const extByTitle = {};
  const fameByTitle = {};
  for (const pg of Object.values(q.pages)) {
    const t = (pg.title ?? "").toLowerCase();
    if (!t) continue;
    if (pg.thumbnail?.source) imgByTitle[t] = pg.thumbnail.source;
    if (pg.extract) extByTitle[t] = pg.extract;
    if (pg.langlinks) fameByTitle[t] = pg.langlinks.length;
  }
  const alias = {};
  for (const n of q.normalized ?? [])
    alias[n.from.toLowerCase()] = n.to.toLowerCase();
  for (const r of q.redirects ?? [])
    alias[r.from.toLowerCase()] = r.to.toLowerCase();
  const resolve = (name) => {
    let t = name.toLowerCase();
    for (let h = 0; h < 3 && alias[t]; h++) t = alias[t];
    return t;
  };
  for (const p of batch) {
    const want = (p.wikiTitle || p.name).toLowerCase();
    const t = resolve(p.wikiTitle || p.name);
    const img = imgByTitle[t] || imgByTitle[want];
    if (img && !p.imageUrl) p.imageUrl = img;
    const fame = fameByTitle[t] ?? fameByTitle[want];
    if (fame != null) p.fame = Math.max(p.fame ?? 0, fame);
    const ext = extByTitle[t] || extByTitle[want];
    if (ext && (!p.description || /^Lieu réel à/.test(p.description))) {
      p.description = ext.slice(0, 240);
    }
  }
}
async function enrichWikiMedia(places) {
  const batches = [];
  for (let i = 0; i < places.length; i += 20)
    batches.push(places.slice(i, i + 20));
  await Promise.all(batches.map((b) => enrichBatch(b).catch(() => void 0)));
}

// server/services/overpass.ts
function classifyTags(tags) {
  if (tags.amenity === "spa" || tags.amenity === "public_bath" || tags.leisure === "spa")
    return { category: "Bien-\xEAtre", duration: "demi-journ\xE9e" };
  if (tags.aerialway || tags.railway)
    return { category: "Loisir", duration: "demi-journ\xE9e" };
  if (tags.leisure === "water_park" || tags.leisure === "sports_centre" || tags.leisure === "swimming_pool")
    return { category: "Loisir", duration: "demi-journ\xE9e" };
  const tour = tags.tourism;
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park")
    return { category: "Loisir", duration: "demi-journ\xE9e" };
  if (tour === "museum" || tour === "gallery")
    return { category: "Culture", duration: "1h30" };
  if (tags.amenity === "theatre" || tags.amenity === "cinema" || tags.amenity === "arts_centre")
    return { category: "Culture", duration: "2h" };
  if (tags.historic) return { category: "Culture", duration: "1h" };
  if (tags.natural) return { category: "Nature", duration: "demi-journ\xE9e" };
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "nature_reserve")
    return { category: "Nature", duration: "1h30" };
  if (tour === "viewpoint") return { category: "Nature", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}
var OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
async function fetchOverpass(query) {
  const attempt = async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1e4);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const els = data.elements ?? [];
      if (els.length === 0) throw new Error("empty");
      return els;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await Promise.any(OVERPASS_MIRRORS.map(attempt));
  } catch {
    return [];
  }
}
async function discoverOverpass(lat, lon, destination) {
  const q = `[out:json][timeout:25];(nwr["tourism"~"^(attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium)$"]["wikidata"](around:8000,${lat},${lon});nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site|fort)$"]["wikidata"](around:8000,${lat},${lon});nwr["leisure"~"^(park|garden|nature_reserve)$"]["wikidata"](around:9000,${lat},${lon});nwr["natural"~"^(peak|glacier|volcano|beach|waterfall)$"]["wikidata"](around:12000,${lat},${lon}););out center tags 80;`;
  const els = await fetchOverpass(q);
  if (els.length === 0) return [];
  const byName = /* @__PURE__ */ new Map();
  for (const el of els) {
    const tags = el.tags ?? {};
    const name = tags["name:fr"] || tags.name;
    if (!name || byName.has(name)) continue;
    const wp = tags.wikipedia;
    byName.set(name, {
      name,
      tags,
      wiki: wp && wp.startsWith("fr:") ? wp.slice(3) : void 0,
      qid: tags.wikidata,
      category: classifyTags(tags).category,
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon
    });
  }
  if (byName.size === 0) return [];
  const entries = [...byName.values()];
  const qids = entries.map((e) => e.qid).filter((q2) => !!q2).slice(0, 50);
  const fame = {};
  if (qids.length > 0) {
    const wd = await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join("|")}&props=sitelinks&format=json`,
      1e4
    );
    for (const [qid, ent] of Object.entries(wd?.entities ?? {})) {
      fame[qid] = Object.keys(ent.sitelinks ?? {}).length;
    }
  }
  const buckets = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (!buckets.has(e.category)) buckets.set(e.category, []);
    buckets.get(e.category).push(e);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => (fame[b.qid ?? ""] ?? 0) - (fame[a.qid ?? ""] ?? 0));
  }
  if (buckets.has("Nature"))
    buckets.set("Nature", buckets.get("Nature").slice(0, 6));
  const cats = [...buckets.keys()];
  const ordered = [];
  for (let round = 0; ordered.length < 16; round++) {
    let progressed = false;
    for (const c of cats) {
      const arr = buckets.get(c);
      if (arr[round]) {
        ordered.push(arr[round]);
        progressed = true;
        if (ordered.length >= 16) break;
      }
    }
    if (!progressed) break;
  }
  const extracts = await fetchExtracts(
    ordered.map((e) => e.wiki).filter((t) => !!t)
  );
  return ordered.map((e) => {
    const { category, duration } = classifyTags(e.tags);
    const extract = e.wiki && extracts[e.wiki] || "";
    return {
      name: e.name,
      description: (extract || `Lieu r\xE9el \xE0 d\xE9couvrir \xE0 ${destination}.`).slice(
        0,
        240
      ),
      category,
      duration,
      bookingUrl: mapsLink(e.name, destination),
      provider: "OpenStreetMap",
      wikiTitle: e.wiki,
      lat: e.lat,
      lon: e.lon
    };
  });
}

// server/services/classify.ts
function classifyTitle(title) {
  const t = title.toLowerCase();
  if (/spa|thermes|thermal|\bbains\b|bien-[êe]tre|wellness|sauna/.test(t))
    return { category: "Bien-\xEAtre", duration: "demi-journ\xE9e" };
  if (/t[ée]l[ée](ph[ée]|f[ée])rique|t[ée]l[ée]cabine|funiculaire|cr[ée]maill[èe]re|montenvers|\bgare de\b|petit train|train du|luge|patinoire|parc aquatique|aquarium|\bzoo\b/.test(
    t
  ))
    return { category: "Loisir", duration: "demi-journ\xE9e" };
  if (/mus[ée]e|galerie|fondation|th[ée][âa]tre|op[ée]ra/.test(t))
    return { category: "Culture", duration: "1h30" };
  if (/[ée]glise|temple|cath[ée]drale|basilique|chapelle|abbaye|monast[èe]re/.test(
    t
  ))
    return { category: "Culture", duration: "1h" };
  if (/mont|aiguille|\bpic\b|\blac\b|glacier|parc|jardin|cascade|gorges|plage|colline|sommet|\bcol\b|grotte|r[ée]serve|presqu/.test(
    t
  ))
    return { category: "Nature", duration: "demi-journ\xE9e" };
  if (/place|fontaine|\bpont\b|palais|ch[âa]teau|\btour\b|porte|\barc\b|forum|amphith[ée][âa]tre|colis[ée]e|ar[èe]nes|halle|hôtel de ville/.test(
    t
  ))
    return { category: "Culture", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}

// server/services/wikidata-filters.ts
async function sparqlItemSet(sparql, ms) {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  let data = await fetchJson(url, ms);
  if (!data?.results) {
    await new Promise((r) => setTimeout(r, 700));
    data = await fetchJson(url, ms);
  }
  if (!data?.results) return null;
  const set = /* @__PURE__ */ new Set();
  for (const b of data.results.bindings ?? []) {
    const id = b.item?.value?.split("/").pop();
    if (id) set.add(id);
  }
  return set;
}
var WD_PLACE_TYPES = [
  "wd:Q811979",
  // structure architecturale (bâtiments, tours, ponts, églises, palais…)
  "wd:Q570116",
  // attraction touristique
  "wd:Q839954",
  // site archéologique
  "wd:Q8502",
  "wd:Q54050",
  "wd:Q271669",
  // montagne, colline, relief
  "wd:Q23397",
  "wd:Q15324",
  "wd:Q23442",
  // lac, plan d'eau, île
  "wd:Q22698",
  "wd:Q4421",
  // parc, forêt
  "wd:Q83620",
  "wd:Q174782",
  // voie (avenue/rue), place publique
  "wd:Q123705",
  "wd:Q3257686",
  // quartier, localité
  "wd:Q39614",
  // cimetière
  // Musée (Q33506) : BEAUCOUP de musées sont typés « institution » SANS type
  // bâtiment → ils échouaient le filtre et n'arrivaient que via Wikivoyage (sans
  // vues, donc relégués sous des stades locaux). Ex. à Oslo : musée du Fram,
  // Kon-Tiki, navires vikings, Folkemuseum. Un musée est TOUJOURS visitable.
  "wd:Q33506"
  // musée
];
async function wikidataPlaceFilter(qids) {
  if (qids.length === 0) return /* @__PURE__ */ new Set();
  const chunks = [];
  for (let i = 0; i < qids.length; i += 100)
    chunks.push(qids.slice(i, i + 100));
  const keep = /* @__PURE__ */ new Set();
  let anySuccess = false;
  await Promise.all(
    chunks.map(async (c) => {
      const values = c.map((q) => `wd:${q}`).join(" ");
      const sparql = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P31/wdt:P279* ?s. VALUES ?s { ${WD_PLACE_TYPES.join(" ")} } }`;
      const r = await sparqlItemSet(sparql, 12e3);
      if (r === null) {
        for (const id of c) keep.add(id);
      } else {
        anySuccess = true;
        for (const id of r) keep.add(id);
      }
    })
  );
  return anySuccess ? keep : null;
}
async function wikidataPurge(qids) {
  if (qids.length === 0) return /* @__PURE__ */ new Set();
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const waterLand = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P31/wdt:P279* ?b. VALUES ?b { wd:Q355304 wd:Q47053 wd:Q37901 wd:Q46831 wd:Q159719 wd:Q728937 } }`;
  const adminArea = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } { ?item wdt:P31/wdt:P279* wd:Q486972. FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* ?q. VALUES ?q { wd:Q123705 wd:Q2983893 } } } UNION { ?item wdt:P31/wdt:P279* wd:Q28575. FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } } }`;
  const artInBuilding = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P31 ?at. VALUES ?at { wd:Q860861 wd:Q3305213 wd:Q179700 wd:Q22669139 wd:Q838948 wd:Q4502142 } ?item wdt:P276 ?loc. ?loc wdt:P31/wdt:P279* ?bt. VALUES ?bt { wd:Q33506 wd:Q1370598 wd:Q16970 wd:Q41176 wd:Q16560 } }`;
  const lost = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P31/wdt:P279* wd:Q4140840. }`;
  const demolished = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ?item wdt:P576 ?dem. FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } }`;
  const parts = await Promise.all([
    sparqlItemSet(waterLand, 8e3),
    sparqlItemSet(adminArea, 9e3),
    sparqlItemSet(artInBuilding, 1e4),
    sparqlItemSet(lost, 8e3),
    sparqlItemSet(demolished, 8e3)
  ]);
  const drop = /* @__PURE__ */ new Set();
  for (const part of parts) for (const id of part ?? []) drop.add(id);
  return drop;
}
async function wikidataClassifyDemote(qids) {
  const out = {
    transit: /* @__PURE__ */ new Set(),
    sports: /* @__PURE__ */ new Set(),
    summits: /* @__PURE__ */ new Set(),
    hoods: /* @__PURE__ */ new Set(),
    infra: /* @__PURE__ */ new Set()
  };
  if (qids.length === 0) return out;
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql = `SELECT DISTINCT ?item ?kind WHERE { VALUES ?item { ${values} } { ?item wdt:P31/wdt:P279* ?tt. VALUES ?tt { wd:Q55488 wd:Q928830 wd:Q494829 wd:Q1248784 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } BIND("t" AS ?kind) } UNION { ?item wdt:P31/wdt:P279* ?sv. VALUES ?sv { wd:Q483110 wd:Q1076486 wd:Q641226 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q1109069 } BIND("s" AS ?kind) } UNION { ?item wdt:P31/wdt:P279* ?mt. VALUES ?mt { wd:Q8502 wd:Q207326 } BIND("m" AS ?kind) } UNION { ?item wdt:P31/wdt:P279* ?nb. VALUES ?nb { wd:Q123705 wd:Q2983893 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q40080 } BIND("n" AS ?kind) } UNION { ?item wdt:P31/wdt:P279* ?in. VALUES ?in { wd:Q24853940 wd:Q31855 } FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q33506 } BIND("i" AS ?kind) } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  let data = await fetchJson(url, 9e3);
  if (!data) {
    await new Promise((r) => setTimeout(r, 300));
    data = await fetchJson(url, 9e3);
  }
  if (!data) return out;
  for (const b of data.results?.bindings ?? []) {
    const qid = b.item?.value?.split("/").pop();
    if (!qid) continue;
    if (b.kind?.value === "t") out.transit.add(qid);
    else if (b.kind?.value === "s") out.sports.add(qid);
    else if (b.kind?.value === "m") out.summits.add(qid);
    else if (b.kind?.value === "n") out.hoods.add(qid);
    else if (b.kind?.value === "i") out.infra.add(qid);
  }
  return out;
}

// server/services/wikipedia.ts
var WIKI_BLOCK = /unit[ée] urbaine|communaut[ée]|\bcanton\b|arrondissement|jeux olympiques|festival|cosmo|cimeti[èe]re|tunnel|quartier|vall[ée]e de|gare des|gare de [a-zà-ÿ' -]+-mont-blanc$|presbyt[èe]re|liste de|^avenue |^rue | rue |^boulevard |^cours [a-zà-ÿ]|tramway|\btram\b|m[ée]tro\b|m[ée]tropole|^pays |\bsi[èe]ge de\b|bataille de|trait[ée] de|congr[èe]s|incendie|attentat|bombardement|occupation|annexion|lib[ée]ration de|^immeuble |^maison (?!de la culture)|^h[ôo]tel (?!de ville|dieu|de r[ée]gion)|^ligne |a[ée]roport|h[ôo]pital|lyc[ée]e|coll[èe]ge|universit[ée]/i;
async function resolveWikidataIds(titles) {
  const out = /* @__PURE__ */ new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&titles=` + encodeURIComponent(batch.join("|"));
    const data = await fetchJson(url);
    for (const p of Object.values(data?.query?.pages ?? {})) {
      if (p.title && p.pageprops?.wikibase_item)
        out.set(p.title, p.pageprops.wikibase_item);
    }
  }
  return out;
}
async function discoverWikipedia(lat, lon, destination) {
  const geoUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=90&format=json`;
  const geoData = await fetchJson(geoUrl);
  const results = geoData?.query?.geosearch ?? [];
  if (results.length === 0) return [];
  const coordOf = new Map(results.map((r) => [r.title, r]));
  const destLower = destination.toLowerCase().split(/[,(]/)[0].trim();
  const isTown = (t) => t === destLower || t.replace(/[-\s](mont-blanc|sur-mer|les-bains)$/, "").trim() === destLower;
  const pre = results.map((r) => r.title).filter((t) => !WIKI_BLOCK.test(t.toLowerCase()) && !isTown(t.toLowerCase())).slice(0, 45);
  if (pre.length === 0) return [];
  const qidOf = await resolveWikidataIds(pre);
  const placeIds = await wikidataPlaceFilter([...new Set(qidOf.values())]);
  const titles = (placeIds === null ? pre : pre.filter((t) => {
    const q = qidOf.get(t);
    return q ? placeIds.has(q) : true;
  })).slice(0, 28);
  if (titles.length === 0) return [];
  const extracts = await fetchExtracts(titles);
  return titles.map((title) => {
    const { category, duration } = classifyTitle(title);
    return {
      name: title,
      description: (extracts[title] || `Lieu r\xE9el \xE0 d\xE9couvrir \xE0 ${destination}.`).slice(0, 240),
      category,
      duration,
      bookingUrl: mapsLink(title, destination),
      provider: "Wikip\xE9dia",
      wikiTitle: title,
      // titre FR canonique → vraies vues FR+EN au top-up
      lat: coordOf.get(title)?.lat,
      lon: coordOf.get(title)?.lon
    };
  });
}

// server/services/wikivoyage.ts
function stripWiki(s) {
  return s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "").replace(/<ref[^>]*\/>/gi, "").replace(/<\/?[^>]+>/g, "").replace(/\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1").replace(/\{\{[^{}]*\}\}/g, "").replace(/'''?/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function wvBlocks(wikitext, name) {
  const blocks = [];
  const re = new RegExp(`\\{\\{\\s*${name}\\b`, "gi");
  let m;
  while (m = re.exec(wikitext)) {
    let i = m.index + 2;
    let depth = 1;
    const start = i;
    while (i < wikitext.length && depth > 0) {
      const two = wikitext.slice(i, i + 2);
      if (two === "{{") {
        i += 2;
        depth++;
      } else if (two === "}}") {
        i += 2;
        depth--;
      } else {
        i++;
      }
    }
    blocks.push(wikitext.slice(start, i - 2));
    re.lastIndex = i;
  }
  return blocks;
}
function wvFields(block) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < block.length; i++) {
    const two = block.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      cur += two;
      i++;
    } else if (two === "}}" || two === "]]") {
      if (depth > 0) depth--;
      cur += two;
      i++;
    } else if (block[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += block[i];
    }
  }
  parts.push(cur);
  const out = {};
  for (const p of parts) {
    const eq8 = p.indexOf("=");
    if (eq8 > 0)
      out[p.slice(0, eq8).trim().toLowerCase()] = p.slice(eq8 + 1).trim();
  }
  return out;
}
async function wvWikitext(title) {
  const url = `https://fr.wikivoyage.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(
    title
  )}&format=json`;
  const data = await fetchJson(url);
  const page = Object.values(data?.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.["*"] ?? null;
}
var WV_BLOCK = /office de tourisme|information[s]? touristique|syndicat d'initiative|maison du tourisme|pr[ée]fecture|sous-pr[ée]fecture|\bmairie\b|h[ôo]tel de ville|consulat|ambassade|\bgare\b|gare routi[èe]re|a[ée]roport|\bparking\b|station-service|station service|h[ôo]pital|clinique|pharmacie|\bla poste\b|bureau de poste|commissariat|gendarmerie|\bbanque\b|distributeur|bureau de change|laverie|location de v[ée]lo|\btaxi\b|supermarch[ée]|\blyc[ée]e\b|\bcoll[èe]ge\b|universit[ée]|palais de justice|\btribunal\b/i;
async function discoverWikivoyage(destination) {
  const q = destination.split(/[,(]/)[0].trim();
  let wikitext = await wvWikitext(q);
  if (!wikitext) {
    const sUrl = `https://fr.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q
    )}&srlimit=1&format=json`;
    const sd = await fetchJson(sUrl);
    const title = sd?.query?.search?.[0]?.title;
    if (title) wikitext = await wvWikitext(title);
  }
  if (!wikitext) return [];
  const wt = wikitext;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const collect = (tpl, isActivity) => {
    for (const block of wvBlocks(wt, tpl)) {
      const f = wvFields(block);
      const name = stripWiki(f["nom"] || "");
      const k = name.toLowerCase();
      if (name.length < 2 || seen.has(k) || WV_BLOCK.test(k)) continue;
      seen.add(k);
      const guess = classifyTitle(name);
      const generic = guess.category === "Visite";
      const lat = parseFloat(f["latitude"] ?? "");
      const lon = parseFloat(f["longitude"] ?? "");
      out.push({
        name,
        description: (stripWiki(f["description"] || "") || stripWiki(f["adresse"] || "") || `Lieu r\xE9el \xE0 d\xE9couvrir \xE0 ${destination}.`).slice(0, 240),
        category: isActivity && generic ? "Loisir" : guess.category,
        duration: isActivity && generic ? "demi-journ\xE9e" : guess.duration,
        bookingUrl: mapsLink(name, destination),
        provider: "Wikivoyage",
        wikiTitle: stripWiki(f["wikip\xE9dia"] || f["wikipedia"] || "") || void 0,
        lat: Number.isFinite(lat) ? lat : void 0,
        lon: Number.isFinite(lon) ? lon : void 0
      });
    }
  };
  collect("voir", false);
  collect("faire", true);
  return out.slice(0, 18);
}

// server/services/ranking.ts
var import_node_fs2 = require("node:fs");
var PV_CACHE = /* @__PURE__ */ new Map();
var PV_TTL = 14 * 24 * 60 * 60 * 1e3;
var PV_CACHE_MAX = 2e4;
var PV_CACHE_PATH = process.env.PGLITE_DIR || process.env.DATABASE_URL ? null : "./data/.cache/pv.json";
var pvLoaded = false;
var pvDirty = 0;
function loadPvCache() {
  if (pvLoaded) return;
  pvLoaded = true;
  if (!PV_CACHE_PATH || !(0, import_node_fs2.existsSync)(PV_CACHE_PATH)) return;
  try {
    const obj = JSON.parse((0, import_node_fs2.readFileSync)(PV_CACHE_PATH, "utf8"));
    for (const [k, val] of Object.entries(obj)) PV_CACHE.set(k, val);
  } catch {
  }
}
function savePvCache() {
  if (!PV_CACHE_PATH) return;
  try {
    (0, import_node_fs2.mkdirSync)("./data/.cache", { recursive: true });
    const obj = {};
    for (const [k, val] of PV_CACHE) obj[k] = val;
    const tmp = `${PV_CACHE_PATH}.tmp`;
    (0, import_node_fs2.writeFileSync)(tmp, JSON.stringify(obj));
    (0, import_node_fs2.renameSync)(tmp, PV_CACHE_PATH);
  } catch {
  }
}
function flushViewsCache() {
  if (pvDirty > 0) {
    savePvCache();
    pvDirty = 0;
  }
}
async function wikiPageviews(lang, titles) {
  const out = /* @__PURE__ */ new Map();
  if (titles.length === 0) return out;
  loadPvCache();
  const now = /* @__PURE__ */ new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const end = `${now.getFullYear()}${mm}0100`;
  const start = `${now.getFullYear() - 3}${mm}0100`;
  const one = async (title) => {
    const key = `${lang}|${title}`;
    const hit = PV_CACHE.get(key);
    if (hit && now.getTime() - hit.at < PV_TTL) return hit.v;
    const enc = encodeURIComponent(title.replace(/ /g, "_"));
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/all-agents/${enc}/monthly/${start}/${end}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 400));
      const data = await fetchJson(url, 7e3);
      if (data) {
        let s = 0;
        for (const it of data.items ?? []) s += it.views ?? 0;
        PV_CACHE.set(key, { at: now.getTime(), v: s });
        capMap(PV_CACHE, PV_CACHE_MAX);
        if (++pvDirty >= 200) flushViewsCache();
        return s;
      }
    }
    return null;
  };
  const CONC = 6;
  for (let i = 0; i < titles.length; i += CONC) {
    const slice = titles.slice(i, i + CONC);
    const views = await Promise.all(slice.map((t) => one(t)));
    slice.forEach((t, k) => {
      if (views[k] !== null) out.set(t, views[k]);
    });
  }
  return out;
}
async function fetchPopularity(qids) {
  const result = /* @__PURE__ */ new Map();
  if (qids.length === 0) return result;
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql = `SELECT ?item ?frTitle ?enTitle WHERE { VALUES ?item { ${values} } OPTIONAL { ?fa schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>; schema:name ?frTitle. } OPTIONAL { ?ea schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enTitle. } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const data = await fetchJson(url, 12e3);
  const frOf = /* @__PURE__ */ new Map();
  const enOf = /* @__PURE__ */ new Map();
  for (const b of data?.results?.bindings ?? []) {
    const qid = b.item?.value?.split("/").pop();
    if (!qid) continue;
    if (b.frTitle?.value) frOf.set(qid, b.frTitle.value);
    if (b.enTitle?.value) enOf.set(qid, b.enTitle.value);
  }
  const [frViews, enViews] = await Promise.all([
    wikiPageviews("fr", [...new Set(frOf.values())]),
    wikiPageviews("en", [...new Set(enOf.values())])
  ]);
  for (const qid of qids) {
    const frT = frOf.get(qid);
    const fr = (frT ? frViews.get(frT) : void 0) ?? 0;
    const enT = enOf.get(qid);
    const en = (enT ? enViews.get(enT) : void 0) ?? 0;
    const total = fr + en;
    if (total > 0) result.set(qid, { total, fr });
  }
  return result;
}
async function resolveTitleMeta(frTitles) {
  const out = /* @__PURE__ */ new Map();
  for (let i = 0; i < frTitles.length; i += 50) {
    const batch = frTitles.slice(i, i + 50);
    const values = batch.map((t) => `"${t.replace(/[\\"]/g, " ")}"@fr`).join(" ");
    const sparql = `SELECT ?frT ?enT ?item WHERE { VALUES ?frT { ${values} } ?fa schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>; schema:name ?frT. OPTIONAL { ?ea schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enT. } }`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const data = await fetchJson(url, 12e3);
    for (const b of data?.results?.bindings ?? []) {
      const qid = b.item?.value?.split("/").pop();
      if (b.frT?.value && qid) out.set(b.frT.value, { enT: b.enT?.value, qid });
    }
  }
  return out;
}
async function fetchTitleViews(titles) {
  const uniq = [...new Set(titles.filter(Boolean))];
  if (uniq.length === 0) return /* @__PURE__ */ new Map();
  const meta = await resolveTitleMeta(uniq);
  const placeIds = await wikidataPlaceFilter([
    ...new Set([...meta.values()].map((m) => m.qid))
  ]);
  const enOf = [...meta.values()].map((m) => m.enT).filter(Boolean);
  const [frViews, enViews] = await Promise.all([
    wikiPageviews("fr", uniq),
    wikiPageviews("en", [...new Set(enOf)])
  ]);
  const out = /* @__PURE__ */ new Map();
  for (const t of uniq) {
    const m = meta.get(t);
    if (m && placeIds !== null && !placeIds.has(m.qid)) continue;
    const fr = frViews.get(t) ?? 0;
    const en = m?.enT ? enViews.get(m.enT) ?? 0 : 0;
    const total = fr + en;
    if (total > 0) out.set(t, total);
  }
  return out;
}

// server/services/wikidata.ts
var WD_BAD_TYPES = /* @__PURE__ */ new Set([
  "Q515",
  "Q1549591",
  "Q5119",
  "Q484170",
  "Q3957",
  "Q532",
  "Q15284",
  "Q702842",
  "Q6256",
  "Q3624078",
  "Q7275",
  "Q3024240",
  "Q34770",
  "Q43229",
  "Q193483",
  "Q327333",
  "Q163740",
  "Q4830453",
  "Q161726",
  "Q5",
  "Q1656682",
  "Q1190554",
  // émeute / révolte (Q124757 : « Journée des Tuiles » à Grenoble) — sous-classe
  // d'événement non captée par l'exact-match des supertypes, et que le filtre « lieu »
  // laisse parfois passer sous charge → exclue d'office ici (type déjà en mémoire, 0 réseau).
  "Q124757",
  // finale sportive (Q1366722) / finale de foot (Q65770283) : un MATCH géotaggé au stade
  // (« Finale de la Coupe du monde des clubs FIFA 2014 » au Grand Stade de Marrakech) = un
  // ÉVÉNEMENT, pas un lieu. Sous-classe de « sporting event » (Q16510064) NON captée par
  // Q1656682 ; le filtre « lieu » la laisse passer en fail-open → exclue ici (local, 0 réseau).
  "Q1366722",
  "Q65770283",
  "Q13418847",
  "Q178561",
  "Q198",
  "Q2223653",
  "Q3199915",
  "Q56061",
  "Q10864048",
  "Q82794",
  "Q34876",
  "Q1799794",
  "Q15916867",
  "Q11514315",
  "Q11772",
  "Q3918",
  "Q38723",
  "Q41710",
  // Régions, universités historiques, entités/ordres/traités de droit international.
  "Q36784",
  "Q3551775",
  "Q4671277",
  "Q15893266",
  "Q391009",
  "Q474717",
  "Q1896989",
  "Q2311325",
  "Q1063239",
  "Q1147274",
  "Q1414472",
  "Q16567729",
  // Entreprises/sociétés (le siège est un bâtiment, mais ça ne se « visite » pas).
  "Q891723",
  "Q6881511",
  "Q783794",
  "Q4830453",
  // Grandes surfaces (Carrefour…) : chaîne de magasins / chaîne de supermarchés.
  // On NE bannit PAS « grand magasin » (Q216107) → Galeries Lafayette, Printemps,
  // La Samaritaine (iconiques) restent.
  "Q507619",
  "Q18043413",
  // Défense en profondeur : non-lieux qui fuiteraient si le filtre « lieu »
  // échouait — page d'homonymie (Q4167410) et groupe de peintures (Q18573970,
  // ex. Le Cri). Filtrés en JS d'office, sans dépendre de la requête SPARQL.
  "Q4167410",
  "Q18573970"
  // NB : on ne bannit PLUS les types « œuvre d'art » (sculpture/peinture/fresque) :
  // ça excluait à tort Trevi (site touristique ET sculpture). C'est le filtre
  // « lieu » (wikidataPlaceFilter) qui écarte les œuvres pures non visitables.
]);
var STADIUM_VIEWS_MIN = 25e4;
var SUMMIT_KEEP = 5;
var LANE_TYPES = ["Q570116", "Q33506"];
async function wikidataAround(lat, lon, minSitelinks, radiusKm) {
  const sparql = `SELECT ?item ?label ?sitelinks ?type ?image ?c WHERE {SERVICE wikibase:around { ?item wdt:P625 ?c. bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral. bd:serviceParam wikibase:radius "${radiusKm}". }?item wikibase:sitelinks ?sitelinks. FILTER(?sitelinks >= ${minSitelinks})?item wdt:P31 ?type. ?item rdfs:label ?label. FILTER(lang(?label) = "fr")OPTIONAL { ?item wdt:P18 ?image. }} ORDER BY DESC(?sitelinks) LIMIT 500`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  let data = await fetchJson(url, 16e3);
  if (!data?.results) {
    await new Promise((r) => setTimeout(r, 800));
    data = await fetchJson(url, 16e3);
  }
  const byId = /* @__PURE__ */ new Map();
  for (const b of data?.results?.bindings ?? []) {
    const id = b.item?.value?.split("/").pop();
    const label = b.label?.value;
    if (!id || !label) continue;
    let a = byId.get(id);
    if (!a) {
      a = {
        label,
        sitelinks: Number(b.sitelinks?.value) || 0,
        types: /* @__PURE__ */ new Set()
      };
      byId.set(id, a);
    }
    const ty = b.type?.value?.split("/").pop();
    if (ty) a.types.add(ty);
    if (!a.image && b.image?.value) a.image = b.image.value;
    if (a.lat == null && b.c?.value) {
      const m = b.c.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
      if (m) {
        a.lon = parseFloat(m[1]);
        a.lat = parseFloat(m[2]);
      }
    }
  }
  return byId;
}
async function discoverWikidata(lat, lon, destination) {
  const byId = await wikidataAround(lat, lon, 8, 20);
  if (byId.size === 0) return [];
  const destLow = destination.toLowerCase().split(/[,(]/)[0].trim();
  const candidates = [...byId.entries()].filter(
    ([, a]) => ![...a.types].some((t) => WD_BAD_TYPES.has(t)) && a.label.toLowerCase() !== destLow
  ).sort((a, b) => b[1].sitelinks - a[1].sitelinks).slice(0, 400);
  if (candidates.length === 0) return [];
  const placeIds = await wikidataPlaceFilter(candidates.map(([id]) => id));
  const survivors = placeIds ? candidates.filter(([id]) => placeIds.has(id)) : candidates;
  const [drop, demote] = await Promise.all([
    wikidataPurge(survivors.map(([id]) => id)),
    wikidataClassifyDemote(survivors.map(([id]) => id))
  ]);
  const OUT_BASE = 250;
  const OUT_HARD = 300;
  const out = [];
  const outIds = [];
  const attractionIdx = [];
  for (const [id, a] of survivors) {
    if (drop.has(id)) continue;
    const isAttraction = LANE_TYPES.some((t) => a.types.has(t));
    if (out.length >= OUT_BASE && !isAttraction) continue;
    if (out.length >= OUT_HARD) break;
    const { category, duration } = classifyTitle(a.label);
    out.push({
      name: a.label,
      description: "",
      category,
      duration,
      bookingUrl: mapsLink(a.label, destination),
      provider: "Wikidata",
      fame: a.sitelinks,
      wikiTitle: a.label,
      imageUrl: a.image ? a.image.replace(/^http:/, "https:") + "?width=800" : void 0,
      // transit + quartier résidentiel + infra/labo : rétrogradés d'office (cf.
      // wikidataClassifyDemote). Stades/sommets traités à part (conditionnels, plus bas).
      demote: demote.transit.has(id) || demote.hoods.has(id) || demote.infra.has(id) || void 0,
      lat: a.lat,
      lon: a.lon
    });
    if (isAttraction) attractionIdx.push(out.length - 1);
    outIds.push(id);
  }
  const PROBE_TOP = 300;
  const ATTRACTION_PROBE_CAP = 40;
  const probeIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < Math.min(PROBE_TOP, outIds.length); i++)
    probeIds.add(outIds[i]);
  let extraProbes = 0;
  for (const i of attractionIdx) {
    if (i < PROBE_TOP) continue;
    if (extraProbes >= ATTRACTION_PROBE_CAP) break;
    probeIds.add(outIds[i]);
    extraProbes++;
  }
  const popularity = await fetchPopularity([...probeIds]);
  out.forEach((p, i) => {
    const pop = popularity.get(outIds[i]);
    if (pop && pop.total > 0) {
      p.fame = pop.total;
      p.views = pop.total;
    }
  });
  const sportIdx = outIds.map((id, i) => i).filter((i) => demote.sports.has(outIds[i]));
  const frV = (i) => popularity.get(outIds[i])?.fr ?? 0;
  let topI = -1;
  for (const i of sportIdx) {
    if (topI < 0 || frV(i) > frV(topI)) topI = i;
  }
  for (const i of sportIdx) {
    const keep = i === topI && frV(i) >= STADIUM_VIEWS_MIN;
    if (!keep) out[i].demote = true;
  }
  const summitIdx = outIds.map((id, i) => i).filter((i) => demote.summits.has(outIds[i])).sort((a, b) => (out[b].views ?? 0) - (out[a].views ?? 0));
  summitIdx.slice(SUMMIT_KEEP).forEach((i) => {
    out[i].demote = true;
  });
  out.sort((a, b) => {
    if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
    return (b.views ?? b.fame ?? 0) - (a.views ?? a.fame ?? 0);
  });
  return out.slice(0, 60);
}

// server/services/places.ts
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL = 6 * 60 * 60 * 1e3;
var CACHE_TTL_DEGRADED = 15 * 60 * 1e3;
var SUGG_CACHE_MAX = 500;
var NOISE_BLOCK = /\bprovince\b|ville m[ée]tropolitaine|\bm[ée]tropole\b|communaut[ée]|\bcanton\b|arrondissement|\bd[ée]partement\b|unit[ée] urbaine|aire urbaine|intercommunalit[ée]|dioc[èe]se|g[ée]n[ée]ralit[ée]|universit[ée]|saint-si[èe]ge|ordre souverain|pr[ée]lature|convention|trait[ée] de\b|\baccord\b|conf[ée]rence|protocole|\bpacte\b|\bann[ée]e des\b|\bm[ée]tro\b|organisation|\bagence\b|\bfestival\b|biennale|\bchampionnat|jeux olympiques|\b[ée]lections?\b|\bconcours\b|\battaque\b|assassinat|attentat|\bop[ée]ration\b|\binvasion\b|\boffensive\b|bombardement|\bbataille\b|massacre|\bgare\b|gare routi[èe]re|a[ée]roport|\bpass\b|\bevjf\b|\bevg\b/i;
var PLACE_TYPE_PREFIX = /^(?:basilique|cathedrale|eglise|chapelle|abbaye|monastere|musee|stade|chateau|palais|pont|theatre|opera|fontaine|halle|arenes|parc|jardin|fort) /;
function dedupKey(name, dest) {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const d = norm(dest.split(",")[0]);
  let k = norm(name);
  if (d)
    k = k.replace(new RegExp(`(?:\\s(?:de|d|du|des|la|le|l))?\\s${d}$`), "").trim();
  return k;
}
function isNearDup(k1, k2) {
  const a = k1.length <= k2.length ? k1 : k2;
  const b = k1.length <= k2.length ? k2 : k1;
  const pref = b.match(PLACE_TYPE_PREFIX);
  if (pref && b.slice(pref[0].length) === a) return true;
  if (!b.startsWith(a + " ")) return false;
  const suffix = b.slice(a.length + 1);
  if (/^(terminal|station|gare|terminus)$/.test(suffix)) return true;
  return a.length >= 30 && // (3)
  suffix.length <= 14 && /^(de|du|des|de la|de l)\s/.test(suffix + " ");
}
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function shareToken(k1, k2) {
  const t2 = new Set(k2.split(" ").filter((t) => t.length >= 4));
  return k1.split(" ").some((t) => t.length >= 4 && t2.has(t));
}
var inFlight = /* @__PURE__ */ new Map();
async function fetchPlaceActivities(destination) {
  const key = destination.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.places;
  const running = inFlight.get(key);
  if (running) return running;
  const p = doFetchPlaceActivities(destination, key);
  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}
var FINAL_LIMIT = 50;
var PER_CATEGORY_HEAD = 20;
function curate(pool) {
  const perCat = {};
  const curated = [];
  const overflow = [];
  for (const p of pool) {
    if (curated.length >= FINAL_LIMIT) break;
    perCat[p.category] = (perCat[p.category] ?? 0) + 1;
    if (perCat[p.category] > PER_CATEGORY_HEAD) {
      overflow.push(p);
      continue;
    }
    curated.push(p);
  }
  for (const p of overflow) {
    if (curated.length >= FINAL_LIMIT) break;
    curated.push(p);
  }
  return curated;
}
async function doFetchPlaceActivities(destination, key) {
  try {
    const geo = await geocode(destination);
    if (!geo) return [];
    const [wd, fs2, wv, ov, wk] = await Promise.all([
      discoverWikidata(geo.lat, geo.lon, destination).catch(
        () => []
      ),
      discoverFoursquare(geo.lat, geo.lon, destination).catch(
        () => []
      ),
      discoverWikivoyage(destination).catch(() => []),
      discoverOverpass(geo.lat, geo.lon, destination).catch(
        () => []
      ),
      discoverWikipedia(geo.lat, geo.lon, destination).catch(
        () => []
      )
    ]);
    const wikipediaFallback = wd.length >= 20 ? [] : wk;
    const seen = /* @__PURE__ */ new Set();
    const seenKeys = [];
    const merged = [];
    for (const p of [...wd, ...fs2, ...wv, ...ov, ...wikipediaFallback]) {
      if (!p.name || NOISE_BLOCK.test(p.name)) continue;
      const k = dedupKey(p.name, destination);
      if (!k || seen.has(k)) continue;
      if (seenKeys.some((s) => isNearDup(k, s))) continue;
      if (p.lat != null && p.lon != null && merged.some(
        (m, i) => m.lat != null && m.lon != null && distanceMeters(p.lat, p.lon, m.lat, m.lon) < 110 && shareToken(k, seenKeys[i])
      ))
        continue;
      seen.add(k);
      seenKeys.push(k);
      merged.push(p);
      if (merged.length >= 90) break;
    }
    await enrichWikiMedia(merged);
    const admissible = (p) => !!p.imageUrl || (p.fame ?? 0) >= 8;
    const candidates = merged.filter(admissible);
    const needViews = candidates.filter((p) => p.views == null);
    if (needViews.length > 0) {
      const tv = await fetchTitleViews(
        needViews.map((p) => p.wikiTitle || p.name)
      );
      for (const p of needViews) {
        const v = tv.get(p.wikiTitle || p.name);
        if (v && v > 0) p.views = v;
      }
    }
    const ranked = candidates.sort((a, b) => {
      if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
      const av = a.views != null;
      const bv = b.views != null;
      if (av !== bv) return av ? -1 : 1;
      if (av && bv) return b.views - a.views;
      return (b.fame ?? 0) - (a.fame ?? 0);
    });
    const deduped = [];
    for (const p of ranked) {
      const v = p.views ?? 0;
      const dup = v > 0 && p.lat != null && p.lon != null && deduped.some(
        (s) => (s.views ?? 0) === v && s.lat != null && s.lon != null && distanceMeters(p.lat, p.lon, s.lat, s.lon) < 200
      );
      if (!dup) deduped.push(p);
    }
    const withPhoto = deduped.filter((p) => p.imageUrl);
    const pool = withPhoto.length >= 5 ? withPhoto : deduped;
    const curated = curate(pool);
    if (curated.length > 0) {
      const ttl = wd.length > 0 ? CACHE_TTL : CACHE_TTL_DEGRADED;
      cache.set(key, { at: Date.now(), places: curated, ttl });
      capMap(cache, SUGG_CACHE_MAX);
    }
    return curated;
  } catch {
    return [];
  }
}

// server/routes/trips.ts
var router2 = (0, import_express2.Router)();
router2.use(requireAuth);
async function getMembership(tripId, userId) {
  const [m] = await db.select().from(tripMembers).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(tripMembers.tripId, tripId), (0, import_drizzle_orm5.eq)(tripMembers.userId, userId)));
  return m ?? null;
}
function warmSuggestions(destination) {
  const d = destination?.trim();
  if (!d) return;
  void fetchPlaceActivities(d).catch(() => {
  });
}
var createSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1).max(120),
  description: import_zod2.z.string().max(2e3).optional(),
  selectedDestination: import_zod2.z.string().max(200).optional(),
  targetDays: import_zod2.z.number().int().min(1).max(60).optional(),
  budgetType: import_zod2.z.enum(["\xC9conomique", "Mod\xE9r\xE9", "Luxe"]).optional()
});
var patchSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1).max(120).optional(),
  description: import_zod2.z.string().max(2e3).optional(),
  selectedDestination: import_zod2.z.string().max(200).optional(),
  targetDays: import_zod2.z.number().int().min(1).max(60).optional(),
  budgetType: import_zod2.z.enum(["\xC9conomique", "Mod\xE9r\xE9", "Luxe"]).optional(),
  averageLodgingCostPerNight: import_zod2.z.number().int().min(0).optional(),
  averageLocalTransportCostPerDay: import_zod2.z.number().int().min(0).optional(),
  externalTransportCost: import_zod2.z.number().int().min(0).optional()
});
router2.get("/", async (req, res) => {
  const rows = await db.select({
    id: trips.id,
    name: trips.name,
    description: trips.description,
    selectedDestination: trips.selectedDestination,
    targetDays: trips.targetDays,
    budgetType: trips.budgetType
  }).from(trips).innerJoin(tripMembers, (0, import_drizzle_orm5.eq)(tripMembers.tripId, trips.id)).where((0, import_drizzle_orm5.eq)(tripMembers.userId, req.user.id));
  res.json({ trips: rows });
});
router2.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides.", issues: parsed.error.issues });
    return;
  }
  const [trip] = await db.insert(trips).values({
    ownerId: req.user.id,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    selectedDestination: parsed.data.selectedDestination ?? "",
    targetDays: parsed.data.targetDays ?? 4,
    budgetType: parsed.data.budgetType ?? "Mod\xE9r\xE9"
  }).returning();
  await db.insert(tripMembers).values({ tripId: trip.id, userId: req.user.id, role: "owner" });
  warmSuggestions(parsed.data.selectedDestination);
  res.status(201).json({ trip: await loadTripAggregate(trip.id) });
});
router2.get("/:id", async (req, res) => {
  if (!await getMembership(req.params.id, req.user.id)) {
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
router2.patch("/:id", async (req, res) => {
  if (!await getMembership(req.params.id, req.user.id)) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Champs invalides." });
    return;
  }
  if (Object.keys(parsed.data).length > 0) {
    await db.update(trips).set(parsed.data).where((0, import_drizzle_orm5.eq)(trips.id, req.params.id));
  }
  warmSuggestions(parsed.data.selectedDestination);
  {
    const trip = await loadTripAggregate(req.params.id);
    broadcastTrip(req.params.id, trip);
    res.json({ trip });
  }
});
router2.delete("/:id", async (req, res) => {
  const [trip] = await db.select().from(trips).where((0, import_drizzle_orm5.eq)(trips.id, req.params.id));
  if (!trip) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  if (trip.ownerId !== req.user.id) {
    res.status(403).json({ error: "Seul le cr\xE9ateur peut supprimer ce voyage." });
    return;
  }
  await db.delete(trips).where((0, import_drizzle_orm5.eq)(trips.id, req.params.id));
  broadcastTripDeleted(req.params.id);
  res.status(204).end();
});
router2.post("/:id/join", async (req, res) => {
  const [trip] = await db.select().from(trips).where((0, import_drizzle_orm5.eq)(trips.id, req.params.id));
  if (!trip) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  if (!await getMembership(req.params.id, req.user.id)) {
    await db.insert(tripMembers).values({ tripId: req.params.id, userId: req.user.id, role: "member" });
  }
  {
    const trip2 = await loadTripAggregate(req.params.id);
    broadcastTrip(req.params.id, trip2);
    res.json({ trip: trip2 });
  }
});
var trips_default = router2;

// server/routes/trip-content.ts
var import_express3 = require("express");
var import_zod3 = require("zod");
var import_drizzle_orm6 = require("drizzle-orm");
var router3 = (0, import_express3.Router)();
router3.use(requireAuth);
async function requireMembership(req, res, next) {
  const [m] = await db.select().from(tripMembers).where(
    (0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(tripMembers.tripId, req.params.id),
      (0, import_drizzle_orm6.eq)(tripMembers.userId, req.user.id)
    )
  );
  if (!m) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  next();
}
async function respondTrip(res, tripId) {
  const trip = await loadTripAggregate(tripId);
  broadcastTrip(tripId, trip);
  res.json({ trip });
}
router3.post("/:id/availabilities", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({ start: import_zod3.z.string(), end: import_zod3.z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dates invalides." });
    return;
  }
  await db.insert(availabilities).values({
    tripId: req.params.id,
    userId: req.user.id,
    start: parsed.data.start,
    end: parsed.data.end
  });
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/availabilities/:availId", requireMembership, async (req, res) => {
  await db.delete(availabilities).where(
    (0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(availabilities.id, req.params.availId),
      (0, import_drizzle_orm6.eq)(availabilities.tripId, req.params.id),
      (0, import_drizzle_orm6.eq)(availabilities.userId, req.user.id)
    )
  );
  await respondTrip(res, req.params.id);
});
router3.post("/:id/destinations", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({ name: import_zod3.z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nom invalide." });
    return;
  }
  const [dest] = await db.insert(destinations).values({
    tripId: req.params.id,
    name: parsed.data.name,
    proposedBy: req.user.displayName
  }).returning();
  await db.insert(destinationVotes).values({ destinationId: dest.id, userId: req.user.id });
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/destinations/:destId", requireMembership, async (req, res) => {
  await db.delete(destinations).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(destinations.id, req.params.destId), (0, import_drizzle_orm6.eq)(destinations.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});
router3.post("/:id/destinations/:destId/vote", requireMembership, async (req, res) => {
  const existing = await db.select().from(destinationVotes).where(
    (0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(destinationVotes.destinationId, req.params.destId),
      (0, import_drizzle_orm6.eq)(destinationVotes.userId, req.user.id)
    )
  );
  if (existing.length > 0) {
    await db.delete(destinationVotes).where(
      (0, import_drizzle_orm6.and)(
        (0, import_drizzle_orm6.eq)(destinationVotes.destinationId, req.params.destId),
        (0, import_drizzle_orm6.eq)(destinationVotes.userId, req.user.id)
      )
    );
  } else {
    await db.insert(destinationVotes).values({ destinationId: req.params.destId, userId: req.user.id });
  }
  await respondTrip(res, req.params.id);
});
var activityInput = import_zod3.z.object({
  name: import_zod3.z.string().min(1),
  description: import_zod3.z.string().default(""),
  cost: import_zod3.z.number().int().default(0),
  category: import_zod3.z.string().default(""),
  proposedBy: import_zod3.z.string().optional(),
  source: import_zod3.z.string().optional(),
  rating: import_zod3.z.number().optional(),
  reviewsCount: import_zod3.z.number().int().optional(),
  duration: import_zod3.z.string().optional(),
  bookingUrl: import_zod3.z.string().optional(),
  imageUrl: import_zod3.z.string().optional()
});
router3.post("/:id/activities", requireMembership, async (req, res) => {
  const parsed = activityInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Activit\xE9 invalide." });
    return;
  }
  const [act] = await db.insert(activities).values({ tripId: req.params.id, ...parsed.data }).returning();
  await db.insert(activityVotes).values({ activityId: act.id, userId: req.user.id });
  await respondTrip(res, req.params.id);
});
router3.post("/:id/activities/bulk", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.array(activityInput).safeParse(req.body?.activities);
  if (!parsed.success) {
    res.status(400).json({ error: "Liste d'activit\xE9s invalide." });
    return;
  }
  if (parsed.data.length > 0) {
    const [agg] = await db.select({ m: (0, import_drizzle_orm6.max)(activities.sortRank) }).from(activities).where((0, import_drizzle_orm6.eq)(activities.tripId, req.params.id));
    const base = (agg?.m ?? -1) + 1;
    await db.insert(activities).values(parsed.data.map((a, i) => ({ tripId: req.params.id, ...a, sortRank: base + i })));
  }
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/activities", requireMembership, async (req, res) => {
  await db.delete(activities).where((0, import_drizzle_orm6.eq)(activities.tripId, req.params.id));
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/activities/:actId", requireMembership, async (req, res) => {
  await db.delete(activities).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(activities.id, req.params.actId), (0, import_drizzle_orm6.eq)(activities.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});
router3.post("/:id/activities/:actId/vote", requireMembership, async (req, res) => {
  const existing = await db.select().from(activityVotes).where(
    (0, import_drizzle_orm6.and)(
      (0, import_drizzle_orm6.eq)(activityVotes.activityId, req.params.actId),
      (0, import_drizzle_orm6.eq)(activityVotes.userId, req.user.id)
    )
  );
  if (existing.length > 0) {
    await db.delete(activityVotes).where(
      (0, import_drizzle_orm6.and)(
        (0, import_drizzle_orm6.eq)(activityVotes.activityId, req.params.actId),
        (0, import_drizzle_orm6.eq)(activityVotes.userId, req.user.id)
      )
    );
  } else {
    await db.insert(activityVotes).values({ activityId: req.params.actId, userId: req.user.id });
  }
  await respondTrip(res, req.params.id);
});
var itinerarySchema = import_zod3.z.array(
  import_zod3.z.object({
    day: import_zod3.z.number().int(),
    title: import_zod3.z.string().default(""),
    events: import_zod3.z.array(
      import_zod3.z.object({
        time: import_zod3.z.string(),
        endTime: import_zod3.z.string().optional(),
        description: import_zod3.z.string(),
        cost: import_zod3.z.number().int().default(0)
      })
    ).default([])
  })
);
router3.put("/:id/itinerary", requireMembership, async (req, res) => {
  const parsed = itinerarySchema.safeParse(req.body?.itinerary);
  if (!parsed.success) {
    res.status(400).json({ error: "Itin\xE9raire invalide." });
    return;
  }
  await db.delete(itineraryDays).where((0, import_drizzle_orm6.eq)(itineraryDays.tripId, req.params.id));
  for (const day of parsed.data) {
    const [d] = await db.insert(itineraryDays).values({ tripId: req.params.id, day: day.day, title: day.title }).returning();
    if (day.events.length > 0) {
      await db.insert(events).values(day.events.map((e) => ({ dayId: d.id, ...e })));
    }
  }
  await respondTrip(res, req.params.id);
});
router3.post("/:id/events", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({
    day: import_zod3.z.number().int().min(1),
    time: import_zod3.z.string(),
    endTime: import_zod3.z.string().optional(),
    description: import_zod3.z.string().min(1),
    cost: import_zod3.z.number().int().default(0),
    bookingUrl: import_zod3.z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "\xC9v\xE9nement invalide." });
    return;
  }
  let [dayRow] = await db.select().from(itineraryDays).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(itineraryDays.tripId, req.params.id), (0, import_drizzle_orm6.eq)(itineraryDays.day, parsed.data.day)));
  if (!dayRow) {
    [dayRow] = await db.insert(itineraryDays).values({
      tripId: req.params.id,
      day: parsed.data.day,
      title: `Jour ${parsed.data.day}`
    }).returning();
  }
  await db.insert(events).values({
    dayId: dayRow.id,
    time: parsed.data.time,
    endTime: parsed.data.endTime ?? null,
    description: parsed.data.description,
    cost: parsed.data.cost,
    bookingUrl: parsed.data.bookingUrl ?? null
  });
  await respondTrip(res, req.params.id);
});
router3.patch("/:id/events/:eventId", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({
    time: import_zod3.z.string().optional(),
    endTime: import_zod3.z.string().nullable().optional(),
    description: import_zod3.z.string().min(1).optional(),
    cost: import_zod3.z.number().int().optional(),
    bookingUrl: import_zod3.z.string().nullable().optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "\xC9tape invalide." });
    return;
  }
  const dayIds = (await db.select({ id: itineraryDays.id }).from(itineraryDays).where((0, import_drizzle_orm6.eq)(itineraryDays.tripId, req.params.id))).map((d) => d.id);
  if (dayIds.length > 0 && Object.keys(parsed.data).length > 0) {
    await db.update(events).set(parsed.data).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(events.id, req.params.eventId), (0, import_drizzle_orm6.inArray)(events.dayId, dayIds)));
  }
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/events/:eventId", requireMembership, async (req, res) => {
  const dayIds = (await db.select({ id: itineraryDays.id }).from(itineraryDays).where((0, import_drizzle_orm6.eq)(itineraryDays.tripId, req.params.id))).map((d) => d.id);
  if (dayIds.length > 0) {
    await db.delete(events).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(events.id, req.params.eventId), (0, import_drizzle_orm6.inArray)(events.dayId, dayIds)));
  }
  await respondTrip(res, req.params.id);
});
router3.post("/:id/messages", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({ text: import_zod3.z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message vide." });
    return;
  }
  await db.insert(messages).values({ tripId: req.params.id, userId: req.user.id, text: parsed.data.text });
  await respondTrip(res, req.params.id);
});
router3.post("/:id/documents", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({
    name: import_zod3.z.string().min(1),
    type: import_zod3.z.enum(["pdf", "image", "doc", "other"]).default("other"),
    size: import_zod3.z.string().default(""),
    url: import_zod3.z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Document invalide." });
    return;
  }
  await db.insert(documents).values({ tripId: req.params.id, uploadedBy: req.user.id, ...parsed.data });
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/documents/:docId", requireMembership, async (req, res) => {
  await db.delete(documents).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(documents.id, req.params.docId), (0, import_drizzle_orm6.eq)(documents.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});
router3.post("/:id/photos", requireMembership, async (req, res) => {
  const parsed = import_zod3.z.object({ url: import_zod3.z.string().min(1), caption: import_zod3.z.string().default("") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Photo invalide." });
    return;
  }
  await db.insert(photos).values({ tripId: req.params.id, uploadedBy: req.user.id, ...parsed.data });
  await respondTrip(res, req.params.id);
});
router3.delete("/:id/photos/:photoId", requireMembership, async (req, res) => {
  await db.delete(photos).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(photos.id, req.params.photoId), (0, import_drizzle_orm6.eq)(photos.tripId, req.params.id)));
  await respondTrip(res, req.params.id);
});
var trip_content_default = router3;

// server/routes/uploads.ts
var import_express4 = require("express");
var import_multer = __toESM(require("multer"), 1);
var import_node_crypto2 = require("node:crypto");
var import_node_fs3 = require("node:fs");
var import_node_path2 = __toESM(require("node:path"), 1);
var import_drizzle_orm7 = require("drizzle-orm");
var MAX_FILE_BYTES = 5 * 1024 * 1024;
var TRIP_QUOTA_BYTES = 50 * 1024 * 1024;
var UPLOAD_DIR = import_node_path2.default.resolve("data/uploads");
var ALLOWED = /^(image\/|application\/pdf)/;
var upload = (0, import_multer.default)({
  storage: import_multer.default.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED.test(file.mimetype));
  }
});
var router4 = (0, import_express4.Router)();
router4.use(requireAuth);
async function requireMembership2(req, res, next) {
  const [m] = await db.select().from(tripMembers).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(tripMembers.tripId, req.params.id), (0, import_drizzle_orm7.eq)(tripMembers.userId, req.user.id)));
  if (!m) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  next();
}
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
router4.post(
  "/:id/uploads",
  requireMembership2,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof import_multer.default.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Fichier trop volumineux (5 Mo maximum)." });
        return;
      }
      if (err) {
        res.status(400).json({ error: "T\xE9l\xE9versement invalide." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Aucun fichier re\xE7u (types accept\xE9s : images, PDF)." });
      return;
    }
    const existing = await db.select({ sizeBytes: documents.sizeBytes }).from(documents).where((0, import_drizzle_orm7.eq)(documents.tripId, req.params.id));
    const used = existing.reduce((s, d) => s + d.sizeBytes, 0);
    if (used + file.size > TRIP_QUOTA_BYTES) {
      res.status(413).json({ error: "Quota de stockage du voyage atteint (50 Mo)." });
      return;
    }
    const fileId = (0, import_node_crypto2.randomUUID)();
    await import_node_fs3.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await import_node_fs3.promises.writeFile(import_node_path2.default.join(UPLOAD_DIR, fileId), file.buffer);
    const type = file.mimetype.startsWith("image/") ? "image" : file.mimetype === "application/pdf" ? "pdf" : "other";
    await db.insert(documents).values({
      id: fileId,
      tripId: req.params.id,
      uploadedBy: req.user.id,
      name: file.originalname,
      type,
      size: humanSize(file.size),
      sizeBytes: file.size,
      mimeType: file.mimetype,
      url: `/api/trips/${req.params.id}/files/${fileId}`
    });
    res.status(201).json({ trip: await loadTripAggregate(req.params.id) });
  }
);
router4.get("/:id/files/:fileId", requireMembership2, async (req, res) => {
  const [doc] = await db.select().from(documents).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(documents.id, req.params.fileId), (0, import_drizzle_orm7.eq)(documents.tripId, req.params.id)));
  if (!doc) {
    res.status(404).json({ error: "Fichier introuvable." });
    return;
  }
  const filePath = import_node_path2.default.join(UPLOAD_DIR, doc.id);
  if (doc.mimeType) res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.name)}"`);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Fichier introuvable." });
  });
});
var uploads_default = router4;

// server/db/migrate-runner.ts
async function runMigrations() {
  await migrateDb();
  console.log("[migrate] base \xE0 jour.");
}

// server.ts
var import_node_http = require("node:http");

// server/services/highlights.ts
var WD_ART_TYPES = [
  "wd:Q3305213",
  "wd:Q22669139",
  "wd:Q860861",
  "wd:Q179700",
  "wd:Q838948",
  "wd:Q4502142",
  "wd:Q18573970"
];
var highlightsCache = /* @__PURE__ */ new Map();
var HL_TTL = 6 * 60 * 60 * 1e3;
var HL_TTL_EMPTY = 30 * 60 * 1e3;
var HL_CACHE_MAX = 2e3;
async function discoverPlaceHighlightsBatch(names) {
  const out = {};
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const missing = [];
  for (const name of uniq) {
    const hit = highlightsCache.get(name.toLowerCase());
    if (hit && Date.now() - hit.at < hit.ttl) out[name] = hit.items;
    else missing.push(name);
  }
  if (missing.length === 0) return out;
  const chunks = [];
  for (let i = 0; i < missing.length; i += 12)
    chunks.push(missing.slice(i, i + 12));
  const maps = await Promise.all(chunks.map((c) => highlightsChunk(c)));
  const merged = /* @__PURE__ */ new Map();
  for (const m of maps) for (const [k, v] of m) merged.set(k, v);
  for (const name of missing) {
    const items = merged.get(name.toLowerCase()) ?? [];
    out[name] = items;
    highlightsCache.set(name.toLowerCase(), {
      at: Date.now(),
      items,
      ttl: items.length ? HL_TTL : HL_TTL_EMPTY
    });
    capMap(highlightsCache, HL_CACHE_MAX);
  }
  return out;
}
async function highlightsChunk(names) {
  const result = /* @__PURE__ */ new Map();
  if (names.length === 0) return result;
  const vals = names.map((n) => `"${n.replace(/[\\"]/g, " ")}"@fr`).join(" ");
  const sparql = `SELECT DISTINCT ?lbl ?artLabel ?img ?sl WHERE {VALUES ?lbl { ${vals} }?place rdfs:label|skos:altLabel ?lbl.?art (wdt:P276|wdt:P195/wdt:P361*|wdt:P527/wdt:P276|wdt:P527/wdt:P195/wdt:P361*) ?place.?art wdt:P31 ?t. VALUES ?t { ${WD_ART_TYPES.join(" ")} }?art wikibase:sitelinks ?sl. FILTER(?sl >= 5)OPTIONAL { ?art wdt:P18 ?img. }?art rdfs:label ?artLabel. FILTER(lang(?artLabel) = "fr")} ORDER BY ?lbl DESC(?sl) LIMIT 400`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const data = await fetchJson(url, 15e3);
  const seen = /* @__PURE__ */ new Map();
  for (const b of data?.results?.bindings ?? []) {
    const lbl = b.lbl?.value?.toLowerCase();
    const artName = b.artLabel?.value?.trim();
    if (!lbl || !artName) continue;
    let items = result.get(lbl);
    if (!items) {
      items = [];
      result.set(lbl, items);
      seen.set(lbl, /* @__PURE__ */ new Set());
    }
    const dedup = seen.get(lbl);
    const ak = artName.toLowerCase();
    if (ak === lbl || dedup.has(ak) || items.length >= 6) continue;
    dedup.add(ak);
    items.push({
      name: artName,
      imageUrl: b.img?.value ? b.img.value.replace(/^http:/, "https:") + "?width=320" : void 0
    });
  }
  return result;
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express5.default)();
var PORT = Number(process.env.PORT) || 3e3;
app.set("trust proxy", 1);
app.use((0, import_helmet.default)({ contentSecurityPolicy: false }));
app.use((0, import_compression.default)());
app.use(import_express5.default.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use((0, import_cookie_parser.default)());
app.use(attachUser);
app.use("/api/auth", auth_default);
app.use("/api/trips", trips_default);
app.use("/api/trips", trip_content_default);
app.use("/api/trips", uploads_default);
var DESTINATIONS_DATABASE = {
  paris: [
    { name: "Ascension de la Tour Eiffel \u{1F5FC}", description: "Contemplez la capitale et ses c\xE9l\xE8bres ponts depuis le belv\xE9d\xE8re parisien.", cost: 28, category: "Visite" },
    { name: "Visite du Mus\xE9e du Louvre d'Art Classique \u{1F3A8}", description: "Admirez la Joconde, la V\xE9nus de Milo et des milliers de chefs-d'\u0153uvre historiques.", cost: 22, category: "Culture" },
    { name: "Fl\xE2nerie boh\xE8me \xE0 Montmartre & Sacr\xE9-C\u0153ur \u26EA", description: "Sillonnez les ruelles pittoresques de la butte \xE0 la rencontre des peintres de rue.", cost: 0, category: "Visite" },
    { name: "D\xE9gustation de macarons & Th\xE9 \xE0 Saint-Germain \u{1F9C1}", description: "Initiez vos papilles \xE0 la haute p\xE2tisserie fine dans un salon l\xE9gendaire.", cost: 20, category: "Gastronomie" },
    { name: "Croisi\xE8re fluviale romantique sur la Seine \u26F5", description: "Naviguez sous les ponts illumin\xE9s de Paris \xE0 la lueur des projecteurs.", cost: 16, category: "Loisir" },
    { name: "Pique-nique champ\xEAtre au Jardin du Luxembourg \u{1F333}", description: "Bordez les bassins historiques et profitez des chaises vertes sous les feuillages.", cost: 10, category: "Nature" },
    { name: "Session Shopping sur les boulevards Haussmann \u{1F6CD}\uFE0F", description: "Explorez les Galeries Lafayette sous leur majestueuse coupole en verre.", cost: 25, category: "Shopping" }
  ],
  rome: [
    { name: "Visite insolite du Colis\xE9e & du Forum Romain \u{1F3DB}\uFE0F", description: "Marchez au milieu des ruines mill\xE9naires et de l'ar\xE8ne des empereurs romains.", cost: 24, category: "Culture" },
    { name: "Balade nocturne de la Fontaine de Trevi & Panth\xE9on \u26F2", description: "Jetez une pi\xE8ce de monnaie pour assurer votre retour dans la Ville \xC9ternelle.", cost: 0, category: "Visite" },
    { name: "Atelier culinaire de fabrication de P\xE2tes fra\xEEches \u{1F35D}", description: "Fa\xE7onnez vos raviolis ou fettuccines avec un chef local au c\u0153ur du quartier de Trastevere.", cost: 45, category: "Gastronomie" },
    { name: "Fl\xE2nerie paisible dans les Jardins de la Villa Borghese \u{1F333}", description: "Louez une barque sur le lac ou d\xE9tendez-vous sous les grands pins parasols italiens.", cost: 8, category: "Nature" },
    { name: "Visite guid\xE9e des mus\xE9es du Vatican & Chapelle Sixtine \u26EA", description: "Contemplez la fresque magistrale peinte par Michel-Ange au plafond de la chapelle.", cost: 30, category: "Culture" },
    { name: "D\xE9gustation des glaces artisanales (Gelato) de l\xE9gende \u{1F366}", description: "Savourer d'authentiques glaces cr\xE9m\xE9es chez un ma\xEEtre artisan r\xE9put\xE9 depuis 1900.", cost: 6, category: "Gastronomie" }
  ],
  barcelone: [
    { name: "Visite magique de la Sagrada Fam\xEDlia de Gaud\xED \u{1F3F0}", description: "Explorez la nef d'arbres en pierre et les vitraux multicolores de cette basilique unique.", cost: 26, category: "Culture" },
    { name: "Parcours guid\xE9 f\xE9erique dans le Parc G\xFCell \u{1F98E}", description: "D\xE9couvrez les mosa\xEFques de salamandres en c\xE9ramique et les bancs ondul\xE9s du g\xE9nie de l'architecture.", cost: 13, category: "Visite" },
    { name: "Coucher de soleil suspendu aux Bunkers del Carmel \u{1F305}", description: "Pique-niquez au point culminant avec un panorama \xE0 360\xB0 sur toute la c\xF4te m\xE9diterran\xE9enne.", cost: 0, category: "Nature" },
    { name: "Plat culinaire de Tapas & Sangria au March\xE9 de Santa Caterina \u{1F958}", description: "Partagez de d\xE9licieuses patatas bravas, croquetas et jam\xF3n ib\xE9rico authentiques.", cost: 22, category: "Gastronomie" },
    { name: "Spectacle vibrant de Flamenco traditionnel au Born \u{1F483}", description: "Ressentez l'\xE9nergie fougueuse de la guitare espagnole et du chant andalou de premi\xE8re ligne.", cost: 30, category: "Loisir" },
    { name: "Balade les pieds dans le sable \xE0 la Barceloneta \u{1F30A}", description: "Fl\xE2nez sur le remblai maritime bord\xE9 de palmiers et respirez l'air marin rafra\xEEchissant.", cost: 0, category: "Nature" }
  ],
  lisbonne: [
    { name: "D\xE9gustation des chaudes Pasteis de Bel\xE9m traditionnelles \u{1F9C1}", description: "D\xE9gustez la recette originale ultra-secr\xE8te datant de 1837 saupoudr\xE9e de cannelle.", cost: 6, category: "Gastronomie" },
    { name: "Travers\xE9e historique en Tramway en bois n\xB028 \u{1F683}", description: "Sillonnez les collines abruptes et les fa\xE7ades d'Azulejos du vieux quartier de l'Alfama.", cost: 3, category: "Visite" },
    { name: "Sunset musical acoustique au Miradouro da Senhora do Monte \u{1F305}", description: "Savourez la plus belle vue sur le fleuve Tage avec des artistes locaux jouant de la guitare.", cost: 0, category: "Loisir" },
    { name: "Escapade de conte de f\xE9e aux ch\xE2teaux magiques de Sintra \u{1F3F0}", description: "Explorez l'extravagant Palais de Pena perch\xE9 au sommet de la for\xEAt subtropicale.", cost: 20, category: "Culture" },
    { name: "D\xEEner Fado en direct dans une taverne familiale locale \u{1F3B6}", description: "Savourez un poisson grill\xE9 berc\xE9 par le chant m\xE9lancolique traditionnel portugais.", cost: 35, category: "Gastronomie" },
    { name: "Balade sur le port au bord du Monument des D\xE9couvertes \u26F5", description: "Respirez la brise marine le long des rives de l'estuaire du Tage d'o\xF9 partaient les caravelles.", cost: 0, category: "Visite" }
  ],
  tokyo: [
    { name: "Bain de foule vertigineux au Shibuya Sky \u{1F3D9}\uFE0F", description: "Prenez de la hauteur au 47\xE8me \xE9tage pour admirer le croisement mythique et le Mont Fuji par ciel d\xE9gag\xE9.", cost: 18, category: "Visite" },
    { name: "Visite interactive sensorielle teamLab Planets \u{1F52E}", description: "Marchez pieds nus dans des bassins d'eau au milieu de projections florales infinies.", cost: 28, category: "Culture" },
    { name: "D\xEEner de grillades Okonomiyaki \xE0 Shimokitazawa \u{1F962}", description: "Savourez ces cr\xEApes \xE9paisses japonaises cuites sur tables chauffantes devant vous.", cost: 22, category: "Gastronomie" },
    { name: "Balade zen sous les Torii g\xE9ants du Meiji Jingu & Harajuku \u26E9\uFE0F", description: "D\xE9couvrez le sanctuaire shinto\xEFste nich\xE9 dans une for\xEAt d'arbres au milieu du dynamisme urbain.", cost: 0, category: "Visite" },
    { name: "Session Retro Gaming & Manga \xE0 Akihabara \u{1F47E}", description: "Sillonnez les boutiques d'arcades r\xE9tro sur plusieurs \xE9tages et d\xE9couvrez la pop culture nippone.", cost: 10, category: "Loisir" },
    { name: "Coucher de soleil sur Odaiba et sa statue de la Libert\xE9 miniature \u{1F5FC}", description: "Observez le pont suspendu Rainbow Bridge s'embraser au cr\xE9puscule depuis la plage de l'\xEEle artificielle.", cost: 0, category: "Nature" }
  ],
  londres: [
    { name: "Tour embl\xE9matique du Palais de Westminster & Big Ben \u{1F3DB}\uFE0F", description: "Admirez le c\u0153ur politique du Royaume-Uni et \xE9coutez retentir la cloche l\xE9gendaire.", cost: 0, category: "Visite" },
    { name: "Visite du British Museum & ses tr\xE9sors antiques \u{1F3FA}", description: "Explorez gratuitement l'Histoire du monde, de la pierre de Rosette aux momies d'\xC9gypte.", cost: 0, category: "Culture" },
    { name: "D\xE9gustation Street-Food internationale \xE0 Borough Market \u{1F9C0}", description: "Savourez des plats cultes venus du monde entier sous les grandes verri\xE8res victoriennes.", cost: 18, category: "Gastronomie" },
    { name: "Fl\xE2nerie bucolique & location de barque \xE0 Hyde Park \u{1F333}", description: "P\xE9dalez pr\xE8s du lac Serpentine et observez les \xE9cureuils peu farouches.", cost: 10, category: "Nature" },
    { name: "Tourn\xE9e des Pubs historiques du quartier boh\xE8me de Soho \u{1F37A}", description: "Go\xFBtez une authentique bi\xE8re brune Stout ou un cidre doux dans un pub du XVIIe si\xE8cle.", cost: 25, category: "Loisir" },
    { name: "Vol suspendu \xE0 bord de la grande roue London Eye \u{1F3A1}", description: "Prenez place dans une cabine de verre pour une vue plongeante \xE0 135m sur la Tamise.", cost: 35, category: "Visite" }
  ],
  newyork: [
    { name: "Balade suspendue sur la High Line & Chelsea Market \u{1F333}", description: "Sillonnez cette ancienne voie ferr\xE9e r\xE9habilit\xE9e en parc luxuriant au milieu des gratte-ciel.", cost: 0, category: "Visite" },
    { name: "Observatoire du Top of the Rock au Rockefeller Center \u{1F3D9}\uFE0F", description: "Admirez le plus beau panorama sur Central Park et le mythique Empire State Building.", cost: 42, category: "Visite" },
    { name: "Pique-nique herbeux \xE0 Sheep Meadow dans Central Park \u{1F9FA}", description: "\xC9vadez-vous dans le poumon vert de Manhattan pour vous reposer apr\xE8s la fureur urbaine.", cost: 12, category: "Nature" },
    { name: "D\xE9gustation des classiques Bagels & Pastrami \xE0 Brooklyn \u{1F96F}", description: "Savourer la street-food new-yorkaise embl\xE9matique dans d'anciennes fabriques r\xE9am\xE9nag\xE9es.", cost: 18, category: "Gastronomie" },
    { name: "Visite m\xE9morable du Met (Metropolitan Museum of Art) \u{1F5BC}\uFE0F", description: "Explorez un temple d'art s'\xE9tendant de l'\xC9gypte antique aux galeries contemporaines.", cost: 25, category: "Culture" },
    { name: "Balade en ferry gratuite vers Staten Island (Vue de la Statue) \u{1F5FD}", description: "Fr\xF4lez la Statue de la Libert\xE9 sur l'eau et admirez la grandiose Skyline de Manhattan.", cost: 0, category: "Loisir" }
  ],
  venise: [
    { name: "Fl\xE2nerie sur la magnifique Place Saint-Marc & Basilique \u26EA", description: "Admirez les mosa\xEFques dor\xE9es byzantines et le campanile s'\xE9lever face \xE0 la lagune.", cost: 5, category: "Culture" },
    { name: "Excursion maritime sur les \xEEles color\xE9es de Burano & Murano \u26F5", description: "D\xE9couvrez les petites briques multicolores des p\xEAcheurs et l'art des souffleurs de verre.", cost: 20, category: "Visite" },
    { name: "D\xE9gustation ap\xE9ritive de Cicchetti traditionnels dans un Bacaro \u{1F377}", description: "Savourez ces mini bruschettas v\xE9nitiennes croustillantes accompagn\xE9es d'un Spritz frais.", cost: 15, category: "Gastronomie" },
    { name: "Balade historique sur le majestueux Pont du Rialto \u{1F309}", description: "Contemplez le ballet incessant des gondoles voguant sur le c\xE9l\xE8bre Grand Canal.", cost: 0, category: "Visite" },
    { name: "Balade tranquille et romantique le long des Zattere \u{1F305}", description: "Prenez un bain de soleil face \xE0 l'\xEEle de la Giudecca en mangeant une glace gianduiotto.", cost: 6, category: "Nature" }
  ]
};
function generateProceduralActivities(destination, costMultiplier) {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  return [
    {
      name: `Randonn\xE9e & Belv\xE9d\xE8re \xE0 ${normDest} \u{1F3D4}\uFE0F`,
      description: "Prenez de l'altitude pour observer la plus belle vue panoramique de la r\xE9gion, id\xE9ale au coucher du soleil.",
      cost: Math.round(0 * costMultiplier),
      category: "Nature"
    },
    {
      name: `D\xE9couverte du Coeur Historique de ${normDest} \u{1F3DB}\uFE0F`,
      description: "Une balade \xE0 pied pour rep\xE9rer les monuments embl\xE9matiques et comprendre le cachet authentique du coin.",
      cost: Math.round(10 * costMultiplier),
      category: "Visite"
    },
    {
      name: `Grand banquet de sp\xE9cialit\xE9s locales & Terroir \u{1F958}`,
      description: `Rendez-vous dans une auberge de tradition pour savourer le plat f\xE9tiche embl\xE9matique de la r\xE9gion de ${normDest}.`,
      cost: Math.round(25 * costMultiplier),
      category: "Gastronomie"
    },
    {
      name: `Visite guid\xE9e du Mus\xE9e Municipal \u{1F3AD}`,
      description: "Rencontre enrichissante avec l'art local, l'histoire et les secrets culturels de la cit\xE9.",
      cost: Math.round(15 * costMultiplier),
      category: "Culture"
    },
    {
      name: `Roulade c\xF4ti\xE8re ou sortie v\xE9lo en groupe \u{1F6B2}`,
      description: "Prendre un grand bol d'air frais le long des berges paysag\xE9es ou pistes cyclables d'int\xE9r\xEAt local.",
      cost: Math.round(12 * costMultiplier),
      category: "Loisir"
    },
    {
      name: `Fl\xE2nerie gourmande sur le March\xE9 Hebdomadaire \u{1F9C0}`,
      description: "Rencontrez les artisans et d\xE9gustez du fromage, du pain de pays et des fruits de saison.",
      cost: Math.round(8 * costMultiplier),
      category: "Gastronomie"
    },
    {
      name: `Session d'emplettes artisanales de Souvenirs \u{1F6CD}\uFE0F`,
      description: "Explorez un quartier commer\xE7ant pour d\xE9nicher des cr\xE9ations ou sp\xE9cialit\xE9s insolites \xE0 rapporter.",
      cost: Math.round(20 * costMultiplier),
      category: "Shopping"
    }
  ];
}
function generateGetYourGuideActivities(destination, costMultiplier) {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const lowerDest = destination.toLowerCase();
  let items;
  if (lowerDest.includes("barcelon")) {
    items = [
      {
        name: `Billet coupe-file officiel pour la Sagrada Fam\xEDlia de Barcelone \u{1F3AB}`,
        description: `S\xE9curisez votre entr\xE9e coupe-file pour visiter l'un des monuments les plus c\xE9l\xE8bres au monde.`,
        cost: Math.round(26 * costMultiplier),
        category: "Culture",
        rating: 4.8,
        reviewsCount: 154200,
        duration: "2h",
        bookingUrl: "https://www.getyourguide.fr/sagrada-familia-l2699/"
      },
      {
        name: `Visite guid\xE9e authentique \xE0 pied du vieux centre historique \u{1F6B6}`,
        description: `Sillonnez le quartier Gothique de Barcelone avec un guide certifi\xE9 et apprenez son histoire secr\xE8te.`,
        cost: Math.round(15 * costMultiplier),
        category: "Culture",
        rating: 4.7,
        reviewsCount: 3840,
        duration: "2 heures",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Barcelone+vieux+centre+visite`
      },
      {
        name: `Excursion guid\xE9e d'une journ\xE9e \xE0 Montserrat depuis Barcelone \u{1F68C}`,
        description: `Montez dans les hauteurs sacr\xE9es de la montagne de Catalogne et d\xE9couvrez l'abbaye mythique. Transport inclus.`,
        cost: Math.round(55 * costMultiplier),
        category: "Nature",
        rating: 4.9,
        reviewsCount: 9240,
        duration: "1 journ\xE9e",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Montserrat+Barcelone`
      },
      {
        name: `Croisi\xE8re en catamaran au coucher du soleil avec ap\xE9ritif d\xEEnatoire \u26F5`,
        description: `Naviguez paisiblement le long des c\xF4tes barcelonaises pour admirer la ville s'illuminer avec boissons et musique.`,
        cost: Math.round(32 * costMultiplier),
        category: "Loisir",
        rating: 4.8,
        reviewsCount: 6510,
        duration: "1h30",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Barcelone+catamaran+coucher+soleil`
      }
    ];
  } else {
    items = [
      {
        name: `Billet coupe-file officiel pour les attractions de ${normDest} \u{1F3AB}`,
        description: `Acc\xE8s prioritaire garanti pour explorer les monuments incontournables de la ville. Audioguide multilingue inclus. \xC9vitez les files d'attente interminables aux guichets !`,
        cost: Math.round(22 * costMultiplier),
        category: "Visite",
        rating: 4.8,
        reviewsCount: Math.floor(Math.random() * 2500) + 400,
        duration: "2h - 3h",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " attractions")}`
      },
      {
        name: `Visite guid\xE9e authentique \xE0 pied du vieux centre de ${normDest} \u{1F6B6}`,
        description: `Sillonnez les ruelles de charme embl\xE9matiques avec un guide historien local certifi\xE9 et d\xE9couvrez les anecdotes captivantes et les recoins cach\xE9s de la ville.`,
        cost: Math.round(15 * costMultiplier),
        category: "Culture",
        rating: 4.7,
        reviewsCount: Math.floor(Math.random() * 800) + 120,
        duration: "2 heures",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " visite guidee walking tour")}`
      },
      {
        name: `Excursion d'une journ\xE9e compl\xE8te guid\xE9e depuis ${normDest} \u{1F68C}`,
        description: `Transport tout confort climatis\xE9 inclus pour visiter des villages exceptionnels \xE0 la campagne, des for\xEAts d'int\xE9r\xEAt ou des ch\xE2teaux forts pittoresques voisins.`,
        cost: Math.round(55 * costMultiplier),
        category: "Nature",
        rating: 4.9,
        reviewsCount: Math.floor(Math.random() * 1200) + 180,
        duration: "1 journ\xE9e",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " excursion day trip")}`
      },
      {
        name: `D\xE9gustation & ap\xE9ritif au coucher du soleil avec sp\xE9cialit\xE9s locales \u{1F377}`,
        description: `Savourez les saveurs du coin lors d'un ap\xE9ritif convivial au meilleur point de vue, pour admirer la ville s'illuminer \xE0 la nuit tomb\xE9e.`,
        cost: Math.round(32 * costMultiplier),
        category: "Gastronomie",
        rating: 4.8,
        reviewsCount: Math.floor(Math.random() * 1400) + 210,
        duration: "1h30",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " apero degustation coucher soleil")}`
      }
    ];
  }
  return items.map((it) => ({
    ...it,
    source: "GetYourGuide"
  }));
}
function generateAirbnbExperiences(destination, costMultiplier, adults = 6, checkin = "2026-07-20", checkout = "2026-07-26") {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const lowerDest = destination.toLowerCase();
  let items;
  if (lowerDest.includes("barcelon")) {
    items = [
      {
        name: `Visitez la Sagrada Fam\xEDlia avec un guide certifi\xE9 \u26EA`,
        description: `Vivez une exploration privil\xE9gi\xE9e guid\xE9e du chef-d'\u0153uvre de Gaudi avec des d\xE9tails historiques et les tickets officiels d'acc\xE8s prioritaires inclus.`,
        cost: Math.round(79 * costMultiplier),
        category: "Culture",
        rating: 4.78,
        reviewsCount: 1806,
        duration: "1,5 heure",
        bookingUrl: `https://www.airbnb.fr/experiences/4527793?adults=${adults}&checkin=${checkin}&checkout=${checkout}&location=Barcelone%2C%20Espagne&currentTab=experience_tab&federatedSearchId=cdeb7f58-95c2-44dc-b657-1c2ca55ff964&sectionId=51d71af4-1887-4b5b-bda5-e5a52e26d961`
      },
      {
        name: `Croisi\xE8re au coucher du soleil \xE0 Barcelone avec boissons & tapas \u26F5`,
        description: `Montez \xE0 bord de notre voilier pour observer le magnifique sunset catalan tout en savourant des amuse-bouches et des rires complices \xE0 bord.`,
        cost: Math.round(44 * costMultiplier),
        category: "Loisir",
        rating: 4.9,
        reviewsCount: 1251,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Croisiere+coucher+du+soleil&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Atelier Paella authentique dans mon jardin secret \u{1F958}`,
        description: `Apprenez la recette traditionnelle de la paella espagnole avec une sangria de fruits frais dans un patio historique intimiste plein de po\xE9sie.`,
        cost: Math.round(69 * costMultiplier),
        category: "Gastronomie",
        rating: 4.98,
        reviewsCount: 4796,
        duration: "2,5 heures",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Atelier+Paella&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Champagne et convivialit\xE9 sur un voilier en mer de Barcelone \u{1F942}`,
        description: `Glissez sur la M\xE9diterran\xE9e avec un skipper professionnel local, musique, champagne frais, fruits et d\xE9tente magique en amoureux ou entre amis.`,
        cost: Math.round(37 * costMultiplier),
        category: "Loisir",
        rating: 4.93,
        reviewsCount: 431,
        duration: "1,5 heure",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Voilier+Champagne&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      }
    ];
  } else {
    items = [
      {
        name: `Masterclass culinaire locale & d\xE9gustation avec un chef priv\xE9 \u{1F958}`,
        description: `Apprenez \xE0 fa\xE7onner les c\xE9l\xE8bres mets typiques du march\xE9 avec des secrets de famille originaux, suivis d'un d\xEEner de groupe tr\xE8s chaleureux et d'un bon vin de pays.`,
        cost: Math.round(45 * costMultiplier),
        category: "Gastronomie",
        rating: 4.95,
        reviewsCount: Math.floor(Math.random() * 320) + 40,
        duration: "3 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Cuisine+Gastronomie+Local&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Shooting photo professionnel & balade insolite des secrets de ${normDest} \u{1F4F8}`,
        description: `Rep\xE9rez des points de vue f\xE9eriques et panoramas uniques m\xE9connus du grand public tout en profitant d'un shooting \xE0 emporter avec un photographe pro.`,
        cost: Math.round(35 * costMultiplier),
        category: "Loisir",
        rating: 4.85,
        reviewsCount: Math.floor(Math.random() * 180) + 30,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Shooting+photo+visite&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Tourn\xE9e cach\xE9e des speakeasies secrets et spiritueux locaux \u{1F378}`,
        description: `D\xE9couvrez l'\xE2me nocturne de la ville et d\xE9gustez de superbes m\xE9langes ou vins fins fa\xE7onn\xE9s par un mixologue local chevronn\xE9 au Born ou Soho.`,
        cost: Math.round(30 * costMultiplier),
        category: "Loisir",
        rating: 4.78,
        reviewsCount: Math.floor(Math.random() * 150) + 20,
        duration: "2h30",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Cocktail+Secrets+Speakeasy&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Atelier cr\xE9atif de c\xE9ramique traditionnelle ou de peinture avec un artisan \u{1F3A8}`,
        description: `Exprimez votre esprit artistique dans un atelier de quartier convivial et fabriquez de vos propres mains votre plus beau souvenir de voyage.`,
        cost: Math.round(25 * costMultiplier),
        category: "Culture",
        rating: 4.9,
        reviewsCount: Math.floor(Math.random() * 95) + 15,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Atelier+creatif+artisan&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      }
    ];
  }
  return items.map((it) => ({
    ...it,
    source: "Airbnb Exp\xE9riences"
  }));
}
function generateGoogleActivities(destination, costMultiplier) {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const cleanKey = destination.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const curatedBase = DESTINATIONS_DATABASE[cleanKey] || generateProceduralActivities(destination, costMultiplier);
  return curatedBase.map((l) => {
    const cleanName = l.name.replace(/[^\w\sÀ-ÿ]/gi, "").trim();
    const query = `Activit\xE9s \xE0 d\xE9couvrir \xE0 ${normDest} ${cleanName}`;
    const bookingUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&sa=X&sqi=2&bih=695&biw=1536&dpr=1.25#ttdcs=EAE`;
    return {
      name: l.name,
      description: l.description,
      cost: l.cost,
      category: l.category,
      source: "Google Activit\xE9s",
      rating: Number((4.4 + Math.random() * 0.5).toFixed(1)),
      reviewsCount: Math.floor(Math.random() * 12e3) + 1500,
      duration: l.duration || "1h30 - 3h",
      bookingUrl
    };
  });
}
async function buildOfflineItinerary(destination, days, budgetType, adults = 6, checkin = "2026-07-20", checkout = "2026-07-26", page = 0) {
  const cleanKey = destination.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const costMultiplier = budgetType === "\xC9conomique" ? 0.6 : budgetType === "Luxe" ? 2.5 : 1;
  const lodgingCost = budgetType === "\xC9conomique" ? 35 : budgetType === "Luxe" ? 175 : 75;
  const transportCost = budgetType === "\xC9conomique" ? 7 : budgetType === "Luxe" ? 32 : 14;
  const real2 = await fetchPlaceActivities(destination);
  const PAGE_SIZE = 12;
  const realPage = real2.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const activities2 = real2.length > 0 ? realPage.map((act, index2) => ({
    id: `act-real-${cleanKey}-${page * PAGE_SIZE + index2}`,
    name: act.name,
    description: act.description,
    cost: act.cost ?? 0,
    // prix RÉEL si fourni, sinon 0, jamais inventé
    category: act.category,
    proposedBy: act.provider,
    // "OpenStreetMap" | "Wikivoyage" | "Wikipédia" | "Foursquare"
    source: void 0,
    rating: act.rating,
    // note RÉELLE ou rien
    reviewsCount: act.reviewsCount,
    duration: act.duration,
    bookingUrl: act.bookingUrl,
    imageUrl: act.imageUrl,
    votes: []
  })) : (
    // 2) Repli (rare) : catalogue hors-ligne, quand les API sont injoignables.
    [
      ...generateGetYourGuideActivities(destination, costMultiplier),
      ...generateAirbnbExperiences(destination, costMultiplier, adults, checkin, checkout),
      ...generateGoogleActivities(destination, costMultiplier)
    ].map((act, index2) => ({
      id: `act-comb-${cleanKey}-${index2}-${Math.floor(Math.random() * 1e5)}`,
      name: act.name,
      description: act.description,
      cost: act.cost,
      category: act.category,
      proposedBy: act.source === "GetYourGuide" ? "GetYourGuide \u{1F3AB}" : act.source === "Airbnb Exp\xE9riences" ? "Airbnb Exp\xE9riences \u{1F3E0}" : "Google Activit\xE9s \u2708\uFE0F",
      source: act.source,
      rating: act.rating,
      reviewsCount: act.reviewsCount,
      duration: act.duration,
      bookingUrl: act.bookingUrl,
      votes: []
    }))
  );
  const itinerary = [];
  for (let d = 1; d <= days; d++) {
    itinerary.push({
      day: d,
      title: `Jour ${d} : Exploration de ${destination}`,
      events: []
      // EMPTY BY DEFAULT, no events pre-scheduled
    });
  }
  return {
    activities: activities2,
    itinerary,
    averageLodgingCostPerNight: lodgingCost,
    averageLocalTransportCostPerDay: transportCost,
    isMock: false,
    note: `Suggestions d'activit\xE9s via GetYourGuide \u{1F3AB}, Airbnb Exp\xE9riences \u{1F3E0} et Google Activit\xE9s \u2708\uFE0F.`
  };
}
app.post("/api/suggest-activities", async (req, res) => {
  const { destination, days, budgetType, adults, checkin, checkout, page } = req.body;
  if (!destination) {
    return res.status(400).json({ error: "La destination est requise." });
  }
  const requestedDays = Math.min(Math.max(Number(days) || 3, 1), 21);
  const budget = budgetType || "Mod\xE9r\xE9";
  const pageNum = Math.max(0, Number(page) || 0);
  console.log(`[API Live Suggestions] ${destination} \xB7 jours ${requestedDays} \xB7 page ${pageNum}`);
  try {
    const results = await buildOfflineItinerary(
      destination,
      requestedDays,
      budget,
      adults,
      checkin,
      checkout,
      pageNum
    );
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: "\xC9chec de g\xE9n\xE9ration du parcours.", details: err?.message });
  }
});
app.post("/api/place-highlights", async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names.filter((n) => typeof n === "string").slice(0, 60) : [];
  if (names.length === 0) return res.json({ highlights: {} });
  try {
    const highlights = await discoverPlaceHighlightsBatch(names);
    return res.json({ highlights });
  } catch (err) {
    return res.status(500).json({ error: "\xC9chec.", details: err?.message });
  }
});
var geoLimiter = (0, import_express_rate_limit2.default)({
  windowMs: 60 * 1e3,
  limit: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { suggestions: [] }
});
app.get("/api/geo/suggest", geoLimiter, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) return res.json({ suggestions: [] });
  try {
    const suggestions = await suggestCities(q);
    return res.json({ suggestions });
  } catch {
    return res.json({ suggestions: [] });
  }
});
async function startServer() {
  await runMigrations();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express5.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const httpServer = (0, import_node_http.createServer)(app);
  initRealtime(httpServer);
  const HOST = process.env.HOST || "0.0.0.0";
  httpServer.listen(PORT, HOST, () => {
    console.log(`[Co-Traveler Server] En \xE9coute sur ${HOST}:${PORT}`);
  });
  let closing = false;
  const gracefulShutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[shutdown] ${signal} re\xE7u \u2014 fermeture propre\u2026`);
    httpServer.close();
    flushViewsCache();
    try {
      await closeDb();
      console.log("[shutdown] base ferm\xE9e proprement.");
    } catch (err) {
      console.error("[shutdown] erreur \xE0 la fermeture de la base :", err);
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => void gracefulShutdown("SIGINT"));
}
startServer().catch((err) => {
  console.error("[Co-Traveler Server] \xC9chec du d\xE9marrage :", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map

import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { IncomingMessage, Server } from "node:http";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { tripMembers } from "./db/schema";
import { validateSession, SESSION_COOKIE } from "./auth/session";

interface ClientSocket extends WebSocket {
  userId?: string;
  tripId?: string;
}

/** Rooms : tripId → sockets abonnés (membres connectés à ce voyage). */
const rooms = new Map<string, Set<ClientSocket>>();
let wss: WebSocketServer | null = null;

/** Récupère le jeton de session : query `?token=` (mobile) ou cookie (web). */
function parseToken(req: IncomingMessage): string | undefined {
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
  return undefined;
}

function leave(ws: ClientSocket): void {
  if (!ws.tripId) return;
  const set = rooms.get(ws.tripId);
  set?.delete(ws);
  if (set && set.size === 0) rooms.delete(ws.tripId);
  ws.tripId = undefined;
}

function send(ws: ClientSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

/** Attache un serveur WebSocket (chemin `/ws`) au serveur HTTP, avec auth. */
export function initRealtime(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) return;
    const token = parseToken(req);
    const user = token ? await validateSession(token) : null;
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss!.handleUpgrade(req, socket, head, (ws) => {
      const c = ws as ClientSocket;
      c.userId = user.id;
      wss!.emit("connection", c, req);
    });
  });

  wss.on("connection", (ws: ClientSocket) => {
    ws.on("message", async (data: RawData) => {
      let msg: { type?: string; tripId?: string };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      // S'abonner à un voyage (room) après vérification d'appartenance.
      if (msg.type === "subscribe" && typeof msg.tripId === "string") {
        const [m] = await db
          .select()
          .from(tripMembers)
          .where(and(eq(tripMembers.tripId, msg.tripId), eq(tripMembers.userId, ws.userId!)));
        if (!m) return;
        leave(ws);
        ws.tripId = msg.tripId;
        let set = rooms.get(msg.tripId);
        if (!set) {
          set = new Set();
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

/** Diffuse le voyage à jour à tous les membres connectés (no-op si personne / WS off). */
export function broadcastTrip(tripId: string, trip: unknown): void {
  const set = rooms.get(tripId);
  if (!set) return;
  for (const ws of set) send(ws, { type: "trip:updated", trip });
}

/** Notifie la suppression d'un voyage aux membres connectés. */
export function broadcastTripDeleted(tripId: string): void {
  const set = rooms.get(tripId);
  if (!set) return;
  for (const ws of set) send(ws, { type: "trip:deleted", tripId });
}

import type { Trip } from "../types";

/** URL du WebSocket : déduite de VITE_API_BASE_URL (mobile, + token) ou de l'origine (web, cookie). */
function wsUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) {
    let url = base.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    const token = localStorage.getItem("cotripper_token");
    if (token) url += `?token=${encodeURIComponent(token)}`;
    return url;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`; // cookie httpOnly envoyé à l'upgrade (même origine)
}

export interface TripSocketHandlers {
  onTrip: (trip: Trip) => void;
  onDeleted: (tripId: string) => void;
}

/**
 * Ouvre un WebSocket abonné à un voyage, avec reconnexion automatique.
 * Chaque modification (par n'importe quel membre) arrive en direct → pas de
 * polling, pas de rechargement. Renvoie une fonction pour fermer la connexion.
 */
export function connectTripSocket(tripId: string, handlers: TripSocketHandlers): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (closed) return;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      retry = setTimeout(open, 3000);
      return;
    }
    ws.onopen = () => ws?.send(JSON.stringify({ type: "subscribe", tripId }));
    ws.onmessage = (e) => {
      let msg: { type?: string; trip?: Trip; tripId?: string };
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "");
      } catch {
        return;
      }
      if (msg.type === "trip:updated" && msg.trip) handlers.onTrip(msg.trip);
      else if (msg.type === "trip:deleted" && msg.tripId) handlers.onDeleted(msg.tripId);
    };
    ws.onclose = () => {
      if (!closed) retry = setTimeout(open, 2000); // reconnexion
    };
    ws.onerror = () => ws?.close();
  };
  open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    ws?.close();
  };
}

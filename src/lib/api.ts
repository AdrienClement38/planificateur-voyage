/**
 * Couche d'accès à l'API.
 *
 * Pourquoi une base d'URL configurable ?
 * - **Web** (AlwaysData) : le frontend et l'API sont servis par le même
 *   serveur Express → on utilise des chemins relatifs (`/api/...`).
 * - **Mobile** (Capacitor) : l'app est un bundle statique embarqué dans le
 *   binaire natif ; elle ne peut pas héberger Express et doit donc appeler
 *   l'API distante par le réseau → on injecte l'URL absolue d'AlwaysData via
 *   `VITE_API_BASE_URL` au moment du build mobile.
 *
 * Définir `VITE_API_BASE_URL` dans un fichier `.env` (web : laisser vide).
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export interface SuggestActivitiesParams {
  destination: string;
  days: number;
  budgetType: string;
  adults?: number;
  checkin?: string;
  checkout?: string;
  /** Source ciblée pour un lot supplémentaire ("GetYourGuide" | "Airbnb Expériences" | "Google Activités"). */
  source?: string;
  /** Page (0-indexée) pour paginer les lots d'une même source. */
  page?: number;
}

/**
 * Appelle `/api/suggest-activities` et renvoie la charge utile JSON brute.
 * Lève une `Error` lisible en cas d'échec réseau ou de statut non-2xx, pour
 * que l'appelant puisse afficher un message clair à l'utilisateur.
 */
export async function suggestActivities(
  params: SuggestActivitiesParams,
  signal?: AbortSignal,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/suggest-activities"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal,
    });
  } catch (cause) {
    throw new Error(
      "Impossible de joindre le serveur. Vérifiez votre connexion.",
      { cause },
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; details?: string };
      detail = body.error ?? body.details ?? "";
    } catch {
      /* corps non-JSON : on garde le message générique */
    }
    throw new Error(detail || `Échec de la génération (HTTP ${res.status}).`);
  }

  return res.json();
}

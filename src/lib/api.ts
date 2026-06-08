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

/** Suggestion de ville pour l'autocomplétion de destination (API /api/geo/suggest). */
export interface CitySuggestion {
  /** Forme canonique « Ville, Pays » — valeur à stocker / géocoder. */
  label: string;
  /** Nom seul de la ville (FR si disponible). */
  name: string;
  /** Pays (FR), si connu. */
  country?: string;
  /** Code ISO 3166-1 alpha-2 (majuscules) → drapeau. */
  countryCode?: string;
  /** Région/département, pour désambiguïser visuellement. */
  region?: string;
  lat: number;
  lon: number;
}

/**
 * Autocomplétion de villes : interroge `/api/geo/suggest` (proxy Photon/OSM côté
 * serveur). Tolérant à l'échec ET à l'annulation : renvoie `[]` plutôt que de
 * lever — l'appelant débounce et annule la requête en vol via `signal` à chaque
 * frappe, donc une `AbortError` est un cas normal, pas une erreur.
 */
export async function suggestCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      apiUrl(`/api/geo/suggest?q=${encodeURIComponent(q)}`),
      { signal },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { suggestions?: CitySuggestion[] };
    return body.suggestions ?? [];
  } catch {
    return [];
  }
}

/** Une œuvre à voir dans un lieu (musée, chapelle…), renvoyée par l'API. */
export interface PlaceHighlight {
  name: string;
  imageUrl?: string;
}

/**
 * Récupère, EN LOT, les œuvres majeures à voir pour une liste de lieux (via
 * Wikidata, côté serveur). Renvoie une map { nomDuLieu → œuvres }. Tolérant à
 * l'échec : renvoie `{}` plutôt que de lever — ce volet est un bonus, il ne doit
 * jamais casser l'affichage des cartes.
 */
export async function fetchPlaceHighlightsBatch(
  names: string[],
  signal?: AbortSignal,
): Promise<Record<string, PlaceHighlight[]>> {
  if (names.length === 0) return {};
  try {
    const res = await fetch(apiUrl("/api/place-highlights"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
      signal,
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { highlights?: Record<string, PlaceHighlight[]> };
    return body.highlights ?? {};
  } catch {
    return {};
  }
}

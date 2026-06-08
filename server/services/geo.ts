/**
 * Géocodage & autocomplétion de villes — la « porte d'entrée » géographique du
 * moteur de suggestions, isolée du reste (`places.ts`) car c'est une responsabilité
 * autonome : transformer un nom de ville saisi par l'utilisateur en un point
 * { lat, lon } fiable (Nominatim) et proposer des villes RÉELLES à la frappe (Photon).
 *
 * 100 % données réelles (OpenStreetMap via Nominatim & Photon), zéro invention :
 * une ville non trouvée renvoie `null`/`[]`, jamais un résultat fabriqué.
 */
import { fetchJson } from "./http";

/** Géocode une destination en { lat, lon } via Nominatim, ou `null` si introuvable. */
export async function geocode(
  destination: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    destination,
  )}&format=json&limit=1`;
  const data = (await fetchJson(url)) as Array<{
    lat?: string;
    lon?: string;
  }> | null;
  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

// ----------------------------------------------- Autocomplétion de villes (Photon)

/**
 * Suggestion de ville pour l'autocomplétion de la DESTINATION d'un voyage.
 * `label` est la forme canonique « Ville, Pays » (FR), prête à être stockée ET
 * géocodée proprement par le moteur de suggestions — c'est le verrou anti-
 * « garbage » : on ne valide qu'une ville RÉELLE. `lat`/`lon` sont les vraies
 * coordonnées (Photon) ; on les renvoie pour un futur usage (éviter un
 * re-géocodage). `region`/`countryCode` ne servent qu'à l'affichage de la liste
 * (drapeau + ligne de désambiguïsation). 100 % données réelles (OSM via Photon).
 */
export interface CitySuggestion {
  /** Forme canonique « Ville, Pays » (FR) — valeur stockée et géocodable. */
  label: string;
  /** Nom seul de la ville (FR si disponible). */
  name: string;
  /** Pays (FR), si connu. */
  country?: string;
  /** Code ISO 3166-1 alpha-2 (majuscules) → drapeau côté front. */
  countryCode?: string;
  /** Région/département, pour désambiguïser visuellement (PAS inclus dans `label`). */
  region?: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    country?: string;
    countrycode?: string;
    state?: string;
    county?: string;
    osm_key?: string;
    osm_value?: string;
    /** Calque normalisé par Photon : house|street|locality|district|city|county|state|country|other. */
    type?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

// Rang d'affichage par type de lieu OSM : une vraie VILLE passe devant un
// village quasi-homonyme (ex. « Barce » → Barcelone (ville) avant Barceo
// (village)). On NE rétrograde QUE les petits lieux : villes, communes ET
// métropoles-province (Tokyo est tagué place=province mais normalisé type=city)
// partagent le rang « lieu notable », pour rester en tête quand Photon les y a
// déjà mises. Règle GÉNÉRALE et mondiale, zéro exception nominative.
function placeRank(osmValue?: string): number {
  if (osmValue === "city") return 0;
  // Lieux mineurs explicitement rétrogradés (le reste = « notable », rang 1).
  if (
    osmValue === "village" ||
    osmValue === "hamlet" ||
    osmValue === "isolated_dwelling" ||
    osmValue === "farm" ||
    osmValue === "locality" ||
    osmValue === "suburb" ||
    osmValue === "neighbourhood" ||
    osmValue === "quarter"
  )
    return 2;
  return 1; // town, municipality, province, region… = lieu notable
}

/**
 * Transforme la réponse GeoJSON de Photon en suggestions de villes propres.
 * Fonction PURE (sans réseau) → testée unitairement.
 *  - Ne garde que les LIEUX HABITÉS via le calque normalisé `type === "city"`
 *    (ville/commune/village/métropole) — ce qui écarte d'office gares, stades,
 *    POI et même l'aéroport de Haneda (tagué `place=island` mais `type=house`).
 *  - Construit un `label` « Ville, Pays » et déduplique par label.
 *  - Re-classe par notoriété de type (ville > village) en tri STABLE : à rang
 *    égal, on conserve l'ordre de pertinence de Photon.
 */
export function photonToCitySuggestions(data: unknown): CitySuggestion[] {
  const features = (data as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const ranked: { city: CitySuggestion; rank: number; idx: number }[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties ?? {};
    const name = p.name?.trim();
    if (!name || p.type !== "city") continue;
    const lon = f.geometry?.coordinates?.[0];
    const lat = f.geometry?.coordinates?.[1];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const country = p.country?.trim() || undefined;
    const county = p.county?.trim();
    // Commune homonyme (≠ grande ville) : on glisse le DÉPARTEMENT dans le label.
    // Sinon « Viviers, France » est ambigu — le dédup par label FUSIONNE les homonymes
    // (Viviers Ardèche vs Moselle → une seule entrée) ET, surtout, la destination
    // STOCKÉE est re-géocodée par le moteur sur la MAUVAISE ville. « Viviers, Ardèche,
    // France » règle les deux. Les grandes villes (osm_value="city") restent propres.
    const withCounty =
      p.osm_value !== "city" && county && county !== name ? county : null;
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
        region: p.state?.trim() || county || undefined, // sous-titre = région (le dépt est déjà dans le label si commune)
        lat,
        lon,
      },
      rank: placeRank(p.osm_value),
      idx: ranked.length, // ordre Photon, pour un tri stable explicite
    });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((r) => r.city);
}

// Cache mémoire court (10 min) des suggestions par requête : l'autocomplétion
// retape souvent les mêmes préfixes, et Photon est un service public gratuit —
// on évite de le solliciter inutilement (politesse + latence quasi nulle si chaud).
const GEO_CACHE = new Map<string, { at: number; items: CitySuggestion[] }>();
const GEO_TTL = 10 * 60 * 1000;

/**
 * Autocomplétion typeahead : interroge Photon (komoot, basé OSM, sans clé) pour
 * un préfixe et renvoie des villes RÉELLES { label, lat, lon, … }. `lang=fr` →
 * noms et pays en français (« Barcelone, Espagne »). Tolérant à l'échec : renvoie
 * `[]` si Photon est injoignable (l'UI affiche alors un simple champ libre).
 */
export async function suggestCities(
  query: string,
  limit = 6,
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cap = Math.min(Math.max(limit, 1), 10);
  const cacheKey = `${cap}|${q.toLowerCase()}`;
  const hit = GEO_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < GEO_TTL) return hit.items;
  // `layer=city` = uniquement des lieux habités (Photon écarte rues, POI, gares,
  // aéroports, frontières admin…) → la vraie ville n'est jamais noyée hors du
  // top N. On sur-échantillonne (le filtre/dédup réduit ensuite), puis on tronque.
  const url =
    `https://photon.komoot.io/api?q=${encodeURIComponent(q)}` +
    `&lang=fr&layer=city&limit=${Math.min(cap * 3, 20)}`;
  const data = await fetchJson(url, 6000);
  const items = photonToCitySuggestions(data).slice(0, cap);
  // On ne met en cache QUE les succès (≥1 résultat) : un échec réseau ne doit pas
  // se figer 10 min (auto-réparation à la frappe suivante).
  if (items.length > 0) GEO_CACHE.set(cacheKey, { at: Date.now(), items });
  return items;
}

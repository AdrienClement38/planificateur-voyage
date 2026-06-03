/**
 * Découverte d'activités RÉELLES et géolocalisées pour une destination, via des
 * API publiques gratuites et sans clé :
 *   - Nominatim (OpenStreetMap) : géocode la destination → lat/lon ;
 *   - Overpass (OpenStreetMap) : POI réellement taggés tourisme / monument /
 *     parc / sommet / téléphérique, restreints à ceux ayant une fiche Wikidata
 *     (= lieux notables, pas du bruit) ;
 *   - Wikidata : classement par notoriété (nombre de versions linguistiques) ;
 *   - Wikipédia : descriptions réelles (un seul appel groupé).
 *
 * On ne renvoie QUE des informations factuelles : nom réel, description réelle,
 * catégorie réelle (tag OSM), et un lien réel (site officiel ou article). Aucune
 * note, aucun nombre d'avis, aucun prix « estimé » n'est inventé.
 *
 * Renvoie [] en cas d'échec (l'appelant affiche alors un état vide honnête).
 * Un cache mémoire évite de marteler les API.
 */

type Cat = "Visite" | "Gastronomie" | "Culture" | "Loisir" | "Nature" | "Shopping";

export interface PlaceActivity {
  name: string;
  description: string;
  category: Cat;
  /** Durée indicative (pour pré-remplir le planificateur), ajustable. */
  duration: string;
  /** Lien réel : site officiel du lieu, sinon son article Wikipédia. */
  bookingUrl: string;
}

const UA = "Co-Tripper/1.0 (planificateur de voyage en groupe)";

async function fetchJson(url: string, ms = 6000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(destination: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    destination,
  )}&format=json&limit=1`;
  const data = (await fetchJson(url)) as Array<{ lat?: string; lon?: string }> | null;
  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

interface OverpassEl {
  tags?: Record<string, string>;
}

async function overpassPOIs(lat: number, lon: number): Promise<OverpassEl[]> {
  const q =
    `[out:json][timeout:25];(` +
    `nwr["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|theme_park|zoo|aquarium)$"]["wikidata"](around:7000,${lat},${lon});` +
    `nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site|fort|city_gate)$"]["wikidata"](around:7000,${lat},${lon});` +
    `nwr["leisure"="park"]["wikidata"](around:7000,${lat},${lon});` +
    `nwr["natural"~"^(peak|glacier|volcano)$"]["wikidata"](around:14000,${lat},${lon});` +
    `nwr["aerialway"~"^(cable_car|gondola)$"]["name"](around:14000,${lat},${lon});` +
    `);out center tags 120;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const data = (await fetchJson(url, 22000)) as { elements?: OverpassEl[] } | null;
  return data?.elements ?? [];
}

/** Catégorie + durée indicative à partir des tags OSM. */
function classifyTags(tags: Record<string, string>): { category: Cat; duration: string } {
  if (tags.aerialway) return { category: "Nature", duration: "demi-journée" };
  if (tags.natural) return { category: "Nature", duration: "demi-journée" };
  if (tags.leisure === "park") return { category: "Nature", duration: "1h30" };
  const tour = tags.tourism;
  if (tour === "museum" || tour === "gallery") return { category: "Culture", duration: "1h30" };
  if (tour === "viewpoint") return { category: "Nature", duration: "1h" };
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park")
    return { category: "Loisir", duration: "demi-journée" };
  if (tags.historic) return { category: "Culture", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}

/** Lien RÉEL : site officiel (OSM `website`) → article Wikipédia → recherche. */
function bestLink(tags: Record<string, string>, name: string, dest: string): string {
  const site = tags.website || tags["contact:website"] || tags.url;
  if (site && /^https?:\/\//i.test(site)) return site.split(";")[0].trim();
  const wp = tags.wikipedia; // "fr:Colisée"
  const i = wp ? wp.indexOf(":") : -1;
  if (wp && i > 0) {
    const lang = wp.slice(0, i);
    const title = wp.slice(i + 1);
    if (/^[a-z]{2,3}$/.test(lang) && title) {
      return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${dest}`)}`;
}

const cache = new Map<string, { at: number; places: PlaceActivity[] }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

interface Entry {
  name: string;
  tags: Record<string, string>;
  wiki?: string;
  qid?: string;
}

/** Renvoie de vraies activités géolocalisées et notables pour la destination. */
export async function fetchPlaceActivities(destination: string): Promise<PlaceActivity[]> {
  try {
    const key = destination.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.places;

    const geo = await geocode(destination);
    if (!geo) return [];

    const els = await overpassPOIs(geo.lat, geo.lon);
    if (els.length === 0) return [];

    // Dédoublonne par nom + repère article Wikipédia & fiche Wikidata.
    const byName = new Map<string, Entry>();
    for (const el of els) {
      const tags = el.tags ?? {};
      const name = tags["name:fr"] || tags.name;
      if (!name || byName.has(name)) continue;
      const wp = tags.wikipedia;
      const wiki = wp && wp.startsWith("fr:") ? wp.slice(3) : undefined;
      byName.set(name, { name, tags, wiki, qid: tags.wikidata });
    }
    if (byName.size === 0) return [];

    // Notoriété : nombre de versions linguistiques de la fiche Wikidata.
    const entries = [...byName.values()];
    const qids = entries.map((e) => e.qid).filter((q): q is string => !!q).slice(0, 50);
    const fame: Record<string, number> = {};
    if (qids.length > 0) {
      const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join(
        "|",
      )}&props=sitelinks&format=json`;
      const wd = (await fetchJson(wdUrl, 10000)) as {
        entities?: Record<string, { sitelinks?: Record<string, unknown> }>;
      } | null;
      for (const [qid, ent] of Object.entries(wd?.entities ?? {})) {
        fame[qid] = Object.keys(ent.sitelinks ?? {}).length;
      }
    }
    entries.sort((a, b) => (fame[b.qid ?? ""] ?? 0) - (fame[a.qid ?? ""] ?? 0));
    const ordered = entries.slice(0, 16);

    // Descriptions réelles via Wikipédia (un seul appel groupé).
    const titles = ordered.map((e) => e.wiki).filter((t): t is string => !!t);
    const extracts: Record<string, string> = {};
    if (titles.length > 0) {
      const exUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exsentences=2&redirects=1&titles=${encodeURIComponent(
        titles.join("|"),
      )}&format=json`;
      const exData = (await fetchJson(exUrl)) as {
        query?: { pages?: Record<string, { title?: string; extract?: string }> };
      } | null;
      for (const p of Object.values(exData?.query?.pages ?? {})) {
        if (p.title && p.extract) extracts[p.title] = p.extract;
      }
    }

    const places: PlaceActivity[] = ordered.map((e) => {
      const { category, duration } = classifyTags(e.tags);
      const extract = (e.wiki && extracts[e.wiki]) || "";
      return {
        name: e.name,
        description: (extract || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
        category,
        duration,
        bookingUrl: bestLink(e.tags, e.name, destination),
      };
    });

    cache.set(key, { at: Date.now(), places });
    return places;
  } catch {
    return [];
  }
}

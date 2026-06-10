/**
 * Source 1 : OpenStreetMap via Overpass. Récupère les POI NOTABLES (ceux qui
 * portent une fiche Wikidata) autour du point — musées, monuments, parcs,
 * sommets… — puis les diversifie par catégorie et les classe par notoriété
 * (nombre de versions linguistiques Wikidata). 100 % lieux réels d'OSM.
 */
import { UA, fetchJson } from "./http";
import { mapsLink, type Cat, type PlaceActivity } from "./core";
import { fetchExtracts } from "./enrich";

interface OverpassEl {
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
}

function classifyTags(tags: Record<string, string>): {
  category: Cat;
  duration: string;
} {
  // Bien-être : spas, thermes, bains.
  if (
    tags.amenity === "spa" ||
    tags.amenity === "public_bath" ||
    tags.leisure === "spa"
  )
    return { category: "Bien-être", duration: "demi-journée" };
  // Loisir : téléphériques, trains panoramiques, parcs (attraction/aquatique), sport.
  if (tags.aerialway || tags.railway)
    return { category: "Loisir", duration: "demi-journée" };
  if (
    tags.leisure === "water_park" ||
    tags.leisure === "sports_centre" ||
    tags.leisure === "swimming_pool"
  )
    return { category: "Loisir", duration: "demi-journée" };
  const tour = tags.tourism;
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park")
    return { category: "Loisir", duration: "demi-journée" };
  // Culture : musées, galeries, théâtres, cinémas, monuments.
  if (tour === "museum" || tour === "gallery")
    return { category: "Culture", duration: "1h30" };
  if (
    tags.amenity === "theatre" ||
    tags.amenity === "cinema" ||
    tags.amenity === "arts_centre"
  )
    return { category: "Culture", duration: "2h" };
  if (tags.historic) return { category: "Culture", duration: "1h" };
  // Nature : parcs, jardins, réserves, sommets, plages, panoramas…
  if (tags.natural) return { category: "Nature", duration: "demi-journée" };
  if (
    tags.leisure === "park" ||
    tags.leisure === "garden" ||
    tags.leisure === "nature_reserve"
  )
    return { category: "Nature", duration: "1h30" };
  if (tour === "viewpoint") return { category: "Nature", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}

// L'instance publique d'Overpass est souvent saturée (429) ou lente. On essaie
// plusieurs miroirs en POST, l'un après l'autre, jusqu'à une réponse exploitable.
const OVERPASS_MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function fetchOverpass(query: string): Promise<OverpassEl[]> {
  const attempt = async (url: string): Promise<OverpassEl[]> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`); // 429/504 → rejet, on prend un autre
      const data = (await res.json()) as { elements?: OverpassEl[] };
      const els = data.elements ?? [];
      if (els.length === 0) throw new Error("empty");
      return els;
    } finally {
      clearTimeout(timer);
    }
  };
  // Course entre les miroirs : la première réponse exploitable gagne (latence =
  // miroir le plus rapide ; si tous échouent, ~10s puis []).
  try {
    return await Promise.any(OVERPASS_MIRRORS.map(attempt));
  } catch {
    return [];
  }
}

export async function discoverOverpass(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  // Requête volontairement LÉGÈRE (≈3 s) : uniquement les POI notables (fiche
  // Wikidata). Les activités sans Wikidata (téléphériques, trains, spas) sont
  // désormais couvertes par Wikivoyage et Wikipédia — inutile d'alourdir ici.
  const q =
    `[out:json][timeout:25];(` +
    `nwr["tourism"~"^(attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium)$"]["wikidata"](around:8000,${lat},${lon});` +
    `nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site|fort)$"]["wikidata"](around:8000,${lat},${lon});` +
    `nwr["leisure"~"^(park|garden|nature_reserve)$"]["wikidata"](around:9000,${lat},${lon});` +
    `nwr["natural"~"^(peak|glacier|volcano|beach|waterfall)$"]["wikidata"](around:12000,${lat},${lon});` +
    `);out center tags 80;`;
  const els = await fetchOverpass(q);
  if (els.length === 0) return [];

  interface Entry {
    name: string;
    tags: Record<string, string>;
    wiki?: string;
    qid?: string;
    category: Cat;
    lat?: number;
    lon?: number;
  }
  const byName = new Map<string, Entry>();
  for (const el of els) {
    const tags = el.tags ?? {};
    const name = tags["name:fr"] || tags.name;
    if (!name || byName.has(name)) continue;
    const wp = tags.wikipedia;
    byName.set(name, {
      name,
      tags,
      wiki: wp && wp.startsWith("fr:") ? wp.slice(3) : undefined,
      qid: tags.wikidata,
      category: classifyTags(tags).category,
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
    });
  }
  if (byName.size === 0) return [];

  // Notoriété via Wikidata (nombre de versions linguistiques).
  const entries = [...byName.values()];
  const qids = entries
    .map((e) => e.qid)
    .filter((q): q is string => !!q)
    .slice(0, 50);
  const fame: Record<string, number> = {};
  if (qids.length > 0) {
    const wd = (await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join("|")}&props=sitelinks&format=json`,
      10000,
    )) as {
      entities?: Record<string, { sitelinks?: Record<string, unknown> }>;
    } | null;
    for (const [qid, ent] of Object.entries(wd?.entities ?? {})) {
      fame[qid] = Object.keys(ent.sitelinks ?? {}).length;
    }
  }

  // Diversifie : trie par notoriété DANS chaque catégorie, puis round-robin entre
  // catégories — pour ne pas avoir 16 sommets mais un mix (sommets, musées,
  // téléphériques, monuments…).
  const buckets = new Map<Cat, Entry[]>();
  for (const e of entries) {
    if (!buckets.has(e.category)) buckets.set(e.category, []);
    buckets.get(e.category)!.push(e);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => (fame[b.qid ?? ""] ?? 0) - (fame[a.qid ?? ""] ?? 0));
  }
  // Plafonne les sommets pour ne pas noyer les musées, monuments, activités…
  if (buckets.has("Nature"))
    buckets.set("Nature", buckets.get("Nature")!.slice(0, 6));
  const cats = [...buckets.keys()];
  const ordered: Entry[] = [];
  for (let round = 0; ordered.length < 16; round++) {
    let progressed = false;
    for (const c of cats) {
      const arr = buckets.get(c)!;
      if (arr[round]) {
        ordered.push(arr[round]);
        progressed = true;
        if (ordered.length >= 16) break;
      }
    }
    if (!progressed) break;
  }

  const extracts = await fetchExtracts(
    ordered.map((e) => e.wiki).filter((t): t is string => !!t),
  );

  return ordered.map((e) => {
    const { category, duration } = classifyTags(e.tags);
    const extract = (e.wiki && extracts[e.wiki]) || "";
    return {
      name: e.name,
      description: (extract || `Lieu réel à découvrir à ${destination}.`).slice(
        0,
        240,
      ),
      category,
      duration,
      bookingUrl: mapsLink(e.name, destination),
      provider: "OpenStreetMap",
      wikiTitle: e.wiki,
      lat: e.lat,
      lon: e.lon,
    };
  });
}

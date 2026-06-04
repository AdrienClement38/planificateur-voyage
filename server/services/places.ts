/**
 * Découverte d'activités RÉELLES et géolocalisées pour une destination, via des
 * API publiques gratuites et sans clé. Deux sources réelles, en cascade :
 *   1. Overpass (OpenStreetMap) : POI taggés tourisme/monument/parc/sommet, avec
 *      fiche Wikidata (= notables), classés par notoriété (versions linguistiques).
 *   2. Repli RÉEL si Overpass est indisponible : Wikipédia geosearch (lieux réels
 *      autour du point), filtré du bruit (rues, événements, administratif…).
 * Descriptions réelles via Wikipédia. Géocodage via Nominatim.
 *
 * On ne renvoie QUE du factuel : nom réel, description réelle, catégorie réelle,
 * lien réel (site officiel ou article). JAMAIS de note/avis/prix inventés. Liste
 * vide si tout échoue (l'appelant affiche un état vide honnête, pas de faux).
 */

type Cat = "Visite" | "Gastronomie" | "Culture" | "Loisir" | "Nature" | "Shopping";

export interface PlaceActivity {
  name: string;
  description: string;
  category: Cat;
  duration: string;
  /** Lien réel (site officiel ou article Wikipédia), "" si aucun. */
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

function wikiArticleUrl(wp: string): string {
  // wp = "fr:Colisée"
  const i = wp.indexOf(":");
  if (i <= 0) return "";
  const lang = wp.slice(0, i);
  const title = wp.slice(i + 1);
  if (!/^[a-z]{2,3}$/.test(lang) || !title) return "";
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Récupère les intros Wikipédia (fr) pour une liste de titres, en un appel. */
async function fetchExtracts(titles: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (titles.length === 0) return out;
  const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exsentences=2&redirects=1&titles=${encodeURIComponent(
    titles.join("|"),
  )}&format=json`;
  const data = (await fetchJson(url)) as {
    query?: { pages?: Record<string, { title?: string; extract?: string }> };
  } | null;
  for (const p of Object.values(data?.query?.pages ?? {})) {
    if (p.title && p.extract) out[p.title] = p.extract;
  }
  return out;
}

// --------------------------------------------------------------- Source 1 : Overpass

interface OverpassEl {
  tags?: Record<string, string>;
}

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

function overpassLink(tags: Record<string, string>): string {
  const site = tags.website || tags["contact:website"] || tags.url;
  if (site && /^https?:\/\//i.test(site)) return site.split(";")[0].trim();
  return tags.wikipedia ? wikiArticleUrl(tags.wikipedia) : "";
}

async function discoverOverpass(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
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
  const els = data?.elements ?? [];
  if (els.length === 0) return [];

  interface Entry {
    name: string;
    tags: Record<string, string>;
    wiki?: string;
    qid?: string;
  }
  const byName = new Map<string, Entry>();
  for (const el of els) {
    const tags = el.tags ?? {};
    const name = tags["name:fr"] || tags.name;
    if (!name || byName.has(name)) continue;
    const wp = tags.wikipedia;
    byName.set(name, { name, tags, wiki: wp && wp.startsWith("fr:") ? wp.slice(3) : undefined, qid: tags.wikidata });
  }
  if (byName.size === 0) return [];

  // Notoriété via Wikidata (nombre de versions linguistiques).
  const entries = [...byName.values()];
  const qids = entries.map((e) => e.qid).filter((q): q is string => !!q).slice(0, 50);
  const fame: Record<string, number> = {};
  if (qids.length > 0) {
    const wd = (await fetchJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join("|")}&props=sitelinks&format=json`,
      10000,
    )) as { entities?: Record<string, { sitelinks?: Record<string, unknown> }> } | null;
    for (const [qid, ent] of Object.entries(wd?.entities ?? {})) {
      fame[qid] = Object.keys(ent.sitelinks ?? {}).length;
    }
  }
  entries.sort((a, b) => (fame[b.qid ?? ""] ?? 0) - (fame[a.qid ?? ""] ?? 0));
  const ordered = entries.slice(0, 16);

  const extracts = await fetchExtracts(
    ordered.map((e) => e.wiki).filter((t): t is string => !!t),
  );

  return ordered.map((e) => {
    const { category, duration } = classifyTags(e.tags);
    const extract = (e.wiki && extracts[e.wiki]) || "";
    return {
      name: e.name,
      description: (extract || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
      category,
      duration,
      bookingUrl: overpassLink(e.tags),
    };
  });
}

// ------------------------------------------------- Source 2 (repli) : Wikipédia geosearch

// Titres à écarter : voies, transports, administratif, événements, bâtiments…
const WIKI_BLOCK =
  /unit[ée] urbaine|communaut[ée]|\bcanton\b|arrondissement|jeux olympiques|festival|cimeti[èe]re|tunnel|quartier|vall[ée]e de|gare des|liste de|^avenue |^rue | rue |^boulevard |^cours [a-zà-ÿ]|tramway|\btram\b|m[ée]tro\b|m[ée]tropole|^pays |\bsi[èe]ge de\b|bataille de|trait[ée] de|congr[èe]s|incendie|attentat|bombardement|occupation|annexion|lib[ée]ration de|^immeuble |^maison (?!de la culture)|^h[ôo]tel (?!de ville|dieu|de r[ée]gion)|^station |^ligne |a[ée]roport|h[ôo]pital|lyc[ée]e|coll[èe]ge|universit[ée]/i;

function classifyTitle(title: string): { category: Cat; duration: string } {
  const t = title.toLowerCase();
  if (/mus[ée]e|galerie|fondation/.test(t)) return { category: "Culture", duration: "1h30" };
  if (/[ée]glise|temple|cath[ée]drale|basilique|chapelle|abbaye|monast[èe]re/.test(t))
    return { category: "Culture", duration: "1h" };
  if (/t[ée]l[ée]ph[ée]rique|t[ée]l[ée]cabine|funiculaire|montenvers/.test(t))
    return { category: "Nature", duration: "demi-journée" };
  if (/mont|aiguille|\bpic\b|\blac\b|glacier|parc|jardin|cascade|gorges|plage|colline|sommet|\bcol\b|grotte/.test(t))
    return { category: "Nature", duration: "demi-journée" };
  if (/place|fontaine|\bpont\b|palais|ch[âa]teau|\btour\b|porte|\barc\b|forum|amphith[ée][âa]tre|colis[ée]e|ar[èe]nes/.test(t))
    return { category: "Culture", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}

async function discoverWikipedia(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  const geoUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=45&format=json`;
  const geoData = (await fetchJson(geoUrl)) as {
    query?: { geosearch?: Array<{ title: string }> };
  } | null;
  const results = geoData?.query?.geosearch ?? [];
  if (results.length === 0) return [];

  const destLower = destination.toLowerCase().split(/[,(]/)[0].trim();
  const isTown = (t: string) =>
    t === destLower || t.replace(/[-\s](mont-blanc|sur-mer|les-bains)$/, "").trim() === destLower;

  const titles = results
    .map((r) => r.title)
    .filter((t) => !WIKI_BLOCK.test(t.toLowerCase()) && !isTown(t.toLowerCase()))
    .slice(0, 16);
  if (titles.length === 0) return [];

  const extracts = await fetchExtracts(titles);

  return titles.map((title) => {
    const { category, duration } = classifyTitle(title);
    return {
      name: title,
      description: (extracts[title] || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
      category,
      duration,
      bookingUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    };
  });
}

// ------------------------------------------------------------------- Point d'entrée

const cache = new Map<string, { at: number; places: PlaceActivity[] }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

/** Renvoie de vraies activités géolocalisées et notables pour la destination. */
export async function fetchPlaceActivities(destination: string): Promise<PlaceActivity[]> {
  try {
    const key = destination.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.places;

    const geo = await geocode(destination);
    if (!geo) return [];

    // 1) Overpass (le plus propre). 2) Repli réel Wikipédia si trop peu/échec.
    let places = await discoverOverpass(geo.lat, geo.lon, destination);
    if (places.length < 6) {
      const wiki = await discoverWikipedia(geo.lat, geo.lon, destination);
      if (wiki.length > places.length) places = wiki;
    }

    if (places.length > 0) cache.set(key, { at: Date.now(), places });
    return places;
  } catch {
    return [];
  }
}

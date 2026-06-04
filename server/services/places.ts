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

type Cat = "Visite" | "Gastronomie" | "Culture" | "Loisir" | "Nature" | "Shopping" | "Bien-être";

export interface PlaceActivity {
  name: string;
  description: string;
  category: Cat;
  duration: string;
  /** Lien réel (site officiel, Google Maps, ou page de réservation), "" si aucun. */
  bookingUrl: string;
  /** Source réelle : "OpenStreetMap" | "Wikipédia" | "Amadeus" | "Foursquare". */
  provider: string;
  /** Prix RÉEL en € (Amadeus), sinon undefined — jamais inventé. */
  cost?: number;
  /** Note RÉELLE (Amadeus 0-5 / Foursquare 0-10), sinon undefined. */
  rating?: number;
  reviewsCount?: number;
  /** Photo RÉELLE (Amadeus / Foursquare), sinon undefined. */
  imageUrl?: string;
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
  // Bien-être : spas, thermes, bains.
  if (tags.amenity === "spa" || tags.amenity === "public_bath" || tags.leisure === "spa")
    return { category: "Bien-être", duration: "demi-journée" };
  // Loisir : téléphériques, trains panoramiques, parcs (attraction/aquatique), sport.
  if (tags.aerialway || tags.railway) return { category: "Loisir", duration: "demi-journée" };
  if (tags.leisure === "water_park" || tags.leisure === "sports_centre" || tags.leisure === "swimming_pool")
    return { category: "Loisir", duration: "demi-journée" };
  const tour = tags.tourism;
  if (tour === "zoo" || tour === "aquarium" || tour === "theme_park")
    return { category: "Loisir", duration: "demi-journée" };
  // Culture : musées, galeries, théâtres, cinémas, monuments.
  if (tour === "museum" || tour === "gallery") return { category: "Culture", duration: "1h30" };
  if (tags.amenity === "theatre" || tags.amenity === "cinema" || tags.amenity === "arts_centre")
    return { category: "Culture", duration: "2h" };
  if (tags.historic) return { category: "Culture", duration: "1h" };
  // Nature : parcs, jardins, réserves, sommets, plages, panoramas…
  if (tags.natural) return { category: "Nature", duration: "demi-journée" };
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "nature_reserve")
    return { category: "Nature", duration: "1h30" };
  if (tour === "viewpoint") return { category: "Nature", duration: "1h" };
  return { category: "Visite", duration: "1h30" };
}

/** Lien : site officiel (OSM) sinon la fiche Google Maps du lieu (utile et moderne). */
function placeLink(tags: Record<string, string>, name: string, dest: string): string {
  const site = tags.website || tags["contact:website"] || tags.url;
  if (site && /^https?:\/\//i.test(site)) return site.split(";")[0].trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${dest}`)}`;
}

async function discoverOverpass(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  const q =
    `[out:json][timeout:25];(` +
    // Lieux notables (avec fiche Wikidata) : monuments, musées, parcs, sommets…
    `nwr["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|theme_park|zoo|aquarium)$"]["wikidata"](around:8000,${lat},${lon});` +
    `nwr["historic"~"^(monument|castle|ruins|memorial|archaeological_site|fort|city_gate)$"]["wikidata"](around:8000,${lat},${lon});` +
    `nwr["leisure"~"^(park|garden|nature_reserve)$"]["wikidata"](around:8000,${lat},${lon});` +
    `nwr["natural"~"^(peak|glacier|volcano|beach|cave_entrance|waterfall)$"]["wikidata"](around:14000,${lat},${lon});` +
    // Activités & bien-être (avec nom) : téléphériques, trains, spas, parcs aquatiques, théâtres…
    `nwr["aerialway"="cable_car"]["name"](around:16000,${lat},${lon});` +
    `nwr["railway"~"^(funicular|narrow_gauge)$"]["name"](around:16000,${lat},${lon});` +
    `nwr["leisure"~"^(water_park|spa)$"]["name"](around:9000,${lat},${lon});` +
    `nwr["amenity"~"^(spa|public_bath|theatre|arts_centre)$"]["name"](around:9000,${lat},${lon});` +
    `);out center tags 200;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  const data = (await fetchJson(url, 22000)) as { elements?: OverpassEl[] } | null;
  const els = data?.elements ?? [];
  if (els.length === 0) return [];

  interface Entry {
    name: string;
    tags: Record<string, string>;
    wiki?: string;
    qid?: string;
    category: Cat;
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
    });
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
  if (buckets.has("Nature")) buckets.set("Nature", buckets.get("Nature")!.slice(0, 6));
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
      description: (extract || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
      category,
      duration,
      bookingUrl: placeLink(e.tags, e.name, destination),
      provider: "OpenStreetMap",
    };
  });
}

// ------------------------------------------------- Source 2 (repli) : Wikipédia geosearch

// Titres à écarter : voies, transports, administratif, événements, bâtiments…
const WIKI_BLOCK =
  /unit[ée] urbaine|communaut[ée]|\bcanton\b|arrondissement|jeux olympiques|festival|cosmo|cimeti[èe]re|tunnel|quartier|vall[ée]e de|gare des|gare de [a-zà-ÿ' -]+-mont-blanc$|presbyt[èe]re|liste de|^avenue |^rue | rue |^boulevard |^cours [a-zà-ÿ]|tramway|\btram\b|m[ée]tro\b|m[ée]tropole|^pays |\bsi[èe]ge de\b|bataille de|trait[ée] de|congr[èe]s|incendie|attentat|bombardement|occupation|annexion|lib[ée]ration de|^immeuble |^maison (?!de la culture)|^h[ôo]tel (?!de ville|dieu|de r[ée]gion)|^ligne |a[ée]roport|h[ôo]pital|lyc[ée]e|coll[èe]ge|universit[ée]/i;

function classifyTitle(title: string): { category: Cat; duration: string } {
  const t = title.toLowerCase();
  if (/spa|thermes|thermal|\bbains\b|bien-[êe]tre|wellness|sauna/.test(t))
    return { category: "Bien-être", duration: "demi-journée" };
  if (/t[ée]l[ée](ph[ée]|f[ée])rique|t[ée]l[ée]cabine|funiculaire|cr[ée]maill[èe]re|montenvers|\bgare de\b|petit train|train du|luge|patinoire|parc aquatique|aquarium|\bzoo\b/.test(t))
    return { category: "Loisir", duration: "demi-journée" };
  if (/mus[ée]e|galerie|fondation|th[ée][âa]tre|op[ée]ra/.test(t)) return { category: "Culture", duration: "1h30" };
  if (/[ée]glise|temple|cath[ée]drale|basilique|chapelle|abbaye|monast[èe]re/.test(t))
    return { category: "Culture", duration: "1h" };
  if (/mont|aiguille|\bpic\b|\blac\b|glacier|parc|jardin|cascade|gorges|plage|colline|sommet|\bcol\b|grotte|r[ée]serve|presqu/.test(t))
    return { category: "Nature", duration: "demi-journée" };
  if (/place|fontaine|\bpont\b|palais|ch[âa]teau|\btour\b|porte|\barc\b|forum|amphith[ée][âa]tre|colis[ée]e|ar[èe]nes|halle|hôtel de ville/.test(t))
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
      bookingUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title}, ${destination}`)}`,
      provider: "Wikipédia",
    };
  });
}

// ------------------------------------------------- Source 3 (clé) : Amadeus (Tours & Activities)

// Vraies activités réservables (agrégateur Viator/Tiqets) avec prix, photo, note
// et lien de réservation. Activée seulement si AMADEUS_CLIENT_ID/SECRET sont définis.
let amadeusTok: { token: string; exp: number } | null = null;
async function amadeusToken(): Promise<string | null> {
  const id = process.env.AMADEUS_CLIENT_ID;
  const secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (amadeusTok && Date.now() < amadeusTok.exp) return amadeusTok.token;
  const base = process.env.AMADEUS_BASE || "https://test.api.amadeus.com";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${base}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    amadeusTok = { token: j.access_token, exp: Date.now() + ((j.expires_in ?? 1800) - 60) * 1000 };
    return j.access_token;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function discoverAmadeus(lat: number, lon: number): Promise<PlaceActivity[]> {
  const token = await amadeusToken();
  if (!token) return [];
  const base = process.env.AMADEUS_BASE || "https://test.api.amadeus.com";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${base}/v1/shopping/activities?latitude=${lat}&longitude=${lon}&radius=20`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      data?: Array<{
        name?: string;
        shortDescription?: string;
        rating?: string;
        pictures?: string[];
        price?: { amount?: string };
        bookingLink?: string;
      }>;
    };
    return (j.data ?? [])
      .filter((a) => a.name)
      .slice(0, 16)
      .map((a) => ({
        name: a.name!,
        description: (a.shortDescription || "Activité réservable.").replace(/<[^>]+>/g, "").slice(0, 240),
        category: "Loisir" as Cat,
        duration: "demi-journée",
        bookingUrl: a.bookingLink || "",
        provider: "Amadeus",
        cost: a.price?.amount ? Math.round(Number(a.price.amount)) || undefined : undefined,
        rating: a.rating ? Number(a.rating) || undefined : undefined,
        imageUrl: Array.isArray(a.pictures) && a.pictures[0] ? a.pictures[0] : undefined,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------- Source 4 (clé) : Foursquare Places

function fsqCategory(cats: Array<{ name?: string }> | undefined): Cat {
  const n = (cats?.[0]?.name || "").toLowerCase();
  if (/spa|bath|sauna|wellness|massage|hammam/.test(n)) return "Bien-être";
  if (/museum|gallery|art|theater|theatre|historic|monument|church|temple|landmark/.test(n)) return "Culture";
  if (/restaurant|food|café|cafe|bar|bistro|brasserie|winery|brewery|market/.test(n)) return "Gastronomie";
  if (/park|garden|mountain|lake|beach|trail|scenic|nature|forest|waterfall/.test(n)) return "Nature";
  if (/amusement|aquarium|zoo|tour|cable|funicular|sports|ski|climb|water park|entertainment/.test(n))
    return "Loisir";
  if (/shop|mall|store|boutique|market/.test(n)) return "Shopping";
  return "Visite";
}

async function discoverFoursquare(lat: number, lon: number): Promise<PlaceActivity[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const url =
      `https://api.foursquare.com/v3/places/search?ll=${lat},${lon}&radius=6000&limit=20&sort=POPULARITY` +
      `&fields=name,categories,rating,stats,photos,website,location`;
    const res = await fetch(url, { headers: { Authorization: apiKey, Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      results?: Array<{
        name?: string;
        categories?: Array<{ name?: string }>;
        rating?: number;
        stats?: { total_ratings?: number };
        photos?: Array<{ prefix?: string; suffix?: string }>;
        website?: string;
      }>;
    };
    return (j.results ?? [])
      .filter((p) => p.name)
      .map((p) => {
        const photo = p.photos?.[0];
        return {
          name: p.name!,
          description: (p.categories?.[0]?.name || "Lieu populaire.").slice(0, 240),
          category: fsqCategory(p.categories),
          duration: "1h30",
          bookingUrl: p.website || "",
          provider: "Foursquare",
          rating: typeof p.rating === "number" ? p.rating : undefined, // 0-10
          reviewsCount: p.stats?.total_ratings,
          imageUrl: photo?.prefix && photo?.suffix ? `${photo.prefix}original${photo.suffix}` : undefined,
        };
      });
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------- Point d'entrée

const cache = new Map<string, { at: number; places: PlaceActivity[] }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

/**
 * Agrège plusieurs sources RÉELLES en parallèle puis fusionne :
 *   - Amadeus (activités réservables + prix + photo) et Foursquare (commerces +
 *     photos), si leurs clés sont configurées — ils passent en premier ;
 *   - OpenStreetMap (Overpass) et Wikipédia (toujours, sans clé) complètent.
 * Dédoublonné par nom, on garde le tout (les catégories servent au filtre UI).
 */
export async function fetchPlaceActivities(destination: string): Promise<PlaceActivity[]> {
  try {
    const key = destination.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.places;

    const geo = await geocode(destination);
    if (!geo) return [];

    // Toutes les sources disponibles, en parallèle. Les sources à clé (Amadeus,
    // Foursquare) renvoient [] si non configurées → aucun impact.
    const [am, fs, ov, wk] = await Promise.all([
      discoverAmadeus(geo.lat, geo.lon).catch(() => [] as PlaceActivity[]),
      discoverFoursquare(geo.lat, geo.lon).catch(() => [] as PlaceActivity[]),
      discoverOverpass(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverWikipedia(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
    ]);

    // Amadeus & Foursquare d'abord (plus riches : prix/photos), puis OSM/Wikipédia.
    const seen = new Set<string>();
    const places: PlaceActivity[] = [];
    for (const p of [...am, ...fs, ...ov, ...wk]) {
      const k = p.name.trim().toLowerCase();
      if (!p.name || seen.has(k)) continue;
      seen.add(k);
      places.push(p);
      if (places.length >= 28) break;
    }

    if (places.length > 0) cache.set(key, { at: Date.now(), places });
    return places;
  } catch {
    return [];
  }
}

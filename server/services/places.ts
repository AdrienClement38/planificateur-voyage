/**
 * Découverte d'activités RÉELLES et géolocalisées pour une destination, en
 * fusionnant plusieurs sources (chacune apporte son plus) :
 *   1. OpenStreetMap (Overpass) : POI tourisme/monument/parc/sommet avec fiche
 *      Wikidata (= notables), classés par notoriété (versions linguistiques).
 *   2. Wikivoyage : listings « Voir / Faire » curated (liens officiels, descriptions).
 *   3. Wikipédia (geosearch) : lieux réels autour du point, filtrés du bruit.
 *   4. Foursquare Places (clé gratuite optionnelle) : vrais lieux que les autres
 *      ratent (spas, luge, parcs) — niveau gratuit = nom/catégorie/site web.
 * 1 à 3 marchent sans aucune clé ; 4 ne s'active qu'avec sa clé (sinon []).
 * Géocodage via Nominatim, descriptions via Wikipédia/Wikivoyage.
 *
 * On ne renvoie QUE du factuel : nom, description, catégorie, lien réels, et
 * prix/note/photo uniquement quand la source les fournit. JAMAIS d'invention.
 * Liste vide si tout échoue (l'appelant affiche un état vide honnête).
 */

type Cat = "Visite" | "Gastronomie" | "Culture" | "Loisir" | "Nature" | "Shopping" | "Bien-être";

export interface PlaceActivity {
  name: string;
  description: string;
  category: Cat;
  duration: string;
  /** Lien réel (site officiel, Google Maps, ou page de réservation), "" si aucun. */
  bookingUrl: string;
  /** Source réelle : "OpenStreetMap" | "Wikivoyage" | "Wikipédia" | "Foursquare". */
  provider: string;
  /** Prix RÉEL en €, sinon undefined — jamais inventé. */
  cost?: number;
  /** Note RÉELLE, sinon undefined — jamais inventée. */
  rating?: number;
  reviewsCount?: number;
  /** Photo RÉELLE, sinon undefined. */
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
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
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

async function discoverOverpass(
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

// ------------------------------------------------- Source : Wikivoyage (guide open data)

// Wikivoyage (FR) : guide de voyage collaboratif, licence CC-BY-SA (comme
// Wikipédia → stockable avec attribution). On extrait les listings {{voir}} et
// {{faire}}, curated par des humains : ils donnent souvent un VRAI lien officiel
// et une description, là où OSM ne livre qu'un POI brut.

/** Nettoie le wikitexte (liens, templates, balises, gras) en texte simple. */
function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrait le contenu interne de chaque template {{name …}} (comptage d'accolades). */
function wvBlocks(wikitext: string, name: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`\\{\\{\\s*${name}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
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

/** Parse les paramètres |clé=valeur d'un bloc (en respectant {{}} et [[]] imbriqués). */
function wvFields(block: string): Record<string, string> {
  const parts: string[] = [];
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
  const out: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0) out[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return out;
}

async function wvWikitext(title: string): Promise<string | null> {
  const url = `https://fr.wikivoyage.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(
    title,
  )}&format=json`;
  const data = (await fetchJson(url)) as {
    query?: { pages?: Record<string, { revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }> };
  } | null;
  const page = Object.values(data?.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

// Listings « pratiques » à écarter (offices de tourisme, admin, transport, santé…) :
// ce ne sont pas des activités à planifier.
const WV_BLOCK =
  /office de tourisme|information[s]? touristique|syndicat d'initiative|maison du tourisme|pr[ée]fecture|sous-pr[ée]fecture|\bmairie\b|h[ôo]tel de ville|consulat|ambassade|\bgare\b|gare routi[èe]re|a[ée]roport|\bparking\b|station-service|station service|h[ôo]pital|clinique|pharmacie|\bla poste\b|bureau de poste|commissariat|gendarmerie|\bbanque\b|distributeur|bureau de change|laverie|location de v[ée]lo|\btaxi\b|supermarch[ée]|\blyc[ée]e\b|\bcoll[èe]ge\b|universit[ée]|palais de justice|\btribunal\b/i;

async function discoverWikivoyage(destination: string): Promise<PlaceActivity[]> {
  const q = destination.split(/[,(]/)[0].trim();
  // Essai direct par titre (gère les redirections) ; sinon, recherche plein texte.
  let wikitext = await wvWikitext(q);
  if (!wikitext) {
    const sUrl = `https://fr.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q,
    )}&srlimit=1&format=json`;
    const sd = (await fetchJson(sUrl)) as { query?: { search?: Array<{ title: string }> } } | null;
    const title = sd?.query?.search?.[0]?.title;
    if (title) wikitext = await wvWikitext(title);
  }
  if (!wikitext) return [];
  const wt = wikitext;

  const out: PlaceActivity[] = [];
  const seen = new Set<string>();
  const collect = (tpl: string, isActivity: boolean) => {
    for (const block of wvBlocks(wt, tpl)) {
      const f = wvFields(block);
      const name = stripWiki(f["nom"] || "");
      const k = name.toLowerCase();
      if (name.length < 2 || seen.has(k) || WV_BLOCK.test(k)) continue;
      seen.add(k);
      const guess = classifyTitle(name);
      // {{faire}} = activité → Loisir par défaut si le nom ne dit rien de précis.
      const generic = guess.category === "Visite";
      const url = (f["url"] || "").trim();
      out.push({
        name,
        description: (stripWiki(f["description"] || "") || stripWiki(f["adresse"] || "") || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
        category: isActivity && generic ? "Loisir" : guess.category,
        duration: isActivity && generic ? "demi-journée" : guess.duration,
        bookingUrl: /^https?:\/\//i.test(url)
          ? url.split(/\s/)[0]
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${destination}`)}`,
        provider: "Wikivoyage",
      });
    }
  };
  collect("voir", false);
  collect("faire", true);
  return out.slice(0, 18);
}

// ------------------------------------------------- Source (clé optionnelle) : Foursquare Places

// Catégorie Foursquare (nom lisible) → notre taxonomie. Large, pour bien capter
// les lieux que OSM/Wikipédia ratent (spas, luge, parcs, téléphériques…).
function fsqCategory(cats: Array<{ name?: string }> | undefined): Cat {
  const n = (cats?.[0]?.name || "").toLowerCase();
  if (/spa|bath|sauna|wellness|massage|hammam|thermal|therme|onsen/.test(n)) return "Bien-être";
  if (
    /museum|gallery|\bart\b|theater|theatre|historic|monument|church|temple|cathedral|mosque|synagogue|landmark|memorial|castle|palace|heritage|cultural|library|exhibit|opera/.test(n)
  )
    return "Culture";
  if (
    /park|garden|mountain|lake|beach|trail|scenic|nature|forest|waterfall|\bhill\b|valley|river|island|\bcave\b|viewpoint|lookout|botanical|reserve|glacier/.test(n)
  )
    return "Nature";
  if (
    /amusement|aquarium|\bzoo\b|cable car|funicular|gondola|cog railway|\bski\b|climb|water park|theme|luge|toboggan|playground|recreation|golf|bowling|arcade|stadium|arena|adventure|rafting|kayak|\bboat\b|cruise|entertainment/.test(
      n,
    )
  )
    return "Loisir";
  if (/restaurant|food|café|cafe|\bbar\b|bistro|brasserie|winery|brewery|eatery|diner/.test(n))
    return "Gastronomie";
  if (/shop|mall|store|boutique|market/.test(n)) return "Shopping";
  return "Visite";
}

// API Foursquare Places (v2025) : l'ancien /v3 a été déprécié le 15/05/2026.
// Endpoint places-api.foursquare.com, auth Bearer + en-tête de version daté.
// Niveau GRATUIT ("Places Pro") : nom, catégories, site web — note/photo sont
// des champs "Premium" payants, qu'on ne demande donc PAS (zéro donnée inventée).
// Foursquare apporte de VRAIS lieux absents d'OSM/Wikipédia (spas, luge, parcs).
// On écarte le bruit (commerces, restos, services non touristiques).
async function discoverFoursquare(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const fields = "fsq_place_id,name,categories,website,location";
    const url =
      `https://places-api.foursquare.com/places/search?ll=${lat},${lon}&radius=8000&limit=50` +
      `&fields=${encodeURIComponent(fields)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Places-Api-Version": "2025-06-17",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      results?: Array<{
        name?: string;
        categories?: Array<{ name?: string }>;
        website?: string;
        location?: { formatted_address?: string };
      }>;
    };
    const out: PlaceActivity[] = [];
    for (const p of j.results ?? []) {
      if (!p.name) continue;
      const category = fsqCategory(p.categories);
      // On ne garde que le touristique : on écarte "Visite" générique (commerces,
      // services), la restauration et le shopping (bruit pour un planning).
      if (category === "Visite" || category === "Gastronomie" || category === "Shopping") continue;
      const catName = p.categories?.[0]?.name;
      out.push({
        name: p.name,
        description: (catName || p.location?.formatted_address || `Lieu réel à ${destination}.`).slice(0, 240),
        category,
        duration: category === "Bien-être" ? "demi-journée" : "1h30",
        bookingUrl:
          p.website && /^https?:\/\//i.test(p.website)
            ? p.website
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${destination}`)}`,
        provider: "Foursquare",
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------- Point d'entrée

const cache = new Map<string, { at: number; places: PlaceActivity[] }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

/** Clé de dédoublonnage : minuscule, sans accents ni ponctuation (« L'Aiguille-du-Midi » == « aiguille du midi »). */
function dedupKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Agrège plusieurs sources RÉELLES en parallèle puis fusionne :
 *   - Wikivoyage (listings curated + liens officiels), OpenStreetMap (Overpass,
 *     POI notables) et Wikipédia : gratuits, sans clé, toujours actifs ;
 *   - Foursquare (lieux commerciaux) : seulement si sa clé est configurée.
 * Dédoublonné par nom normalisé (sans accents), on garde le tout (les catégories
 * servent au filtre UI).
 */
export async function fetchPlaceActivities(destination: string): Promise<PlaceActivity[]> {
  try {
    const key = destination.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.places;

    const geo = await geocode(destination);
    if (!geo) return [];

    // Toutes les sources en parallèle. Foursquare (à clé) renvoie [] si non
    // configurée → aucun impact sur le socle gratuit.
    const [fs, wv, ov, wk] = await Promise.all([
      discoverFoursquare(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverWikivoyage(destination).catch(() => [] as PlaceActivity[]),
      discoverOverpass(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverWikipedia(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
    ]);

    // Ordre de priorité (le 1er garde la main en cas de doublon) : Foursquare et
    // Wikivoyage (liens officiels) d'abord, puis OSM (classé par notoriété), enfin
    // le repli Wikipédia.
    const seen = new Set<string>();
    const places: PlaceActivity[] = [];
    for (const p of [...fs, ...wv, ...ov, ...wk]) {
      if (!p.name) continue;
      const k = dedupKey(p.name);
      if (!k || seen.has(k)) continue;
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

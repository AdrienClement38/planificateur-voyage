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
  /** Lien « Voir le lieu » : fiche Google Maps du lieu (uniforme, toutes sources). */
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
  /** Indice interne : titre d'article Wikipédia (FR) pour retrouver photo/intro. */
  wikiTitle?: string;
  /** Notoriété interne : nombre de versions linguistiques Wikipédia (classement). */
  fame?: number;
}

// Wikimedia exige un User-Agent identifiable avec contact (réduit le throttling).
const UA = "Co-Tripper/1.0 (https://co-tripper.example; contact@co-tripper.example)";

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

/** Lien « Voir le lieu » : TOUJOURS une fiche Google Maps (uniforme, toutes sources). */
function mapsLink(name: string, dest: string): string {
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
      bookingUrl: mapsLink(e.name, destination),
      provider: "OpenStreetMap",
      wikiTitle: e.wiki,
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
  const geoUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=90&format=json`;
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
    .slice(0, 28);
  if (titles.length === 0) return [];

  const extracts = await fetchExtracts(titles);

  return titles.map((title) => {
    const { category, duration } = classifyTitle(title);
    return {
      name: title,
      description: (extracts[title] || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
      category,
      duration,
      bookingUrl: mapsLink(title, destination),
      provider: "Wikipédia",
    };
  });
}

// ------------------------------------------------- Source : Wikidata SPARQL (notoriété mondiale)

// Dans les villes denses, la recherche de PROXIMITÉ (OSM/Wikipédia) rate les
// icônes un peu éloignées du centre (Tour Eiffel, Louvre…). Wikidata SPARQL
// classe par NOTORIÉTÉ (sitelinks = nb de Wikipédia), ce qui fait remonter les
// incontournables. Seuil élevé (≥20) → rapide même à Paris, et pile sur les
// monuments mondiaux. Les petites villes en tirent peu (le socle les couvre).

// Types Wikidata NON visitables (notoriété trompeuse) : villes, pays, langues,
// organisations, personnes, événements, régions/périodes, universités.
const WD_BAD_TYPES = new Set([
  "Q515", "Q1549591", "Q5119", "Q484170", "Q3957", "Q532", "Q15284", "Q702842",
  "Q6256", "Q3624078", "Q7275", "Q3024240",
  "Q34770",
  "Q43229", "Q193483", "Q327333", "Q163740", "Q4830453", "Q161726",
  "Q5",
  "Q1656682", "Q1190554", "Q13418847", "Q178561", "Q198", "Q2223653", "Q3199915",
  "Q56061", "Q10864048", "Q82794", "Q34876", "Q1799794", "Q15916867",
  "Q11514315", "Q11772",
  "Q3918", "Q38723",
  "Q41710",
  // Régions, universités historiques, entités/ordres/traités de droit international.
  "Q36784", "Q3551775", "Q4671277", "Q15893266",
  "Q391009", "Q474717", "Q1896989", "Q2311325",
  "Q1063239", "Q1147274", "Q1414472", "Q16567729",
  // Entreprises/sociétés (le siège est un bâtiment, mais ça ne se « visite » pas).
  "Q891723", "Q6881511", "Q783794", "Q4830453",
  // Grandes surfaces (Carrefour…) : chaîne de magasins / chaîne de supermarchés.
  // On NE bannit PAS « grand magasin » (Q216107) → Galeries Lafayette, Printemps,
  // La Samaritaine (iconiques) restent.
  "Q507619", "Q18043413",
  // Défense en profondeur : non-lieux qui fuiteraient si le filtre « lieu »
  // échouait — page d'homonymie (Q4167410) et groupe de peintures (Q18573970,
  // ex. Le Cri). Filtrés en JS d'office, sans dépendre de la requête SPARQL.
  "Q4167410", "Q18573970",
  // NB : on ne bannit PLUS les types « œuvre d'art » (sculpture/peinture/fresque) :
  // ça excluait à tort Trevi (site touristique ET sculpture). C'est le filtre
  // « lieu » (wikidataPlaceFilter) qui écarte les œuvres pures non visitables.
]);

// Super-types « lieu » (allow-list) : un candidat n'est gardé que s'il est
// sous-classe de l'un d'eux. Couvre bâtiments, monuments, places, avenues,
// quartiers, parcs, reliefs, plans d'eau, sites… et exclut tout le reste
// (événements, traités, affaires, œuvres) d'un seul filtre robuste.
const WD_PLACE_TYPES = [
  "wd:Q811979", // structure architecturale (bâtiments, tours, ponts, églises, palais…)
  "wd:Q570116", // attraction touristique
  "wd:Q839954", // site archéologique
  "wd:Q8502", "wd:Q54050", "wd:Q271669", // montagne, colline, relief
  "wd:Q23397", "wd:Q15324", "wd:Q23442", // lac, plan d'eau, île
  "wd:Q22698", "wd:Q4421", // parc, forêt
  "wd:Q83620", "wd:Q174782", // voie (avenue/rue), place publique
  "wd:Q123705", "wd:Q3257686", // quartier, localité
  "wd:Q39614", // cimetière
];

type WdItemResp = { results?: { bindings?: Array<{ item?: { value?: string } }> } };

/** Lance une requête SPARQL « liste de Q-ids » avec 1 réessai. `null` si échec réel. */
async function sparqlItemSet(sparql: string, ms: number): Promise<Set<string> | null> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  let data = (await fetchJson(url, ms)) as WdItemResp | null;
  if (!data?.results) {
    await new Promise((r) => setTimeout(r, 700));
    data = (await fetchJson(url, ms)) as WdItemResp | null;
  }
  if (!data?.results) return null; // échec réseau/throttle après réessai
  const set = new Set<string>();
  for (const b of data.results.bindings ?? []) {
    const id = b.item?.value?.split("/").pop();
    if (id) set.add(id);
  }
  return set;
}

/**
 * Filtre CRITIQUE : sous-ensemble des Q-ids qui SONT des lieux (sous-classe d'un
 * super-type « lieu »). Léger (allow-list seule) pour rester fiable. Renvoie
 * `null` en cas d'ÉCHEC réseau (≠ Set vide = « aucun lieu ») afin que l'appelant
 * échoue SÛR (Wikidata vide) au lieu de laisser tout passer (fail-open).
 */
async function wikidataPlaceFilter(qids: string[]): Promise<Set<string> | null> {
  if (qids.length === 0) return new Set();
  // Découpe en lots de 100 : une requête P279* sur 100 items est bien plus rapide
  // (et bien moins sujette au timeout) que sur 220. Lots en PARALLÈLE → même temps
  // mural, mais chacun fiable. Si UN lot échoue franchement → échec global (null).
  const chunks: string[][] = [];
  for (let i = 0; i < qids.length; i += 100) chunks.push(qids.slice(i, i + 100));
  const results = await Promise.all(
    chunks.map((c) => {
      const values = c.map((q) => `wd:${q}`).join(" ");
      const sparql =
        `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
        `?item wdt:P31/wdt:P279* ?s. VALUES ?s { ${WD_PLACE_TYPES.join(" ")} } }`;
      return sparqlItemSet(sparql, 12000);
    }),
  );
  if (results.some((r) => r === null)) return null;
  const set = new Set<string>();
  for (const r of results) for (const id of r!) set.add(id);
  return set;
}

/**
 * Purge SECONDAIRE (non critique) : parmi des Q-ids déjà confirmés « lieux »,
 * renvoie ceux à ÉCARTER — cours d'eau (rivières), chaînes/massifs de montagnes,
 * et communes SÉPARÉES (zone habitée Q486972 qui n'est PAS un quartier
 * Q123705/Q2983893 → vire Courmayeur, garde Montmartre/Trastevere). Léger (sur
 * ~50 survivants) ; en cas d'échec on ne purge rien (Set vide) — les vues
 * classent ces parasites tout en bas de toute façon.
 */
async function wikidataPurge(qids: string[]): Promise<Set<string>> {
  if (qids.length === 0) return new Set();
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } { ` +
    `?item wdt:P31/wdt:P279* ?b. VALUES ?b { wd:Q355304 wd:Q46831 } ` +
    `} UNION { ` +
    `?item wdt:P31/wdt:P279* wd:Q486972. ` +
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* ?q. VALUES ?q { wd:Q123705 wd:Q2983893 } } ` +
    `} UNION { ` +
    // Œuvre d'art exposée DANS un édifice (basilique, musée, église, palais) = un
    // OBJET, pas un « lieu » à part : on l'écarte de la liste (elle est déjà dans
    // « Œuvres à voir » du lieu). Ex. La Pietà, David. On GARDE les statues en
    // EXTÉRIEUR (Manneken-Pis, Statue de la Liberté), dont le lieu n'est pas un
    // édifice clos.
    `?item wdt:P31 ?at. VALUES ?at { wd:Q860861 wd:Q3305213 wd:Q179700 wd:Q22669139 wd:Q838948 wd:Q4502142 } ` +
    `?item wdt:P276 ?loc. ?loc wdt:P31/wdt:P279* ?bt. ` +
    `VALUES ?bt { wd:Q33506 wd:Q1370598 wd:Q16970 wd:Q41176 wd:Q16560 } } }`;
  return (await sparqlItemSet(sparql, 10000)) ?? new Set();
}

interface WdAgg {
  label: string;
  sitelinks: number;
  types: Set<string>;
  image?: string;
}

// Interroge Wikidata autour d'un point, au-dessus d'un seuil de notoriété.
async function wikidataAround(
  lat: number,
  lon: number,
  minSitelinks: number,
  radiusKm: number,
): Promise<Map<string, WdAgg>> {
  const sparql =
    `SELECT ?item ?label ?sitelinks ?type ?image WHERE {` +
    `SERVICE wikibase:around { ?item wdt:P625 ?c. bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral. bd:serviceParam wikibase:radius "${radiusKm}". }` +
    `?item wikibase:sitelinks ?sitelinks. FILTER(?sitelinks >= ${minSitelinks})` +
    `?item wdt:P31 ?type. ?item rdfs:label ?label. FILTER(lang(?label) = "fr")` +
    `OPTIONAL { ?item wdt:P18 ?image. }` +
    `} ORDER BY DESC(?sitelinks) LIMIT 500`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  type WdResp = {
    results?: {
      bindings?: Array<{
        item?: { value?: string };
        label?: { value?: string };
        sitelinks?: { value?: string };
        type?: { value?: string };
        image?: { value?: string };
      }>;
    };
  };
  // Wikidata est essentiel pour le classement par notoriété : 1 réessai si la
  // requête échoue (throttle/réseau), pour ne pas dégrader tout l'ordre.
  let data = (await fetchJson(url, 16000)) as WdResp | null;
  if (!data?.results) {
    await new Promise((r) => setTimeout(r, 800));
    data = (await fetchJson(url, 16000)) as WdResp | null;
  }
  const byId = new Map<string, WdAgg>();
  for (const b of data?.results?.bindings ?? []) {
    const id = b.item?.value?.split("/").pop();
    const label = b.label?.value;
    if (!id || !label) continue;
    let a = byId.get(id);
    if (!a) {
      a = { label, sitelinks: Number(b.sitelinks?.value) || 0, types: new Set() };
      byId.set(id, a);
    }
    const ty = b.type?.value?.split("/").pop();
    if (ty) a.types.add(ty);
    if (!a.image && b.image?.value) a.image = b.image.value;
  }
  return byId;
}

// ---- Notoriété TOURISTIQUE : vraies vues Wikipédia (≠ nombre de langues) ----

/**
 * Vues Wikipédia sur les 3 DERNIÈRES ANNÉES (≠ 60 j) pour des titres d'articles,
 * par langue. Fenêtre LONGUE pour LISSER les pics d'actu/sport : un stade
 * explose les jours de match (Wembley passait devant Big Ben sur 60 j !) mais un
 * monument est consulté toute l'année → notoriété vraiment touristique. API REST
 * par article (pas de lot) : concurrence limitée (6) + 1 réessai anti-throttle.
 */
// Cache LONG des vues (14 j) : les vues bougent lentement, mais l'API REST est
// par-article + throttlée → on évite de la re-solliciter. Une fois chaud, le tri
// est quasi instantané (et les lieux partagés entre villes profitent du cache).
const PV_CACHE = new Map<string, { at: number; v: number }>();
const PV_TTL = 14 * 24 * 60 * 60 * 1000;

async function wikiPageviews(lang: string, titles: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (titles.length === 0) return out;
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const end = `${now.getFullYear()}${mm}0100`; // 1er du mois courant
  const start = `${now.getFullYear() - 3}${mm}0100`; // 3 ans avant

  const one = async (title: string): Promise<number> => {
    const key = `${lang}|${title}`;
    const hit = PV_CACHE.get(key);
    if (hit && now.getTime() - hit.at < PV_TTL) return hit.v;
    const enc = encodeURIComponent(title.replace(/ /g, "_"));
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
      `${lang}.wikipedia/all-access/all-agents/${enc}/monthly/${start}/${end}`;
    let data = (await fetchJson(url, 7000)) as { items?: Array<{ views?: number }> } | null;
    if (!data) {
      await new Promise((r) => setTimeout(r, 200)); // 1 réessai court (transitoire)
      data = (await fetchJson(url, 7000)) as { items?: Array<{ views?: number }> } | null;
    }
    let s = 0;
    for (const it of data?.items ?? []) s += it.views ?? 0;
    if (data) PV_CACHE.set(key, { at: now.getTime(), v: s }); // ne cache PAS un échec (null)
    return s;
  };

  // Vagues de 16 requêtes concurrentes (compromis vitesse / throttle).
  const CONC = 16;
  for (let i = 0; i < titles.length; i += CONC) {
    const slice = titles.slice(i, i + CONC);
    const views = await Promise.all(slice.map((t) => one(t)));
    slice.forEach((t, k) => out.set(t, views[k]));
  }
  return out;
}

/**
 * Pour des Q-ids, somme des vues Wikipédia FR + EN via les titres CANONIQUES des
 * sitelinks (zéro redirection). Signal de notoriété réelle : ce que les gens
 * consultent vraiment — contrairement au nombre de langues, qui sur-classe
 * communes/rivières/chaînes. Tolérant à l'échec (Map partielle → repli sitelinks).
 */
async function fetchPopularity(qids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (qids.length === 0) return result;
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql =
    `SELECT ?item ?frTitle ?enTitle WHERE { VALUES ?item { ${values} } ` +
    `OPTIONAL { ?fa schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>; schema:name ?frTitle. } ` +
    `OPTIONAL { ?ea schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enTitle. } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  const data = (await fetchJson(url, 12000)) as {
    results?: {
      bindings?: Array<{
        item?: { value?: string };
        frTitle?: { value?: string };
        enTitle?: { value?: string };
      }>;
    };
  } | null;
  const frOf = new Map<string, string>();
  const enOf = new Map<string, string>();
  for (const b of data?.results?.bindings ?? []) {
    const qid = b.item?.value?.split("/").pop();
    if (!qid) continue;
    if (b.frTitle?.value) frOf.set(qid, b.frTitle.value);
    if (b.enTitle?.value) enOf.set(qid, b.enTitle.value);
  }
  // Séquentiel (FR puis EN) : on ne double pas la concurrence vers l'API REST.
  const frViews = await wikiPageviews("fr", [...new Set(frOf.values())]);
  const enViews = await wikiPageviews("en", [...new Set(enOf.values())]);
  for (const qid of qids) {
    const v =
      (frOf.has(qid) ? frViews.get(frOf.get(qid)!) ?? 0 : 0) +
      (enOf.has(qid) ? enViews.get(enOf.get(qid)!) ?? 0 : 0);
    if (v > 0) result.set(qid, v);
  }
  return result;
}

async function discoverWikidata(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  // Source PRINCIPALE des suggestions : rayon LARGE (20 km) pour capter les
  // monuments des alentours (Versailles, Bygdøy…), seuil ≥10 langues pour
  // descendre jusqu'aux musées notables. Le tri par sitelinks garde les plus
  // connus en tête ; le cache 6 h absorbe la latence variable de Wikidata.
  const byId = await wikidataAround(lat, lon, 14, 20);
  if (byId.size === 0) return [];

  const destLow = destination.toLowerCase().split(/[,(]/)[0].trim();
  // Candidats triés par notoriété, hors types évidents non visitables et hors
  // destination elle-même.
  // On prend TRÈS LARGE (220 sur les 500 récupérés) : beaucoup de candidats à
  // fort sitelinks sont des non-lieux (orgas, événements, régions…) retirés
  // ensuite par le filtre « lieu ». Dans une mégapole, les vrais lieux du 2e
  // rang sont noyés très bas dans le classement de notoriété — il faut donc
  // sur-échantillonner massivement pour en faire remonter ~50 à la fin.
  const candidates = [...byId.entries()]
    .filter(([, a]) => ![...a.types].some((t) => WD_BAD_TYPES.has(t)) && a.label.toLowerCase() !== destLow)
    .sort((a, b) => b[1].sitelinks - a[1].sitelinks)
    .slice(0, 220);
  if (candidates.length === 0) return [];

  // Vérifie que chaque candidat EST un lieu (sous-classe de « lieu ») : écarte
  // événements, traités, œuvres, bateaux… géotaggés au même endroit.
  const placeIds = await wikidataPlaceFilter(candidates.map(([id]) => id));
  // FAIL-SAFE : si le filtre « lieu » échoue (réseau/throttle même après réessai),
  // on NE retombe PAS sur Wikipédia (ordre pourri, source douteuse). On GARDE les
  // candidats Wikidata — déjà pré-filtrés par WD_BAD_TYPES (œuvres, homonymies,
  // supermarchés…) — et on les classe par les VRAIES VUES juste après : ordre
  // correct, garbage très limité. État RARE (filtre découpé + réessais).
  const survivors = placeIds
    ? candidates.filter(([id]) => placeIds.has(id))
    : candidates;
  // PURGE secondaire (rivières/chaînes/communes séparées) sur ce petit lot (~50) :
  // légère et non bloquante (échec → on ne purge rien, les vues les classent bas).
  const drop = await wikidataPurge(survivors.map(([id]) => id));

  const out: PlaceActivity[] = [];
  const outIds: string[] = [];
  for (const [id, a] of survivors) {
    if (drop.has(id)) continue;
    const { category, duration } = classifyTitle(a.label);
    out.push({
      name: a.label,
      description: "",
      category,
      duration,
      bookingUrl: mapsLink(a.label, destination),
      provider: "Wikidata",
      fame: a.sitelinks,
      wikiTitle: a.label,
      imageUrl: a.image ? a.image.replace(/^http:/, "https:") + "?width=800" : undefined,
    });
    outIds.push(id);
    if (out.length >= 55) break;
  }

  // Re-classement par notoriété TOURISTIQUE : on remplace le tri par sitelinks
  // (nombre de langues, qui sur-classe communes/rivières) par les VRAIES vues
  // Wikipédia FR+EN. Repli sur les sitelinks pour les rares lieux sans article
  // consulté. C'est ce tri (via `fame`) que la curation finale réutilise.
  // On ne sonde les vues que pour les ~40 meilleurs candidats (par sitelinks) :
  // c'est là que se joue le re-classement utile (page 1-2), et ça limite le
  // nombre d'appels REST. Le reste garde son rang sitelinks (queue de liste).
  const popularity = await fetchPopularity(outIds.slice(0, 40));
  out.forEach((p, i) => {
    const views = popularity.get(outIds[i]);
    if (views && views > 0) p.fame = views;
  });
  out.sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0));
  return out;
}

// ------------------------------------------------- Œuvres à voir dans un lieu (Wikidata)

export interface PlaceHighlight {
  /** Nom de l'œuvre (FR). */
  name: string;
  /** Photo réelle (Commons), sinon undefined. */
  imageUrl?: string;
}

// Types « œuvre d'art » acceptés (peinture, fresque, sculpture, statue, œuvre
// d'art, œuvre visuelle, + « groupe de peintures » : pour les chefs-d'œuvre en
// plusieurs versions comme Le Cri, dont la notoriété est portée par l'entité
// « groupe », les versions physiques étant quasi inconnues sur Wikipédia).
// Liste DIRECTE (pas de P279*) = requête rapide.
const WD_ART_TYPES = [
  "wd:Q3305213", "wd:Q22669139", "wd:Q860861", "wd:Q179700", "wd:Q838948", "wd:Q4502142",
  "wd:Q18573970",
];

const highlightsCache = new Map<string, { at: number; items: PlaceHighlight[]; ttl: number }>();
const HL_TTL = 6 * 60 * 60 * 1000; // 6 h
const HL_TTL_EMPTY = 30 * 60 * 1000; // 30 min si vide/échec (auto-réparation)

/**
 * Œuvres majeures à voir DANS des lieux (musée, chapelle, cathédrale…), en LOT.
 * S'appuie sur Wikidata : une œuvre déclare son lieu via P276 (emplacement) ou
 * P195 (collection) — 100 % données réelles, rien d'inventé. Seuil de notoriété
 * (≥5 langues) : on ne garde que les œuvres qui valent vraiment le détour, et la
 * requête reste rapide même pour les musées immenses (la Galerie Borghèse a 184
 * œuvres, dont l'écrasante majorité d'inconnues). Renvoie une map
 * { nomDuLieu → œuvres }, tableau vide si le lieu n'a aucune œuvre notable.
 */
export async function discoverPlaceHighlightsBatch(
  names: string[],
): Promise<Record<string, PlaceHighlight[]>> {
  const out: Record<string, PlaceHighlight[]> = {};
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const missing: string[] = [];
  for (const name of uniq) {
    const hit = highlightsCache.get(name.toLowerCase());
    if (hit && Date.now() - hit.at < hit.ttl) out[name] = hit.items;
    else missing.push(name);
  }
  if (missing.length === 0) return out;

  // Une requête par paquet de 12 lieux, en parallèle : chaque requête reste
  // bornée (~1 s) et un musée géant ne fait pas exploser un gros lot.
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 12) chunks.push(missing.slice(i, i + 12));
  const maps = await Promise.all(chunks.map((c) => highlightsChunk(c)));
  const merged = new Map<string, PlaceHighlight[]>();
  for (const m of maps) for (const [k, v] of m) merged.set(k, v);

  for (const name of missing) {
    const items = merged.get(name.toLowerCase()) ?? [];
    out[name] = items;
    highlightsCache.set(name.toLowerCase(), {
      at: Date.now(),
      items,
      ttl: items.length ? HL_TTL : HL_TTL_EMPTY,
    });
  }
  return out;
}

/** Une requête groupée pour ≤12 lieux → map { nomLieu(minuscule) → top 6 œuvres }. */
async function highlightsChunk(names: string[]): Promise<Map<string, PlaceHighlight[]>> {
  const result = new Map<string, PlaceHighlight[]>();
  if (names.length === 0) return result;
  // Labels @fr (INDEXÉS → rapide). Littéral sûr : on neutralise guillemets/antislash.
  const vals = names.map((n) => `"${n.replace(/[\\"]/g, " ")}"@fr`).join(" ");
  const sparql =
    `SELECT DISTINCT ?lbl ?artLabel ?img ?sl WHERE {` +
    `VALUES ?lbl { ${vals} }` +
    `?place rdfs:label ?lbl.` +
    // Œuvre rattachée au lieu : emplacement (P276), collection (P195) — y compris
    // une SOUS-collection « partie de » l'institution (P361*, ex. La Joconde dont
    // la collection est le « département des peintures » du Louvre) — OU via une
    // de ses PARTIES (P527 : chefs-d'œuvre en plusieurs versions, ex. Le Cri au
    // musée Munch dont les versions physiques sont à sl 2, invisibles sinon).
    `?art (wdt:P276|wdt:P195/wdt:P361*|wdt:P527/wdt:P276|wdt:P527/wdt:P195/wdt:P361*) ?place.` +
    `?art wdt:P31 ?t. VALUES ?t { ${WD_ART_TYPES.join(" ")} }` +
    `?art wikibase:sitelinks ?sl. FILTER(?sl >= 5)` +
    `OPTIONAL { ?art wdt:P18 ?img. }` +
    `?art rdfs:label ?artLabel. FILTER(lang(?artLabel) = "fr")` +
    `} ORDER BY ?lbl DESC(?sl) LIMIT 400`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  // 15 s : le chemin sous-collection (P361*) sur un musée géant (Louvre) est lourd.
  const data = (await fetchJson(url, 15000)) as {
    results?: {
      bindings?: Array<{
        lbl?: { value?: string };
        artLabel?: { value?: string };
        img?: { value?: string };
      }>;
    };
  } | null;

  const seen = new Map<string, Set<string>>();
  for (const b of data?.results?.bindings ?? []) {
    const lbl = b.lbl?.value?.toLowerCase();
    const artName = b.artLabel?.value?.trim();
    if (!lbl || !artName) continue;
    let items = result.get(lbl);
    if (!items) {
      items = [];
      result.set(lbl, items);
      seen.set(lbl, new Set());
    }
    const dedup = seen.get(lbl)!;
    const ak = artName.toLowerCase();
    if (dedup.has(ak) || items.length >= 6) continue;
    dedup.add(ak);
    items.push({
      name: artName,
      imageUrl: b.img?.value ? b.img.value.replace(/^http:/, "https:") + "?width=320" : undefined,
    });
  }
  return result;
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
      out.push({
        name,
        description: (stripWiki(f["description"] || "") || stripWiki(f["adresse"] || "") || `Lieu réel à découvrir à ${destination}.`).slice(0, 240),
        category: isActivity && generic ? "Loisir" : guess.category,
        duration: isActivity && generic ? "demi-journée" : guess.duration,
        bookingUrl: mapsLink(name, destination),
        provider: "Wikivoyage",
        wikiTitle: stripWiki(f["wikipédia"] || f["wikipedia"] || "") || undefined,
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
        bookingUrl: mapsLink(p.name, destination),
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

const cache = new Map<string, { at: number; places: PlaceActivity[]; ttl: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h (résultat complet)
const CACHE_TTL_DEGRADED = 15 * 60 * 1000; // 15 min si Wikidata a échoué (auto-réparation)

// Entités à BANNIR du résultat final (notoriété trompeuse) : divisions
// administratives (province, métropole, région…) et événements (festival,
// championnat…) — ce ne sont pas des lieux à visiter.
const NOISE_BLOCK =
  /\bprovince\b|ville m[ée]tropolitaine|\bm[ée]tropole\b|communaut[ée]|\bcanton\b|arrondissement|\bd[ée]partement\b|unit[ée] urbaine|aire urbaine|intercommunalit[ée]|dioc[èe]se|g[ée]n[ée]ralit[ée]|universit[ée]|saint-si[èe]ge|ordre souverain|pr[ée]lature|convention|trait[ée] de\b|\baccord\b|conf[ée]rence|protocole|\bpacte\b|\bann[ée]e des\b|\bm[ée]tro\b|organisation|\bagence\b|\bfestival\b|biennale|\bchampionnat|jeux olympiques|\b[ée]lections?\b|\bconcours\b|\battaque\b|attentat|\bop[ée]ration\b|\binvasion\b|\boffensive\b|bombardement|\bbataille\b|massacre|\bgare\b|gare routi[èe]re|a[ée]roport|\bpass\b|\bevjf\b|\bevg\b/i;

/**
 * Clé de dédoublonnage : minuscule, sans accents/ponctuation, sans le suffixe
 * désambiguïsant lié à la destination (« Cathédrale Saint-Pierre d'Annecy » ==
 * « Cathédrale Saint-Pierre », « Le Pâquier (Annecy) » == « Le Pâquier »).
 */
function dedupKey(name: string, dest: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const d = norm(dest);
  let k = norm(name);
  if (d) k = k.replace(new RegExp(`(?:\\s(?:de|d|du|des|la|le|l))?\\s${d}$`), "").trim();
  return k;
}

interface RawWikiResponse {
  query?: {
    pages?: Record<
      string,
      { title?: string; extract?: string; thumbnail?: { source?: string }; langlinks?: unknown[] }
    >;
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
  };
}

/**
 * Enrichit un lot de lieux (≤20) via l'API Wikipédia (FR), en un appel :
 *   - photo libre (Wikimedia Commons) → sert de filtre qualité ;
 *   - intro descriptive (remplace les descriptions fades) ;
 *   - `fame` = nombre de versions linguistiques (langlinks) = notoriété réelle,
 *     pour classer (le Colisée a ~150 langues, une œuvre obscure ~3).
 * `exlimit` plafonne les extraits à 20/req. 1 réessai si throttle/réseau.
 */
async function enrichBatch(batch: PlaceActivity[]): Promise<void> {
  const titles = batch.map((p) => p.wikiTitle || p.name).join("|");
  const url =
    `https://fr.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
    `&prop=extracts|pageimages|langlinks&exintro&explaintext&exsentences=2&exlimit=20&lllimit=500` +
    `&piprop=thumbnail&pithumbsize=800&pilimit=50&titles=${encodeURIComponent(titles)}`;
  let data = (await fetchJson(url, 10000)) as RawWikiResponse | null;
  if (!data?.query?.pages) {
    await new Promise((r) => setTimeout(r, 700)); // petit répit si throttle/réseau
    data = (await fetchJson(url, 10000)) as RawWikiResponse | null;
  }
  const q = data?.query;
  if (!q?.pages) return;
  const imgByTitle: Record<string, string> = {};
  const extByTitle: Record<string, string> = {};
  const fameByTitle: Record<string, number> = {};
  for (const pg of Object.values(q.pages)) {
    const t = (pg.title ?? "").toLowerCase();
    if (!t) continue;
    if (pg.thumbnail?.source) imgByTitle[t] = pg.thumbnail.source;
    if (pg.extract) extByTitle[t] = pg.extract;
    if (pg.langlinks) fameByTitle[t] = pg.langlinks.length;
  }
  // Suit les renvois (titre demandé → titre résolu) pour relier la réponse.
  const alias: Record<string, string> = {};
  for (const n of q.normalized ?? []) alias[n.from.toLowerCase()] = n.to.toLowerCase();
  for (const r of q.redirects ?? []) alias[r.from.toLowerCase()] = r.to.toLowerCase();
  const resolve = (name: string): string => {
    let t = name.toLowerCase();
    for (let h = 0; h < 3 && alias[t]; h++) t = alias[t];
    return t;
  };
  for (const p of batch) {
    const want = (p.wikiTitle || p.name).toLowerCase();
    const t = resolve(p.wikiTitle || p.name);
    const img = imgByTitle[t] || imgByTitle[want];
    if (img && !p.imageUrl) p.imageUrl = img;
    const fame = fameByTitle[t] ?? fameByTitle[want];
    if (fame != null) p.fame = Math.max(p.fame ?? 0, fame);
    const ext = extByTitle[t] || extByTitle[want];
    // Ne remplace que les descriptions fades (défaut générique), garde le curated.
    if (ext && (!p.description || /^Lieu réel à/.test(p.description))) {
      p.description = ext.slice(0, 240);
    }
  }
}

/** Enrichit tous les lieux par lots de 20, EN PARALLÈLE (latence = 1 lot). */
async function enrichWikiMedia(places: PlaceActivity[]): Promise<void> {
  const batches: PlaceActivity[][] = [];
  for (let i = 0; i < places.length; i += 20) batches.push(places.slice(i, i + 20));
  await Promise.all(batches.map((b) => enrichBatch(b).catch(() => undefined)));
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
    if (hit && Date.now() - hit.at < hit.ttl) return hit.places;

    const geo = await geocode(destination);
    if (!geo) return [];

    // Toutes les sources en parallèle. Wikidata (notoriété) gère les mégapoles ;
    // Foursquare (à clé) renvoie [] si non configurée → aucun impact.
    const [wd, fs, wv, ov, wk] = await Promise.all([
      discoverWikidata(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverFoursquare(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverWikivoyage(destination).catch(() => [] as PlaceActivity[]),
      discoverOverpass(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
      discoverWikipedia(geo.lat, geo.lon, destination).catch(() => [] as PlaceActivity[]),
    ]);

    // Wikipédia (recherche de proximité) ramène des INSTITUTIONS (ministères,
    // journaux, banques…) qui esquivent le filtre « lieu » de Wikidata. On ne
    // l'utilise donc qu'en SECOURS, quand Wikidata est pauvre (petites villes).
    const wikipediaFallback = wd.length >= 20 ? [] : wk;

    // Fusion + dédoublonnage (nom normalisé). On rassemble large, on curera après.
    const seen = new Set<string>();
    const merged: PlaceActivity[] = [];
    for (const p of [...wd, ...fs, ...wv, ...ov, ...wikipediaFallback]) {
      if (!p.name || NOISE_BLOCK.test(p.name)) continue;
      const k = dedupKey(p.name, destination);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      merged.push(p);
      if (merged.length >= 70) break;
    }

    // Enrichit avec photos + intros libres (Wikimedia). La photo devient le signal
    // de qualité : un lieu iconique en a une, le remplissage fade non.
    await enrichWikiMedia(merged);

    // CURATION « peps ou rien » : admis si une VRAIE photo OU une vraie notoriété
    // (présent dans ≥8 Wikipédia). Le reste = remplissage fade, écarté.
    const admissible = (p: PlaceActivity) => !!p.imageUrl || (p.fame ?? 0) >= 8;

    // Classement par NOTORIÉTÉ PURE (nombre de versions Wikipédia) : le lieu connu
    // passe devant l'inconnu, un point c'est tout. AUCUN autre facteur dans le rang.
    const ranked = merged.filter(admissible).sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0));

    // Si on a assez de lieux AVEC photo, on ne garde QUE ceux-là (peps visuel,
    // zéro carte fade). Sinon on complète avec les moins illustrés mais notables.
    const withPhoto = ranked.filter((p) => p.imageUrl);
    const pool = withPhoto.length >= 5 ? withPhoto : ranked;

    // Liste PROFONDE classée du plus pertinent au moins pertinent (notoriété),
    // pour alimenter la pagination « Voir d'autres idées ». Plafond généreux par
    // catégorie (pas d'affamage des villes mono-thème) et total raisonnable.
    const perCat: Record<string, number> = {};
    const curated: PlaceActivity[] = [];
    for (const p of pool) {
      perCat[p.category] = (perCat[p.category] ?? 0) + 1;
      if (perCat[p.category] > 20) continue; // plafond souple : laisse les villes mono-thème aller en profondeur
      curated.push(p);
      if (curated.length >= 50) break;
    }

    // Si Wikidata n'a rien donné (échec/throttle), le classement par notoriété est
    // dégradé → cache court (15 min) pour réessayer bientôt, au lieu de figer 6 h.
    if (curated.length > 0) {
      const ttl = wd.length > 0 ? CACHE_TTL : CACHE_TTL_DEGRADED;
      cache.set(key, { at: Date.now(), places: curated, ttl });
    }
    return curated;
  } catch {
    return [];
  }
}

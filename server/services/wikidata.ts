/**
 * Source PRINCIPALE des suggestions : Wikidata SPARQL (notoriété MONDIALE). Dans
 * les villes denses, la proximité (OSM/Wikipédia) rate les icônes un peu éloignées
 * du centre (Tour Eiffel, Louvre…) ; Wikidata classe par notoriété (sitelinks) et
 * fait remonter les incontournables. Pipeline : `wikidataAround` (candidats par
 * notoriété) → filtre « lieu » (allow-list) → purge secondaire (rivières, communes,
 * œuvres exposées/perdues) → rétrogradation (transit, stades locaux, sommets en
 * excès) → re-classement par VRAIES vues Wikipédia (cf. ranking). 100 % réel.
 */
import { fetchJson } from "./http";
import { mapsLink, type PlaceActivity } from "./core";
import { classifyTitle } from "./classify";
import { fetchPopularity } from "./ranking";

// Types Wikidata NON visitables (notoriété trompeuse) : villes, pays, langues,
// organisations, personnes, événements, régions/périodes, universités.
const WD_BAD_TYPES = new Set([
  "Q515",
  "Q1549591",
  "Q5119",
  "Q484170",
  "Q3957",
  "Q532",
  "Q15284",
  "Q702842",
  "Q6256",
  "Q3624078",
  "Q7275",
  "Q3024240",
  "Q34770",
  "Q43229",
  "Q193483",
  "Q327333",
  "Q163740",
  "Q4830453",
  "Q161726",
  "Q5",
  "Q1656682",
  "Q1190554",
  "Q13418847",
  "Q178561",
  "Q198",
  "Q2223653",
  "Q3199915",
  "Q56061",
  "Q10864048",
  "Q82794",
  "Q34876",
  "Q1799794",
  "Q15916867",
  "Q11514315",
  "Q11772",
  "Q3918",
  "Q38723",
  "Q41710",
  // Régions, universités historiques, entités/ordres/traités de droit international.
  "Q36784",
  "Q3551775",
  "Q4671277",
  "Q15893266",
  "Q391009",
  "Q474717",
  "Q1896989",
  "Q2311325",
  "Q1063239",
  "Q1147274",
  "Q1414472",
  "Q16567729",
  // Entreprises/sociétés (le siège est un bâtiment, mais ça ne se « visite » pas).
  "Q891723",
  "Q6881511",
  "Q783794",
  "Q4830453",
  // Grandes surfaces (Carrefour…) : chaîne de magasins / chaîne de supermarchés.
  // On NE bannit PAS « grand magasin » (Q216107) → Galeries Lafayette, Printemps,
  // La Samaritaine (iconiques) restent.
  "Q507619",
  "Q18043413",
  // Défense en profondeur : non-lieux qui fuiteraient si le filtre « lieu »
  // échouait — page d'homonymie (Q4167410) et groupe de peintures (Q18573970,
  // ex. Le Cri). Filtrés en JS d'office, sans dépendre de la requête SPARQL.
  "Q4167410",
  "Q18573970",
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
  "wd:Q8502",
  "wd:Q54050",
  "wd:Q271669", // montagne, colline, relief
  "wd:Q23397",
  "wd:Q15324",
  "wd:Q23442", // lac, plan d'eau, île
  "wd:Q22698",
  "wd:Q4421", // parc, forêt
  "wd:Q83620",
  "wd:Q174782", // voie (avenue/rue), place publique
  "wd:Q123705",
  "wd:Q3257686", // quartier, localité
  "wd:Q39614", // cimetière
  // Musée (Q33506) : BEAUCOUP de musées sont typés « institution » SANS type
  // bâtiment → ils échouaient le filtre et n'arrivaient que via Wikivoyage (sans
  // vues, donc relégués sous des stades locaux). Ex. à Oslo : musée du Fram,
  // Kon-Tiki, navires vikings, Folkemuseum. Un musée est TOUJOURS visitable.
  "wd:Q33506", // musée
];

type WdItemResp = {
  results?: { bindings?: Array<{ item?: { value?: string } }> };
};

/** Lance une requête SPARQL « liste de Q-ids » avec 1 réessai. `null` si échec réel. */
async function sparqlItemSet(
  sparql: string,
  ms: number,
): Promise<Set<string> | null> {
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
async function wikidataPlaceFilter(
  qids: string[],
): Promise<Set<string> | null> {
  if (qids.length === 0) return new Set();
  // Découpe en lots de 100 : une requête P279* sur 100 items est bien plus rapide
  // (et bien moins sujette au timeout) que sur 220. Lots en PARALLÈLE → même temps
  // mural, mais chacun fiable. Si UN lot échoue franchement → échec global (null).
  const chunks: string[][] = [];
  for (let i = 0; i < qids.length; i += 100)
    chunks.push(qids.slice(i, i + 100));
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
 * communes SÉPARÉES (zone habitée Q486972 qui n'est PAS un quartier
 * Q123705/Q2983893 → vire Courmayeur, garde Montmartre/Trastevere), œuvres d'art
 * exposées DANS un édifice (La Pietà…) et œuvres d'art DISPARUES (Athéna Parthénos
 * & autres colosses antiques détruits). Léger (sur ~50 survivants) ; DEUX requêtes
 * EN PARALLÈLE (lourde + « œuvre perdue » isolée), chacune fail-safe : l'échec de
 * l'une ne purge rien pour sa part, les vues classant de toute façon ces parasites bas.
 */
async function wikidataPurge(qids: string[]): Promise<Set<string>> {
  if (qids.length === 0) return new Set();
  const values = qids.map((q) => `wd:${q}`).join(" ");
  // Purge LOURDE : rivières (Q355304), chaînes/massifs (Q46831), CENTRALES électriques
  // (Q159719, dont les centrales NUCLÉAIRES Tricastin/Cruas — un site industriel, pas
  // une visite ; les BARRAGES Q12323 ne sont PAS des centrales → conservés), communes
  // SÉPARÉES (Q486972 hors quartier Q123705/Q2983893), et œuvre d'art exposée DANS un
  // édifice (basilique, musée, église, palais — P276 → bâtiment) = un OBJET, pas un
  // « lieu » à part (ex. La Pietà, David ; déjà listée dans « Œuvres à voir » du lieu).
  // On GARDE les statues en EXTÉRIEUR (Manneken-Pis, Statue de la Liberté), dont le
  // lieu n'est pas un édifice clos. Requête à plusieurs branches → la plus coûteuse.
  const heavy =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } { ` +
    `?item wdt:P31/wdt:P279* ?b. VALUES ?b { wd:Q355304 wd:Q46831 wd:Q159719 } ` +
    `} UNION { ` +
    `?item wdt:P31/wdt:P279* wd:Q486972. ` +
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* ?q. VALUES ?q { wd:Q123705 wd:Q2983893 } } ` +
    `} UNION { ` +
    `?item wdt:P31 ?at. VALUES ?at { wd:Q860861 wd:Q3305213 wd:Q179700 wd:Q22669139 wd:Q838948 wd:Q4502142 } ` +
    `?item wdt:P276 ?loc. ?loc wdt:P31/wdt:P279* ?bt. ` +
    `VALUES ?bt { wd:Q33506 wd:Q1370598 wd:Q16970 wd:Q41176 wd:Q16560 } } }`;
  // Purge LÉGÈRE et ISOLÉE : œuvre d'art DISPARUE/détruite (P31/P279* → « œuvre
  // d'art perdue » Q4140840). L'original n'existe PLUS → pas un lieu visitable, même
  // s'il reste géotaggé à son ancien emplacement. Ex. Athéna Parthénos / Athéna
  // Promachos / Athéna Lemnia (colosses de Phidias détruits dans l'Antiquité,
  // géotaggés sur l'Acropole, sitelinks ≥17 → bien classés, donc nuisibles en liste).
  // Même classe que La Pietà/Le Cri, MAIS sans P276→édifice exploitable par la purge
  // lourde (leur emplacement P276 est le Parthénon, un TEMPLE hors allow-list) — d'où
  // cette purge dédiée. Requête à PART (un seul P31/P279* → réponse <1 s) lancée EN
  // PARALLÈLE : elle aboutit MÊME quand la requête lourde expire (Wikidata sous
  // charge), donc cette purge ciblée n'est jamais l'otage de la latence des autres
  // branches. On NE touche PAS aux statues EXISTANTES (Liberté, Manneken-Pis) ni aux
  // sites archéologiques (Agora, Aréopage) : aucun n'est une « œuvre perdue » (vérifié).
  const lost =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
    `?item wdt:P31/wdt:P279* wd:Q4140840. }`;
  // Les deux EN PARALLÈLE, chacune fail-safe (null → ignorée) : on ne purge jamais à
  // tort, et l'échec de l'une n'empêche pas l'autre de filtrer. On réunit les deux.
  const [heavyDrop, lostDrop] = await Promise.all([
    sparqlItemSet(heavy, 10000),
    sparqlItemSet(lost, 8000),
  ]);
  const drop = new Set<string>();
  for (const id of heavyDrop ?? []) drop.add(id);
  for (const id of lostDrop ?? []) drop.add(id);
  return drop;
}

/**
 * Plancher de vues FR (3 ans) pour qu'un stade reste affiché. On ne garde QUE le
 * stade le PLUS consulté de la ville (l'iconique) ET seulement s'il dépasse ce
 * plancher ; tous les autres stades (2ᵉ rang local) sont rétrogradés. Un SEUIL
 * ABSOLU ne marche PAS : Lluís-Companys (307k, 2ᵉ de Barcelone, à virer) dépasse
 * Old Trafford (122k) et Anfield (127k) — stades-villes mythiques à garder. D'où
 * la règle « top de la ville + plancher ». 100k garde Old Trafford/Anfield et vire
 * les stades locaux (Ullevaal 15k, Karaïskákis 34k, Bislett 4k).
 */
const STADIUM_VIEWS_MIN = 100_000;

/**
 * Nombre de SOMMETS gardés par ville (les plus consultés) ; au-delà, rétrogradés.
 * Une ville de montagne (Chamonix) est sinon noyée sous 30+ pics notables pour les
 * alpinistes mais pas touristiques (Les Drus, dent du Géant, pointe Baretti…), qui
 * enterrent les VRAIES activités (Mer de Glace, train du Montenvers). On garde les
 * 5 plus connus (Mont Blanc, aiguille du Midi, Grandes Jorasses…).
 */
const SUMMIT_KEEP = 5;

/**
 * Classe les lieux À RÉTROGRADER (palier du bas, JAMAIS supprimés) par une règle
 * GÉNÉRALE et MONDIALE (zéro exception nominative), langue-agnostique :
 *  - `transit` : transport UTILITAIRE (gare/métro/gare routière/aéroport) non
 *    touristique — toujours rétrogradé. Épargné si marqué « site touristique »
 *    (Q570116) en P31 DIRECT (gare-monument type Grand Central).
 *  - `sports` : enceinte SPORTIVE (stade/arène) non touristique — rétrogradée
 *    SEULEMENT si peu de vues (< STADIUM_VIEWS_MIN, testé en aval), pour virer les
 *    stades locaux « au pif » tout en GARDANT les mondiaux (Camp Nou…). Épargnée
 *    si « site touristique » (stade panathénaïque antique).
 * On teste le tourisme en P31 DIRECT (pas P279*) : la hiérarchie des sous-classes
 * relie à tort certaines gares à « site touristique » (ex. « gare en cul-de-sac »).
 * Fail-safe : en cas d'échec réseau, ensembles vides → on ne rétrograde rien.
 */
async function wikidataClassifyDemote(qids: string[]): Promise<{
  transit: Set<string>;
  sports: Set<string>;
  summits: Set<string>;
}> {
  const out = {
    transit: new Set<string>(),
    sports: new Set<string>(),
    summits: new Set<string>(),
  };
  if (qids.length === 0) return out;
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql =
    `SELECT DISTINCT ?item ?kind WHERE { VALUES ?item { ${values} } { ` +
    `?item wdt:P31/wdt:P279* ?tt. VALUES ?tt { wd:Q55488 wd:Q928830 wd:Q494829 wd:Q1248784 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } BIND("t" AS ?kind) ` +
    `} UNION { ` +
    `?item wdt:P31/wdt:P279* ?sv. VALUES ?sv { wd:Q483110 wd:Q1076486 wd:Q641226 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } BIND("s" AS ?kind) ` +
    `} UNION { ` +
    // SOMMETS (montagne Q8502 / sommet Q207326) : une ville de montagne (Chamonix)
    // est noyée sous des dizaines de pics notables pour les alpinistes mais sans
    // intérêt touristique. On ne garde que les plus connus (cf. SUMMIT_KEEP). Les
    // GLACIERS (Mer de Glace, Q35666) ne sont PAS des sommets → jamais touchés.
    `?item wdt:P31/wdt:P279* ?mt. VALUES ?mt { wd:Q8502 wd:Q207326 } BIND("m" AS ?kind) } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  let data = (await fetchJson(url, 9000)) as {
    results?: {
      bindings?: Array<{
        item?: { value?: string };
        kind?: { value?: string };
      }>;
    };
  } | null;
  if (!data) {
    await new Promise((r) => setTimeout(r, 300));
    data = (await fetchJson(url, 9000)) as typeof data;
  }
  if (!data) return out; // fail-safe : on ne rétrograde rien
  for (const b of data.results?.bindings ?? []) {
    const qid = b.item?.value?.split("/").pop();
    if (!qid) continue;
    if (b.kind?.value === "t") out.transit.add(qid);
    else if (b.kind?.value === "s") out.sports.add(qid);
    else if (b.kind?.value === "m") out.summits.add(qid);
  }
  return out;
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
      a = {
        label,
        sitelinks: Number(b.sitelinks?.value) || 0,
        types: new Set(),
      };
      byId.set(id, a);
    }
    const ty = b.type?.value?.split("/").pop();
    if (ty) a.types.add(ty);
    if (!a.image && b.image?.value) a.image = b.image.value;
  }
  return byId;
}

export async function discoverWikidata(
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
    .filter(
      ([, a]) =>
        ![...a.types].some((t) => WD_BAD_TYPES.has(t)) &&
        a.label.toLowerCase() !== destLow,
    )
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
  // PURGE secondaire (rivières/chaînes/communes séparées) + classement des lieux À
  // RÉTROGRADER (gares-transit + enceintes sportives) — les DEUX en parallèle sur ce
  // petit lot (~50), chacune fail-safe (échec → on ne touche à rien, les vues classent).
  // Rien n'est SUPPRIMÉ (jamais de perte d'une gare-monument ou d'un stade) : juste
  // relégué tout en bas (cf. tri). Les stades ne sont rétrogradés qu'en aval, si leurs
  // vues sont sous le seuil « mondial » (cf. STADIUM_VIEWS_MIN).
  const [drop, demote] = await Promise.all([
    wikidataPurge(survivors.map(([id]) => id)),
    wikidataClassifyDemote(survivors.map(([id]) => id)),
  ]);

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
      imageUrl: a.image
        ? a.image.replace(/^http:/, "https:") + "?width=800"
        : undefined,
      demote: demote.transit.has(id) || undefined, // transit : rétrogradé d'office
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
    if (views && views > 0) {
      p.fame = views; // pour l'admissibilité (≥8) et l'affichage
      p.views = views; // signal de 1er rang, distinct de fame (cf. tri final)
    }
  });
  // STADES : on ne garde QUE le PLUS consulté de la ville (l'iconique), et seulement
  // s'il dépasse le plancher de notoriété ; tous les autres stades (2ᵉ rang local)
  // sont rétrogradés. Ainsi Camp Nou (top Barcelone) reste mais Lluís-Companys (2ᵉ)
  // part ; Wembley (top Londres) reste mais l'Emirates (2ᵉ) part ; à Athènes le top
  // moderne (Karaïskákis 34k) tombe sous le plancher → tous partent (sauf le
  // panathénaïque, marqué « site touristique », jamais dans demote.sports). Un stade
  // marqué « site touristique » n'est PAS dans demote.sports → gardé d'office.
  const sportIdx = outIds
    .map((id, i) => i)
    .filter((i) => demote.sports.has(outIds[i]));
  let topI = -1;
  for (const i of sportIdx) {
    if (topI < 0 || (out[i].views ?? 0) > (out[topI].views ?? 0)) topI = i;
  }
  for (const i of sportIdx) {
    const keep = i === topI && (out[i].views ?? 0) >= STADIUM_VIEWS_MIN;
    if (!keep) out[i].demote = true;
  }
  // SOMMETS : on garde les SUMMIT_KEEP plus consultés de la ville (Mont Blanc,
  // aiguille du Midi…), on relègue le reste (Les Drus, pointe Baretti…) → les
  // activités (Mer de Glace, train du Montenvers) cessent d'être noyées. Les
  // GLACIERS ne sont pas des sommets → jamais dans demote.summits → intacts.
  const summitIdx = outIds
    .map((id, i) => i)
    .filter((i) => demote.summits.has(outIds[i]))
    .sort((a, b) => (out[b].views ?? 0) - (out[a].views ?? 0));
  summitIdx.slice(SUMMIT_KEEP).forEach((i) => {
    out[i].demote = true;
  });
  // Tri local par vues/fame. NB : l'ordre DÉFINITIF est posé au tri final de
  // doFetchPlaceActivities (qui fusionne toutes les sources et fait le palier
  // « vues d'abord »). Ce tri-ci ne sert qu'à un éventuel usage direct.
  out.sort((a, b) => (b.views ?? b.fame ?? 0) - (a.views ?? a.fame ?? 0));
  return out;
}

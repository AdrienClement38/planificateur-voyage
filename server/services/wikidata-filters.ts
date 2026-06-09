/**
 * Curation des candidats Wikidata : à partir d'une liste de Q-ids déjà récupérés
 * par notoriété (`wikidataAround`), décide CE QU'ON GARDE et CE QU'ON RÉTROGRADE.
 * Trois filtres SPARQL, chacun fail-safe (échec réseau → on ne filtre rien plutôt
 * que de tout jeter) :
 *  - `wikidataPlaceFilter` : ne garde que les vrais LIEUX (allow-list de super-types).
 *  - `wikidataPurge` : écarte rivières, communes séparées, œuvres exposées/perdues…
 *  - `wikidataClassifyDemote` : repère transit/stades/sommets à reléguer en bas.
 * Séparé de la découverte (`wikidata.ts`) car c'est une responsabilité autonome.
 */
import { fetchJson } from "./http";

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

/**
 * Filtre CRITIQUE : sous-ensemble des Q-ids qui SONT des lieux (sous-classe d'un
 * super-type « lieu »). Léger (allow-list seule) pour rester fiable. Renvoie
 * `null` en cas d'ÉCHEC réseau (≠ Set vide = « aucun lieu ») afin que l'appelant
 * échoue SÛR (Wikidata vide) au lieu de laisser tout passer (fail-open).
 */
export async function wikidataPlaceFilter(
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
export async function wikidataPurge(qids: string[]): Promise<Set<string>> {
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
export async function wikidataClassifyDemote(qids: string[]): Promise<{
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

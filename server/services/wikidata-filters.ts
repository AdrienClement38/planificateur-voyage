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
 * super-type « lieu »). Léger (allow-list seule) pour rester fiable. Robustesse PAR LOT :
 * un lot qui échoue (throttle) garde SES candidats tels quels (on ne perd aucun vrai lieu,
 * et la fuite éventuelle de non-lieux — événements, institutions — est LIMITÉE à ce lot).
 * Ne renvoie `null` (→ l'appelant garde tout) que si TOUS les lots échouent (réseau mort).
 */
export async function wikidataPlaceFilter(
  qids: string[],
): Promise<Set<string> | null> {
  if (qids.length === 0) return new Set();
  // Découpe en lots de 100 : une requête P279* sur 100 items est bien plus rapide (et
  // bien moins sujette au timeout) que sur 400. Lots en PARALLÈLE → même temps mural.
  const chunks: string[][] = [];
  for (let i = 0; i < qids.length; i += 100)
    chunks.push(qids.slice(i, i + 100));
  const keep = new Set<string>();
  let anySuccess = false;
  await Promise.all(
    chunks.map(async (c) => {
      const values = c.map((q) => `wd:${q}`).join(" ");
      const sparql =
        `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
        `?item wdt:P31/wdt:P279* ?s. VALUES ?s { ${WD_PLACE_TYPES.join(" ")} } }`;
      const r = await sparqlItemSet(sparql, 12000);
      if (r === null) {
        // Lot échoué : on GARDE ses candidats (impossible de vérifier, mais on ne perd
        // pas de vrai lieu). AVANT, un seul lot en échec désactivait le filtre pour TOUT
        // → des non-lieux (émeute « Journée des Tuiles », académie…) remontaient en masse.
        for (const id of c) keep.add(id);
      } else {
        anySuccess = true;
        for (const id of r) keep.add(id);
      }
    }),
  );
  return anySuccess ? keep : null;
}

/**
 * Purge SECONDAIRE (non critique) : parmi des Q-ids déjà confirmés « lieux »,
 * renvoie ceux à ÉCARTER — cours d'eau/estuaires/détroits, chaînes/massifs, centrales,
 * communes SÉPARÉES (zone habitée Q486972 qui n'est PAS un quartier Q123705/Q2983893
 * → vire Jersey City/Courmayeur, garde Greenwich Village/Trastevere), COMTÉS/
 * arrondissements (Q28575 → vire Manhattan/Bronx, que l'exception « quartier » sauvait
 * à tort), œuvres exposées DANS un édifice (La Pietà…) et œuvres DISPARUES (Athéna
 * Parthénos…). Léger (sur ~50 survivants) ; QUATRE requêtes EN PARALLÈLE par famille,
 * chacune fail-safe et ISOLÉE : une branche lente (œuvre-dans-édifice) qui expire ne
 * fait PLUS tomber les autres (sinon rivières/communes/arrondissements repassaient en
 * bloc) ; les vues classent de toute façon ces parasites bas.
 */
export async function wikidataPurge(qids: string[]): Promise<Set<string>> {
  if (qids.length === 0) return new Set();
  const values = qids.map((q) => `wd:${q}`).join(" ");
  // (1) INFRASTRUCTURES LINÉAIRES, reliefs & sites industriels — non visitables : cours
  // d'eau (Q355304), ESTUAIRE (Q47053) & DÉTROIT (Q37901) — l'East River est un estuaire,
  // PAS une rivière —, chaîne/massif (Q46831), centrale électrique (Q159719, dont les
  // NUCLÉAIRES Tricastin/Cruas ; les BARRAGES Q12323 ne sont PAS des centrales → gardés),
  // et LIGNE FERROVIAIRE (Q728937, dont les LGV) : une ligne de centaines de km n'est pas
  // une sortie — la GARE, elle, reste gérée à part par le demote « transit ».
  const waterLand =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
    `?item wdt:P31/wdt:P279* ?b. VALUES ?b { wd:Q355304 wd:Q47053 wd:Q37901 wd:Q46831 wd:Q159719 wd:Q728937 } }`;
  // (2) ZONES ADMINISTRATIVES trop larges : commune SÉPARÉE (Q486972 hors quartier
  // Q123705/Q2983893 → vire Jersey City/Hoboken, garde Greenwich Village/Montmartre) ET
  // COMTÉ (Q28575), qui capte les arrondissements « consolidated city-county » (Manhattan,
  // Bronx, Queens, Staten Island) que l'exception « quartier » sauvait à tort ; un quartier
  // pur n'est PAS un comté → conservé. Exception « attraction » (Q570116) par sécurité.
  const adminArea =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } { ` +
    `?item wdt:P31/wdt:P279* wd:Q486972. ` +
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* ?q. VALUES ?q { wd:Q123705 wd:Q2983893 } } ` +
    `} UNION { ` +
    `?item wdt:P31/wdt:P279* wd:Q28575. ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } } }`;
  // (3) ŒUVRE D'ART exposée DANS un édifice (P276 → musée/basilique/église/palais) = un
  // OBJET, pas un « lieu » à part (La Pietà, David ; déjà dans « Œuvres à voir » du lieu).
  // On GARDE les statues en EXTÉRIEUR (Manneken-Pis, Liberté), dont le lieu n'est pas clos.
  const artInBuilding =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
    `?item wdt:P31 ?at. VALUES ?at { wd:Q860861 wd:Q3305213 wd:Q179700 wd:Q22669139 wd:Q838948 wd:Q4502142 } ` +
    `?item wdt:P276 ?loc. ?loc wdt:P31/wdt:P279* ?bt. ` +
    `VALUES ?bt { wd:Q33506 wd:Q1370598 wd:Q16970 wd:Q41176 wd:Q16560 } }`;
  // Purge LÉGÈRE et ISOLÉE : œuvre d'art DISPARUE/détruite (P31/P279* → « œuvre
  // d'art perdue » Q4140840). L'original n'existe PLUS → pas un lieu visitable, même
  // s'il reste géotaggé à son ancien emplacement. Ex. Athéna Parthénos / Athéna
  // Promachos / Athéna Lemnia (colosses de Phidias détruits dans l'Antiquité,
  // géotaggés sur l'Acropole, sitelinks ≥17 → bien classés, donc nuisibles en liste).
  // Même classe que La Pietà/Le Cri, MAIS sans P276→édifice exploitable par la branche
  // « œuvre-dans-édifice » (leur P276 est le Parthénon, un TEMPLE hors allow-list) —
  // d'où cette purge dédiée. Requête à PART (un seul P31/P279* → réponse <1 s) lancée EN
  // PARALLÈLE : elle aboutit MÊME quand les autres branches saturent (Wikidata sous
  // charge), donc cette purge ciblée n'est jamais l'otage de la latence des autres
  // branches. On NE touche PAS aux statues EXISTANTES (Liberté, Manneken-Pis) ni aux
  // sites archéologiques (Agora, Aréopage) : aucun n'est une « œuvre perdue » (vérifié).
  const lost =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
    `?item wdt:P31/wdt:P279* wd:Q4140840. }`;
  // (5) STRUCTURE DÉMOLIE / DISPARUE : possède une date de démolition/dissolution
  // (P576) → n'existe PLUS, donc pas une visite (ex. Singer Building, démoli en 1968 ;
  // ancienne Penn Station). Ces lieux remontaient via leurs vues HISTORIQUES une fois le
  // vivier élargi. Exception « site touristique » (Q570116) : une ruine mémorialisée
  // (qqch encore visitable) reste. Une seule branche P576 → réponse <1 s.
  const demolished =
    `SELECT DISTINCT ?item WHERE { VALUES ?item { ${values} } ` +
    `?item wdt:P576 ?dem. FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } }`;
  // Les CINQ EN PARALLÈLE, chacune fail-safe (null → ignorée) : on ne purge jamais à
  // tort, et l'échec/expiration d'UNE branche n'empêche pas les autres de filtrer (clé
  // de la robustesse : avant, une seule requête UNION expirait en bloc). On réunit tout.
  const parts = await Promise.all([
    sparqlItemSet(waterLand, 8000),
    sparqlItemSet(adminArea, 9000),
    sparqlItemSet(artInBuilding, 10000),
    sparqlItemSet(lost, 8000),
    sparqlItemSet(demolished, 8000),
  ]);
  const drop = new Set<string>();
  for (const part of parts) for (const id of part ?? []) drop.add(id);
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
 *    si « site touristique » (stade panathénaïque antique) ou TREMPLIN de saut à ski
 *    (Q1109069 : Holmenkollen = belvédère/musée, pas une enceinte de compétition).
 *  - `summits` : sommets en EXCÈS (au-delà de SUMMIT_KEEP, testé en aval).
 *  - `hoods` : QUARTIER résidentiel (Q123705/Q2983893) — rétrogradé pour ne pas
 *    INONDER la liste de zones (Upper West Side, SoHo, TriBeCa…) au détriment des
 *    SITES précis. Épargné si « site touristique » (Q570116 : Times Square) ou plage
 *    (Q40080 : Coney Island) → ces lieux-destinations restent en haut.
 *  - `infra` : INFRA/INDUSTRIEL non-touristique (digue anti-inondation Q24853940 : MOSE ;
 *    institut de recherche Q31855 : labo type IRAM) — jamais une sortie. Épargné si « site
 *    touristique » ou musée (un institut qui se visite reste). NB : le port de COMMERCE
 *    n'est PAS visé (même type Q15310171 que le Vieux-Port touristique → pas de signal).
 * On teste le tourisme en P31 DIRECT (pas P279*) : la hiérarchie des sous-classes
 * relie à tort certaines gares à « site touristique » (ex. « gare en cul-de-sac »).
 * Fail-safe : en cas d'échec réseau, ensembles vides → on ne rétrograde rien.
 */
export async function wikidataClassifyDemote(qids: string[]): Promise<{
  transit: Set<string>;
  sports: Set<string>;
  summits: Set<string>;
  hoods: Set<string>;
  infra: Set<string>;
}> {
  const out = {
    transit: new Set<string>(),
    sports: new Set<string>(),
    summits: new Set<string>(),
    hoods: new Set<string>(),
    infra: new Set<string>(),
  };
  if (qids.length === 0) return out;
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const sparql =
    `SELECT DISTINCT ?item ?kind WHERE { VALUES ?item { ${values} } { ` +
    `?item wdt:P31/wdt:P279* ?tt. VALUES ?tt { wd:Q55488 wd:Q928830 wd:Q494829 wd:Q1248784 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } BIND("t" AS ?kind) ` +
    `} UNION { ` +
    `?item wdt:P31/wdt:P279* ?sv. VALUES ?sv { wd:Q483110 wd:Q1076486 wd:Q641226 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } ` +
    // TREMPLIN de saut à ski (Q1109069) EXEMPTÉ : par type c'est une « winter sports venue »
    // → enceinte sportive, mais en vrai c'est un BELVÉDÈRE touristique (Holmenkollen : tour
    // + musée du ski + tyrolienne), pas un stade de compétition. Sans ça il tombait hors
    // page 1 d'Oslo. Les tremplins obscurs ont peu de vues → ne remontent pas pour autant.
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q1109069 } ` +
    `BIND("s" AS ?kind) ` +
    `} UNION { ` +
    // SOMMETS (montagne Q8502 / sommet Q207326) : une ville de montagne (Chamonix)
    // est noyée sous des dizaines de pics notables pour les alpinistes mais sans
    // intérêt touristique. On ne garde que les plus connus (cf. SUMMIT_KEEP). Les
    // GLACIERS (Mer de Glace, Q35666) ne sont PAS des sommets → jamais touchés.
    `?item wdt:P31/wdt:P279* ?mt. VALUES ?mt { wd:Q8502 wd:Q207326 } BIND("m" AS ?kind) ` +
    `} UNION { ` +
    // QUARTIERS résidentiels (Q123705/Q2983893) : rétrogradés pour ne pas inonder la
    // liste de zones (Upper West Side, SoHo, TriBeCa…) au détriment des SITES précis.
    // Épargnés si « site touristique » DIRECT (Q570116 : Times Square) ou plage (Q40080 :
    // Coney Island) → ces lieux-destinations restent en haut. Jamais supprimés, juste bas.
    `?item wdt:P31/wdt:P279* ?nb. VALUES ?nb { wd:Q123705 wd:Q2983893 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q40080 } ` +
    `BIND("n" AS ?kind) ` +
    `} UNION { ` +
    // INFRA/INDUSTRIEL non-touristique : digue anti-inondation (Q24853940 : MOSE) et
    // institut de recherche (Q31855 : labo type IRAM-Grenoble). Jamais une « sortie ».
    // Épargné si « site touristique » (Q570116) ou musée (Q33506) → un institut qui se
    // VISITE reste. ⚠ on NE vise PAS « port maritime » (Q15310171) : le Vieux-Port de
    // Marseille a le même type que le port de commerce → pas de signal propre, on laisse.
    `?item wdt:P31/wdt:P279* ?in. VALUES ?in { wd:Q24853940 wd:Q31855 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31 wd:Q570116 } ` +
    `FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q33506 } ` +
    `BIND("i" AS ?kind) } }`;
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
    else if (b.kind?.value === "n") out.hoods.add(qid);
    else if (b.kind?.value === "i") out.infra.add(qid);
  }
  return out;
}

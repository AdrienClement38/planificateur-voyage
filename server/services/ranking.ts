/**
 * Notoriété TOURISTIQUE : vraies vues Wikipédia (≠ nombre de langues). C'est le
 * signal de classement de PREMIER RANG des suggestions — on mesure ce que les
 * gens CONSULTENT vraiment, sur 3 ans (lissage des pics d'actu/sport). Popularité
 * GLOBALE = vues **FR + EN** : un Français à l'étranger doit voir les lieux
 * mondialement iconiques (mémorial du 11-Septembre, musées/gratte-ciels mal lus en
 * FR). Garde-fou anti-foot : les vues **FR PURES** sont renvoyées À PART pour que la
 * décision « garder ce stade ? » se tranche sur le FR (intérêt touristique), pas sur
 * l'EN gonflé par le foot mondial. 100 % données réelles ; un échec de récup vaut
 * `undefined` (≠ « 0 vue ») pour ne jamais déclasser à tort.
 */
import { fetchJson } from "./http";
import { capMap } from "./cache";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { wikidataPlaceFilter } from "./wikidata-filters";

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
const PV_CACHE_MAX = 20000; // toit d'entrées (cache persistant : on en garde beaucoup plus)

// PERSISTANCE du cache de vues sur DISQUE (JSON), pour qu'il SURVIVE aux redémarrages :
// le gros vivier reste alors RAPIDE en permanence (les vues bougent lentement → re-mesure
// tous les 14 j). Fichier HORS de data/dev (≠ PGlite) → aucun risque pour la base. Non
// critique : fichier illisible → on repart d'un cache vide (on re-mesure simplement).
const PV_CACHE_PATH =
  process.env.PGLITE_DIR || process.env.DATABASE_URL
    ? null // tests / prod (Postgres gère son cache) : pas de fichier local
    : "./data/.cache/pv.json";
let pvLoaded = false;
let pvDirty = 0;

function loadPvCache(): void {
  if (pvLoaded) return;
  pvLoaded = true;
  if (!PV_CACHE_PATH || !existsSync(PV_CACHE_PATH)) return;
  try {
    const obj = JSON.parse(readFileSync(PV_CACHE_PATH, "utf8")) as Record<
      string,
      { at: number; v: number }
    >;
    for (const [k, val] of Object.entries(obj)) PV_CACHE.set(k, val);
  } catch {
    /* cache illisible → on repart d'un cache vide (non critique) */
  }
}

function savePvCache(): void {
  if (!PV_CACHE_PATH) return;
  try {
    mkdirSync("./data/.cache", { recursive: true });
    const obj: Record<string, { at: number; v: number }> = {};
    for (const [k, val] of PV_CACHE) obj[k] = val;
    const tmp = `${PV_CACHE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(obj));
    renameSync(tmp, PV_CACHE_PATH); // écriture ATOMIQUE : on écrit .tmp puis on renomme
  } catch {
    /* échec de sauvegarde du cache = non critique */
  }
}

/** Force la sauvegarde du cache des vues — appelé à l'ARRÊT PROPRE du serveur (server.ts). */
export function flushViewsCache(): void {
  if (pvDirty > 0) {
    savePvCache();
    pvDirty = 0;
  }
}

async function wikiPageviews(
  lang: string,
  titles: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (titles.length === 0) return out;
  loadPvCache(); // 1er appel : recharge le cache persistant (vues des sessions passées)
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const end = `${now.getFullYear()}${mm}0100`; // 1er du mois courant
  const start = `${now.getFullYear() - 3}${mm}0100`; // 3 ans avant

  // Renvoie le total de vues, ou `null` si la récup a ÉCHOUÉ après réessais
  // (≠ 0 vue). Cette distinction est CRUCIALE : un échec ne doit pas être confondu
  // avec « pas de notoriété », sinon un lieu majeur throttlé plonge au classement.
  const one = async (title: string): Promise<number | null> => {
    const key = `${lang}|${title}`;
    const hit = PV_CACHE.get(key);
    if (hit && now.getTime() - hit.at < PV_TTL) return hit.v;
    const enc = encodeURIComponent(title.replace(/ /g, "_"));
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
      `${lang}.wikipedia/all-access/all-agents/${enc}/monthly/${start}/${end}`;
    // Plusieurs tentatives avec back-off : l'API REST par-article throttle vite
    // (HTTP 429) en rafale. Sans ça, la récup d'un lieu majeur échoue au hasard et
    // son classement devient INSTABLE d'une régénération à l'autre.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 400));
      const data = (await fetchJson(url, 7000)) as {
        items?: Array<{ views?: number }>;
      } | null;
      if (data) {
        let s = 0;
        for (const it of data.items ?? []) s += it.views ?? 0;
        PV_CACHE.set(key, { at: now.getTime(), v: s }); // ne cache QUE les succès
        capMap(PV_CACHE, PV_CACHE_MAX);
        if (++pvDirty >= 200) flushViewsCache(); // sauvegarde débouncée (tous les 200)
        return s;
      }
    }
    return null; // échec réseau/throttle après réessais
  };

  // Vagues de 6 requêtes concurrentes (throttle REST agressif : 6 + back-off est
  // bien plus FIABLE que 16 en rafale). Les échecs (null) ne sont PAS enregistrés
  // → `out.get(title)` vaut undefined, que l'appelant distingue de « 0 vue ».
  const CONC = 6;
  for (let i = 0; i < titles.length; i += CONC) {
    const slice = titles.slice(i, i + CONC);
    const views = await Promise.all(slice.map((t) => one(t)));
    slice.forEach((t, k) => {
      if (views[k] !== null) out.set(t, views[k]!);
    });
  }
  return out;
}

/**
 * Pour des Q-ids, vues Wikipédia via les titres CANONIQUES des sitelinks (zéro
 * redirection). Renvoie pour chaque lieu `{ total, fr }` :
 *  - `total` = FR + EN = popularité GLOBALE (un Français à l'étranger doit voir les
 *    lieux mondialement iconiques, pas seulement ceux lus en français : mémorial du
 *    11-Septembre, gratte-ciels, musées étrangers…) ;
 *  - `fr` = vues FR PURES, gardées à part pour la décision « garder ce stade ? » :
 *    l'EN est gonflé par le foot mondial, donc on tranche les stades sur le FR
 *    (intérêt TOURISTIQUE), pas sur le total (cf. `discoverWikidata`).
 * Tolérant à l'échec (Map partielle → repli sitelinks).
 */
export async function fetchPopularity(
  qids: string[],
): Promise<Map<string, { total: number; fr: number }>> {
  const result = new Map<string, { total: number; fr: number }>();
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
  // Vues FR ET EN pour TOUS, EN PARALLÈLE. La somme = popularité GLOBALE : l'EN capte
  // les lieux mondialement/localement iconiques mal lus en FR (mémorial du 11-Septembre,
  // gratte-ciels, musées étrangers). Le foot (gonflé en EN) est neutralisé EN AVAL : les
  // STADES sont tranchés sur les vues FR (`fr` renvoyé à part), pas sur le total.
  const [frViews, enViews] = await Promise.all([
    wikiPageviews("fr", [...new Set(frOf.values())]),
    wikiPageviews("en", [...new Set(enOf.values())]),
  ]);
  for (const qid of qids) {
    const frT = frOf.get(qid);
    const fr = (frT ? frViews.get(frT) : undefined) ?? 0;
    const enT = enOf.get(qid);
    const en = (enT ? enViews.get(enT) : undefined) ?? 0;
    const total = fr + en;
    if (total > 0) result.set(qid, { total, fr });
  }
  return result;
}

/**
 * Pour des TITRES d'articles FR, résout l'ITEM Wikidata partagé (schema:about) + le titre
 * EN équivalent — une requête SPARQL par lot de 50. Le **Q-id** sert à VÉRIFIER que le titre
 * désigne bien un LIEU : un titre nu de Wikivoyage peut être l'homonyme d'un sujet ultra-
 * consulté et lui voler ses vues (« Monsanto » le parc de Lisbonne → l'ENTREPRISE Monsanto,
 * 1,7M vues). EN en OPTIONAL (un lieu FR-seul résout quand même son Q-id). Tolérant à
 * l'échec : titre non résolu → pas de meta → compté en FR seul, sans vérif lieu.
 * Map { titre FR → { enT?, qid } }.
 */
async function resolveTitleMeta(
  frTitles: string[],
): Promise<Map<string, { enT?: string; qid: string }>> {
  const out = new Map<string, { enT?: string; qid: string }>();
  for (let i = 0; i < frTitles.length; i += 50) {
    const batch = frTitles.slice(i, i + 50);
    const values = batch
      .map((t) => `"${t.replace(/[\\"]/g, " ")}"@fr`)
      .join(" ");
    const sparql =
      `SELECT ?frT ?enT ?item WHERE { VALUES ?frT { ${values} } ` +
      `?fa schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>; schema:name ?frT. ` +
      `OPTIONAL { ?ea schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enT. } }`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const data = (await fetchJson(url, 12000)) as {
      results?: {
        bindings?: Array<{
          frT?: { value?: string };
          enT?: { value?: string };
          item?: { value?: string };
        }>;
      };
    } | null;
    for (const b of data?.results?.bindings ?? []) {
      const qid = b.item?.value?.split("/").pop();
      if (b.frT?.value && qid) out.set(b.frT.value, { enT: b.enT?.value, qid });
    }
  }
  return out;
}

/**
 * Notoriété RÉELLE **FR+EN** par TITRE d'article (≠ par Q-id). Donne une mesure aux
 * lieux qu'un classement par Q-id rate : ceux sans Q-id exploitable (Wikivoyage) ou
 * hors du pré-tri sitelinks de Wikidata. CRUCIAL : on somme FR+EN pour rester sur la
 * **même échelle que `fetchPopularity`** (sonde Wikidata). Sinon ces lieux seraient
 * mesurés en FR PUR (~200k) et passeraient SOUS des lieux mesurés FR+EN (~M) — c'est
 * ce qui enterrait le MET, le MoMA, le Muséum d'histoire naturelle de NYC (venus de
 * Wikivoyage) sous des gratte-ciels obscurs. Map { titre → vues FR+EN }, dédupliquée.
 */
export async function fetchTitleViews(
  titles: string[],
): Promise<Map<string, number>> {
  const uniq = [...new Set(titles.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const meta = await resolveTitleMeta(uniq);
  // FILTRE « LIEU » du top-up — ferme la faille des titres nus : un titre Wikivoyage/OSM
  // peut être l'homonyme d'un sujet ultra-consulté et lui voler ses vues (« Monsanto » le
  // parc → l'ENTREPRISE Monsanto). On IGNORE les vues d'un titre dont l'entité est un
  // NON-lieu CONFIRMÉ (même filtre que la source Wikidata → cohérent ; le MET, musée ET
  // organisation, reste un lieu). Fail-open : filtre HS (null) ⇒ rien rejeté ; pas de
  // Q-id (titre non résolu) ⇒ gardé (invérifiable).
  const placeIds = await wikidataPlaceFilter([
    ...new Set([...meta.values()].map((m) => m.qid)),
  ]);
  const enOf = [...meta.values()].map((m) => m.enT).filter(Boolean) as string[];
  const [frViews, enViews] = await Promise.all([
    wikiPageviews("fr", uniq),
    wikiPageviews("en", [...new Set(enOf)]),
  ]);
  const out = new Map<string, number>();
  for (const t of uniq) {
    const m = meta.get(t);
    if (m && placeIds !== null && !placeIds.has(m.qid)) continue; // non-lieu → vues ignorées
    const fr = frViews.get(t) ?? 0;
    const en = m?.enT ? (enViews.get(m.enT) ?? 0) : 0;
    const total = fr + en;
    if (total > 0) out.set(t, total);
  }
  return out;
}

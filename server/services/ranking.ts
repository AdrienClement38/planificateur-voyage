/**
 * Notoriété TOURISTIQUE : vraies vues Wikipédia (≠ nombre de langues). C'est le
 * signal de classement de PREMIER RANG des suggestions — on mesure ce que les
 * gens CONSULTENT vraiment, sur 3 ans (lissage des pics d'actu/sport), en FR pur
 * (audience de l'app) avec l'EN en simple secours. 100 % données réelles ; un
 * échec de récup vaut `undefined` (≠ « 0 vue ») pour ne jamais déclasser à tort.
 */
import { fetchJson } from "./http";
import { capMap } from "./cache";

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
const PV_CACHE_MAX = 5000; // toit d'entrées → mémoire bornée (process longue durée)

async function wikiPageviews(
  lang: string,
  titles: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (titles.length === 0) return out;
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
 * Pour des Q-ids, somme des vues Wikipédia FR + EN via les titres CANONIQUES des
 * sitelinks (zéro redirection). Signal de notoriété réelle : ce que les gens
 * consultent vraiment — contrairement au nombre de langues, qui sur-classe
 * communes/rivières/chaînes. Tolérant à l'échec (Map partielle → repli sitelinks).
 */
export async function fetchPopularity(
  qids: string[],
): Promise<Map<string, number>> {
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
  // 1) Vues FR pour tous (signal PRINCIPAL = audience française de l'app).
  const frViews = await wikiPageviews("fr", [...new Set(frOf.values())]);
  // 2) EN UNIQUEMENT en secours : on ne sonde EN que pour les lieux SANS vue FR
  //    exploitable (pas d'article FR, ou récup FR échouée). → 2× moins d'appels
  //    REST dans le cas courant : moins de throttle, donc plus robuste ET rapide.
  const needEn = qids.filter((qid) => {
    const t = frOf.get(qid);
    const fv = t ? frViews.get(t) : undefined;
    return (fv === undefined || fv <= 0) && enOf.has(qid);
  });
  const enViews = await wikiPageviews("en", [
    ...new Set(needEn.map((qid) => enOf.get(qid)!)),
  ]);
  for (const qid of qids) {
    const frT = frOf.get(qid);
    const fr = frT ? frViews.get(frT) : undefined; // undefined = pas d'article OU échec
    const enT = enOf.get(qid);
    const en = enT ? enViews.get(enT) : undefined;
    // Audience = touristes FRANÇAIS → on classe sur les vues FR PURES (ce que les
    // Français consultent : opéra, musée, château…). L'EN est gonflé par l'intérêt
    // MONDIAL du sport (un stade explose en EN via le foot) : on l'IGNORE quand un
    // article FR existe, et on ne l'utilise (réduit à l'échelle FR, ×0,1) qu'en
    // SECOURS pour les lieux sans article FR. Pas un « bonus » : on pondère par
    // l'audience réelle de l'app.
    const v = fr && fr > 0 ? fr : en && en > 0 ? en * 0.1 : 0;
    if (v > 0) result.set(qid, v);
  }
  return result;
}

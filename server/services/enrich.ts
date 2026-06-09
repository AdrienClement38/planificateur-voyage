/**
 * Enrichissement des lieux par de VRAIES données Wikipédia/Wikimedia, jamais
 * inventées :
 *  - `fetchExtracts` : intros FR (2 phrases) d'une liste de titres, en un appel —
 *    partagé par les sources Overpass/Wikipédia (description factuelle).
 *  - `enrichWikiMedia` : sur la liste fusionnée FINALE, ajoute photo (Commons),
 *    intro et `fame` (nb de versions linguistiques = notoriété), par lots de 20.
 */
import { fetchJson } from "./http";
import type { PlaceActivity } from "./core";

/** Récupère les intros Wikipédia (fr) pour une liste de titres, en un appel. */
export async function fetchExtracts(
  titles: string[],
): Promise<Record<string, string>> {
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

interface RawWikiResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        extract?: string;
        thumbnail?: { source?: string };
        langlinks?: unknown[];
      }
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
  for (const n of q.normalized ?? [])
    alias[n.from.toLowerCase()] = n.to.toLowerCase();
  for (const r of q.redirects ?? [])
    alias[r.from.toLowerCase()] = r.to.toLowerCase();
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
export async function enrichWikiMedia(places: PlaceActivity[]): Promise<void> {
  const batches: PlaceActivity[][] = [];
  for (let i = 0; i < places.length; i += 20)
    batches.push(places.slice(i, i + 20));
  await Promise.all(batches.map((b) => enrichBatch(b).catch(() => undefined)));
}

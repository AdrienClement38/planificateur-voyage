/**
 * Source 2 (repli) : Wikipédia geosearch. Liste les articles géolocalisés autour du
 * point, écarte le bruit évident (`WIKI_BLOCK`) et les communes, puis RÉSOUT l'entité
 * Wikidata de chaque article pour appliquer le VRAI filtre « lieu » — la regex seule
 * ratait des non-lieux (émeute « Journée des Tuiles », académie, institution…). Garde
 * les ~28 plus proches avec leur intro réelle. Filet utile là où Wikidata/OSM sont
 * pauvres (petites villes, pays peu couverts), et NON filtré par nombre de langues —
 * donc il fait remonter les icônes RÉGIONALES, ensuite classées par leurs vraies vues.
 */
import { fetchJson } from "./http";
import { mapsLink, type PlaceActivity } from "./core";
import { fetchExtracts } from "./enrich";
import { classifyTitle } from "./classify";
import { wikidataPlaceFilter } from "./wikidata-filters";

// Pré-filtre RAPIDE (titres) : voies, transports, administratif, événements, bâtiments…
const WIKI_BLOCK =
  /unit[ée] urbaine|communaut[ée]|\bcanton\b|arrondissement|jeux olympiques|festival|cosmo|cimeti[èe]re|tunnel|quartier|vall[ée]e de|gare des|gare de [a-zà-ÿ' -]+-mont-blanc$|presbyt[èe]re|liste de|^avenue |^rue | rue |^boulevard |^cours [a-zà-ÿ]|tramway|\btram\b|m[ée]tro\b|m[ée]tropole|^pays |\bsi[èe]ge de\b|bataille de|trait[ée] de|congr[èe]s|incendie|attentat|bombardement|occupation|annexion|lib[ée]ration de|^immeuble |^maison (?!de la culture)|^h[ôo]tel (?!de ville|dieu|de r[ée]gion)|^ligne |a[ée]roport|h[ôo]pital|lyc[ée]e|coll[èe]ge|universit[ée]/i;

/**
 * Q-id Wikidata de chaque article FR (pageprops `wikibase_item`, par lot de 50). Sert à
 * appliquer le filtre « lieu » à cette source de secours non typée. Map { titre → Q-id }.
 */
async function resolveWikidataIds(
  titles: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url =
      `https://fr.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&titles=` +
      encodeURIComponent(batch.join("|"));
    const data = (await fetchJson(url)) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; pageprops?: { wikibase_item?: string } }
        >;
      };
    } | null;
    for (const p of Object.values(data?.query?.pages ?? {})) {
      if (p.title && p.pageprops?.wikibase_item)
        out.set(p.title, p.pageprops.wikibase_item);
    }
  }
  return out;
}

export async function discoverWikipedia(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  const geoUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=90&format=json`;
  const geoData = (await fetchJson(geoUrl)) as {
    query?: {
      geosearch?: Array<{ title: string; lat?: number; lon?: number }>;
    };
  } | null;
  const results = geoData?.query?.geosearch ?? [];
  if (results.length === 0) return [];
  const coordOf = new Map(results.map((r) => [r.title, r]));

  const destLower = destination.toLowerCase().split(/[,(]/)[0].trim();
  const isTown = (t: string) =>
    t === destLower ||
    t.replace(/[-\s](mont-blanc|sur-mer|les-bains)$/, "").trim() === destLower;

  // Pré-filtre regex rapide, puis on prend LARGE (45) : le filtre « lieu » va retrancher.
  const pre = results
    .map((r) => r.title)
    .filter((t) => !WIKI_BLOCK.test(t.toLowerCase()) && !isTown(t.toLowerCase()))
    .slice(0, 45);
  if (pre.length === 0) return [];

  // FILTRE « LIEU » via Wikidata : on résout le Q-id de chaque article puis on ne garde
  // que ceux qui SONT des lieux → écarte les non-lieux que la regex rate (émeute, académie,
  // institution…). Sans Q-id → gardé (invérifiable, rare) ; filtre réseau HS → tout gardé.
  const qidOf = await resolveWikidataIds(pre);
  const placeIds = await wikidataPlaceFilter([...new Set(qidOf.values())]);
  const titles = (
    placeIds === null
      ? pre
      : pre.filter((t) => {
          const q = qidOf.get(t);
          return q ? placeIds.has(q) : true;
        })
  ).slice(0, 28);
  if (titles.length === 0) return [];

  const extracts = await fetchExtracts(titles);

  return titles.map((title) => {
    const { category, duration } = classifyTitle(title);
    return {
      name: title,
      description: (
        extracts[title] || `Lieu réel à découvrir à ${destination}.`
      ).slice(0, 240),
      category,
      duration,
      bookingUrl: mapsLink(title, destination),
      provider: "Wikipédia",
      wikiTitle: title, // titre FR canonique → vraies vues FR+EN au top-up
      lat: coordOf.get(title)?.lat,
      lon: coordOf.get(title)?.lon,
    };
  });
}

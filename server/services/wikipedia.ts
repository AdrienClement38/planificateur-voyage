/**
 * Source 2 (repli) : Wikipédia geosearch. Liste les articles géolocalisés autour
 * du point, écarte le bruit (`WIKI_BLOCK` : voies, transports, administratif,
 * événements…) et les communes elles-mêmes, puis garde les ~28 plus proches avec
 * leur intro réelle. Filet utile là où Wikidata/OSM sont pauvres. 100 % réel.
 */
import { fetchJson } from "./http";
import { mapsLink, type PlaceActivity } from "./core";
import { fetchExtracts } from "./enrich";
import { classifyTitle } from "./classify";

// Titres à écarter : voies, transports, administratif, événements, bâtiments…
const WIKI_BLOCK =
  /unit[ée] urbaine|communaut[ée]|\bcanton\b|arrondissement|jeux olympiques|festival|cosmo|cimeti[èe]re|tunnel|quartier|vall[ée]e de|gare des|gare de [a-zà-ÿ' -]+-mont-blanc$|presbyt[èe]re|liste de|^avenue |^rue | rue |^boulevard |^cours [a-zà-ÿ]|tramway|\btram\b|m[ée]tro\b|m[ée]tropole|^pays |\bsi[èe]ge de\b|bataille de|trait[ée] de|congr[èe]s|incendie|attentat|bombardement|occupation|annexion|lib[ée]ration de|^immeuble |^maison (?!de la culture)|^h[ôo]tel (?!de ville|dieu|de r[ée]gion)|^ligne |a[ée]roport|h[ôo]pital|lyc[ée]e|coll[èe]ge|universit[ée]/i;

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

  const titles = results
    .map((r) => r.title)
    .filter(
      (t) => !WIKI_BLOCK.test(t.toLowerCase()) && !isTown(t.toLowerCase()),
    )
    .slice(0, 28);
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
      lat: coordOf.get(title)?.lat,
      lon: coordOf.get(title)?.lon,
    };
  });
}

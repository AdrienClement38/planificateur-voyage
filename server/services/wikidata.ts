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
import {
  wikidataPlaceFilter,
  wikidataPurge,
  wikidataClassifyDemote,
} from "./wikidata-filters";

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

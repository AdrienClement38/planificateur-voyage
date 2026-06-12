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
  // émeute / révolte (Q124757 : « Journée des Tuiles » à Grenoble) — sous-classe
  // d'événement non captée par l'exact-match des supertypes, et que le filtre « lieu »
  // laisse parfois passer sous charge → exclue d'office ici (type déjà en mémoire, 0 réseau).
  "Q124757",
  // finale sportive (Q1366722) / finale de foot (Q65770283) : un MATCH géotaggé au stade
  // (« Finale de la Coupe du monde des clubs FIFA 2014 » au Grand Stade de Marrakech) = un
  // ÉVÉNEMENT, pas un lieu. Sous-classe de « sporting event » (Q16510064) NON captée par
  // Q1656682 ; le filtre « lieu » la laisse passer en fail-open → exclue ici (local, 0 réseau).
  "Q1366722",
  "Q65770283",
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
 * Plancher de vues FR (3 ans) pour qu'un stade reste affiché. On ne garde QUE le stade
 * le PLUS consulté de la ville ET seulement s'il dépasse ce plancher ; les autres sont
 * rétrogradés. Calé pour ne garder que les stades MONDIALEMENT iconiques et rétrograder
 * les RÉGIONAUX — il y a un trou net dans les vues FR : iconiques (Vélodrome 520k, Camp
 * Nou 513k, Wembley 339k) vs régionaux (Chaban-Delmas 166k → n'est PLUS #1 à Bordeaux,
 * Matmut 152k, Old Trafford 122k, Anfield 127k). Décision sur les vues FR PURES (≠ total
 * FR+EN gonflé par le foot mondial, cf. discoverWikidata). Un stade marqué « site
 * touristique » (panathénaïque antique) est exempté d'office.
 */
const STADIUM_VIEWS_MIN = 250_000;

/**
 * Nombre de SOMMETS gardés par ville (les plus consultés) ; au-delà, rétrogradés.
 * Une ville de montagne (Chamonix) est sinon noyée sous 30+ pics notables pour les
 * alpinistes mais pas touristiques (Les Drus, dent du Géant, pointe Baretti…), qui
 * enterrent les VRAIES activités (Mer de Glace, train du Montenvers). On garde les
 * 5 plus connus (Mont Blanc, aiguille du Midi, Grandes Jorasses…).
 */
const SUMMIT_KEEP = 5;

/**
 * Types Wikidata « à mesurer à coup sûr » : attraction touristique (Q570116) ET musée
 * (Q33506) — classifications CURÉES de lieux que les touristes visitent. Signal de
 * SÉLECTION (jamais de tri) : une telle entité est MESURÉE par ses vues même si son
 * rang sitelinks la ferait couper avant — car sitelinks = nombre de langues ≠ notoriété
 * touristique (tout l'intérêt du re-classement par vues). Deux symptômes que ça corrige :
 *  - une attraction majeure mais peu multilingue est éliminée avant d'être mesurée
 *    (mémorial du 11-Septembre : 34 sitelinks → rang ~138, mais 1,2 M de vues FR+EN) ;
 *  - un GRAND MUSÉE hors du top-40 sitelinks n'est mesuré QUE sur ses vues FR (top-up
 *    par titre), donc sur une échelle ≠ des lieux mesurés FR+EN → classé bien trop bas
 *    (le MET, le MoMA, le Muséum d'histoire naturelle de NYC passaient SOUS des
 *    gratte-ciels obscurs). En les mesurant FR+EN ici, ils retrouvent leur vrai rang.
 * On ne touche PAS au tri (100 % vues) : on évite une coupe/mesure aveugle en amont.
 * Garde-fou : `ATTRACTION_PROBE_CAP` borne le surcoût d'appels.
 */
const LANE_TYPES = ["Q570116", "Q33506"];

interface WdAgg {
  label: string;
  sitelinks: number;
  types: Set<string>;
  image?: string;
  lat?: number;
  lon?: number;
}

// Interroge Wikidata autour d'un point, au-dessus d'un seuil de notoriété.
async function wikidataAround(
  lat: number,
  lon: number,
  minSitelinks: number,
  radiusKm: number,
): Promise<Map<string, WdAgg>> {
  const sparql =
    `SELECT ?item ?label ?sitelinks ?type ?image ?c WHERE {` +
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
        c?: { value?: string };
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
    if (a.lat == null && b.c?.value) {
      // WKT « Point(lon lat) » → coords pour la dédup par proximité.
      const m = b.c.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
      if (m) {
        a.lon = parseFloat(m[1]);
        a.lat = parseFloat(m[2]);
      }
    }
  }
  return byId;
}

export async function discoverWikidata(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  // Source PRINCIPALE des suggestions : rayon LARGE (20 km) pour capter les monuments
  // des alentours (Versailles, Bygdøy…). Seuil BAS (≥8 langues) : dans les villes DENSES
  // le LIMIT 500 ne garde de toute façon que les plus connus, mais dans les PETITES villes
  // ça laisse remonter les ICÔNES LOCALES peu multilingues (la Bastille de Grenoble = 8
  // langues, sinon coupée à l'entrée !). Tri par sitelinks ; le cache de vues persistant
  // absorbe la latence du vivier élargi.
  const byId = await wikidataAround(lat, lon, 8, 20);
  if (byId.size === 0) return [];

  const destLow = destination.toLowerCase().split(/[,(]/)[0].trim();
  // Candidats triés par notoriété, hors types évidents non visitables et hors
  // destination elle-même.
  // On prend TRÈS LARGE (400 sur les 500 récupérés) : beaucoup de candidats à fort
  // sitelinks sont des non-lieux (orgas, événements, régions…) retirés ensuite par le
  // filtre « lieu ». Surtout, dans une mégapole les lieux RÉCENTS (peu de langues mais
  // grosses vues : High Line, One Vanderbilt, gratte-ciels supertall…) sont très bas au
  // classement sitelinks — il faut un vivier LARGE pour qu'ils soient MESURÉS par leurs
  // vues (cf. plus bas). Le surcoût n'existe qu'au 1er passage (cache de vues persistant).
  const candidates = [...byId.entries()]
    .filter(
      ([, a]) =>
        ![...a.types].some((t) => WD_BAD_TYPES.has(t)) &&
        a.label.toLowerCase() !== destLow,
    )
    .sort((a, b) => b[1].sitelinks - a[1].sitelinks)
    .slice(0, 400);
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

  // SÉLECTION pour la mesure des vues. On retient un GROS lot de survivants par sitelinks
  // pour que les lieux à grosses vues mais PEU de langues (récents : One Vanderbilt,
  // gratte-ciels supertall, High Line…) soient MESURÉS et non coupés en amont. Ce gros
  // vivier ne coûte cher qu'au 1er passage : le cache de vues PERSISTANT (cf. ranking.ts)
  // le rend ensuite quasi instantané. Le tri final reste 100 % vues (aucun bonus/malus).
  const OUT_BASE = 250;
  const OUT_HARD = 300;
  const out: PlaceActivity[] = [];
  const outIds: string[] = [];
  const attractionIdx: number[] = []; // positions (dans out) des attractions touristiques
  for (const [id, a] of survivors) {
    if (drop.has(id)) continue;
    const isAttraction = LANE_TYPES.some((t) => a.types.has(t));
    // Coupe par sitelinks — SAUF attraction touristique, laissée passer pour mesurer
    // ses vues (continue, PAS break : on continue de scanner pour en trouver d'autres).
    if (out.length >= OUT_BASE && !isAttraction) continue;
    if (out.length >= OUT_HARD) break;
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
      // transit + quartier résidentiel + infra/labo : rétrogradés d'office (cf.
      // wikidataClassifyDemote). Stades/sommets traités à part (conditionnels, plus bas).
      demote:
        demote.transit.has(id) ||
        demote.hoods.has(id) ||
        demote.infra.has(id) ||
        undefined,
      lat: a.lat,
      lon: a.lon,
    });
    if (isAttraction) attractionIdx.push(out.length - 1);
    outIds.push(id);
  }

  // Re-classement par notoriété TOURISTIQUE : on remplace le tri par sitelinks
  // (nombre de langues, qui sur-classe communes/rivières) par les VRAIES vues
  // Wikipédia FR+EN. Repli sur les sitelinks pour les rares lieux sans article
  // consulté. C'est ce tri (via `fame`) que la curation finale réutilise.
  // On sonde les vues de TOUT le lot retenu (jusqu'à PROBE_TOP) — c'est CE qui permet
  // aux lieux à grosses vues mais peu de langues (récents) de se classer à leur vraie
  // place au lieu d'être coupés au pré-tri sitelinks. Coûteux au 1er passage SEULEMENT :
  // le cache de vues persistant (ranking.ts) rend les passages suivants quasi instantanés.
  const PROBE_TOP = 300;
  const ATTRACTION_PROBE_CAP = 40; // garde-fou résiduel (le top couvre déjà tout le lot)
  const probeIds = new Set<string>();
  for (let i = 0; i < Math.min(PROBE_TOP, outIds.length); i++)
    probeIds.add(outIds[i]);
  let extraProbes = 0;
  for (const i of attractionIdx) {
    if (i < PROBE_TOP) continue; // déjà sondé via le top-40
    if (extraProbes >= ATTRACTION_PROBE_CAP) break;
    probeIds.add(outIds[i]);
    extraProbes++;
  }
  const popularity = await fetchPopularity([...probeIds]);
  out.forEach((p, i) => {
    const pop = popularity.get(outIds[i]);
    if (pop && pop.total > 0) {
      p.fame = pop.total; // pour l'admissibilité (≥8) et l'affichage
      p.views = pop.total; // notoriété GLOBALE (FR+EN) — signal de 1er rang
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
  // Décision STADE sur les vues FR PURES (≠ total FR+EN) : l'EN est gonflé par le foot
  // mondial. On garde le stade le plus consulté EN FRANÇAIS (= intérêt touristique) et
  // seulement s'il passe le plancher FR — sinon un stade-foot moderne (Karaïskákis,
  // OAKA…) remonterait via ses seules vues EN. C'est ce qui rend le multi-langues SÛR.
  const frV = (i: number) => popularity.get(outIds[i])?.fr ?? 0;
  let topI = -1;
  for (const i of sportIdx) {
    if (topI < 0 || frV(i) > frV(topI)) topI = i;
  }
  for (const i of sportIdx) {
    const keep = i === topI && frV(i) >= STADIUM_VIEWS_MIN;
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
  // Tri demote-aware (rétrogradés en DERNIER) puis par vues, et on ne RENVOIE que le
  // top-60. CLÉ de l'élargissement : on a MESURÉ large (300, pour faire émerger les
  // récents par leurs VUES — High Line, gratte-ciels supertall…), mais on ne renvoie
  // que le meilleur lot → la fusion (places.ts) garde de la place pour les AUTRES
  // sources (musées de Wikivoyage : MET, MoMA, Muséum…) au lieu d'être noyée par les
  // 250 lieux Wikidata. L'ordre DÉFINITIF est ensuite posé au tri final de places.ts.
  out.sort((a, b) => {
    if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
    return (b.views ?? b.fame ?? 0) - (a.views ?? a.fame ?? 0);
  });
  return out.slice(0, 60);
}

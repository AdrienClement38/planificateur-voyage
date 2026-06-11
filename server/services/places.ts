/**
 * Découverte d'activités RÉELLES et géolocalisées pour une destination, en
 * fusionnant plusieurs sources (chacune apporte son plus) :
 *   1. OpenStreetMap (Overpass) : POI tourisme/monument/parc/sommet avec fiche
 *      Wikidata (= notables), classés par notoriété (versions linguistiques).
 *   2. Wikivoyage : listings « Voir / Faire » curated (liens officiels, descriptions).
 *   3. Wikipédia (geosearch) : lieux réels autour du point, filtrés du bruit.
 *   4. Foursquare Places (clé gratuite optionnelle) : vrais lieux que les autres
 *      ratent (spas, luge, parcs) — niveau gratuit = nom/catégorie/site web.
 * 1 à 3 marchent sans aucune clé ; 4 ne s'active qu'avec sa clé (sinon []).
 * Géocodage via Nominatim, descriptions via Wikipédia/Wikivoyage.
 *
 * On ne renvoie QUE du factuel : nom, description, catégorie, lien réels, et
 * prix/note/photo uniquement quand la source les fournit. JAMAIS d'invention.
 * Liste vide si tout échoue (l'appelant affiche un état vide honnête).
 */
import { geocode } from "./geo";
import type { PlaceActivity } from "./core";
import { discoverFoursquare } from "./foursquare";
import { discoverOverpass } from "./overpass";
import { discoverWikipedia } from "./wikipedia";
import { discoverWikivoyage } from "./wikivoyage";
import { discoverWikidata } from "./wikidata";
import { enrichWikiMedia } from "./enrich";
import { fetchTitleViews } from "./ranking";
import { capMap } from "./cache";

export type { PlaceActivity };

// ------------------------------------------------------------------- Point d'entrée

const cache = new Map<
  string,
  { at: number; places: PlaceActivity[]; ttl: number }
>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h (résultat complet)
const CACHE_TTL_DEGRADED = 15 * 60 * 1000; // 15 min si Wikidata a échoué (auto-réparation)
const SUGG_CACHE_MAX = 500; // toit d'entrées (≈ villes générées) → mémoire bornée

// Entités à BANNIR du résultat final (notoriété trompeuse) : divisions
// administratives (province, métropole, région…) et événements (festival,
// championnat…) — ce ne sont pas des lieux à visiter.
const NOISE_BLOCK =
  /\bprovince\b|ville m[ée]tropolitaine|\bm[ée]tropole\b|communaut[ée]|\bcanton\b|arrondissement|\bd[ée]partement\b|unit[ée] urbaine|aire urbaine|intercommunalit[ée]|dioc[èe]se|g[ée]n[ée]ralit[ée]|universit[ée]|saint-si[èe]ge|ordre souverain|pr[ée]lature|convention|trait[ée] de\b|\baccord\b|conf[ée]rence|protocole|\bpacte\b|\bann[ée]e des\b|\bm[ée]tro\b|organisation|\bagence\b|\bfestival\b|biennale|\bchampionnat|jeux olympiques|\b[ée]lections?\b|\bconcours\b|\battaque\b|assassinat|attentat|\bop[ée]ration\b|\binvasion\b|\boffensive\b|bombardement|\bbataille\b|massacre|\bgare\b|gare routi[èe]re|a[ée]roport|\bpass\b|\bevjf\b|\bevg\b/i;

// Mots de TYPE de lieu en tête d'un nom FORMEL (« basilique X », « stade X ») : sert
// à fusionner ce nom avec le nom COMMUN « X » (même endroit, sources différentes).
// Liste resserrée de types FORTS pour ne pas fusionner à tort (pas « place/rue/tour »).
const PLACE_TYPE_PREFIX =
  /^(?:basilique|cathedrale|eglise|chapelle|abbaye|monastere|musee|stade|chateau|palais|pont|theatre|opera|fontaine|halle|arenes|parc|jardin|fort) /;

/**
 * Clé de dédoublonnage : minuscule, sans accents/ponctuation, sans le suffixe
 * désambiguïsant lié à la destination (« Cathédrale Saint-Pierre d'Annecy » ==
 * « Cathédrale Saint-Pierre », « Le Pâquier (Annecy) » == « Le Pâquier »).
 */
export function dedupKey(name: string, dest: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  // VILLE seule (avant la 1re virgule) : la destination est « Ville, Pays » depuis
  // l'autocomplétion → sans ça, on chercherait « marseille france » en suffixe et
  // « Vieux-Port DE MARSEILLE » ne fusionnerait jamais avec « Vieux Port ».
  const d = norm(dest.split(",")[0]);
  let k = norm(name);
  if (d)
    k = k
      .replace(new RegExp(`(?:\\s(?:de|d|du|des|la|le|l))?\\s${d}$`), "")
      .trim();
  return k;
}

/**
 * Deux clés de dédup désignent-elles le MÊME lieu (sources différentes) ? Trois
 * cas, PRUDENTS (jamais fusionner deux lieux distincts) :
 *  (1) préfixe de TYPE : « basilique X » == « X » (nom formel vs commun) ;
 *  (2) suffixe de TYPE transport : « Grand Central » == « Grand Central Terminal » ;
 *  (3) qualificatif de région : préfixe commun LONG (≥30) + suffixe COURT « de/du… »
 *      (« Musée … » vs « … de l'Isère »), sans toucher « Saint-Pierre » vs « …-aux-Liens ».
 */
export function isNearDup(k1: string, k2: string): boolean {
  const a = k1.length <= k2.length ? k1 : k2; // le plus court
  const b = k1.length <= k2.length ? k2 : k1; // le plus long
  const pref = b.match(PLACE_TYPE_PREFIX);
  if (pref && b.slice(pref[0].length) === a) return true; // (1)
  if (!b.startsWith(a + " ")) return false;
  const suffix = b.slice(a.length + 1);
  if (/^(terminal|station|gare|terminus)$/.test(suffix)) return true; // (2)
  return (
    a.length >= 30 && // (3)
    suffix.length <= 14 &&
    /^(de|du|des|de la|de l)\s/.test(suffix + " ")
  );
}

/** Distance en mètres entre deux points (haversine) — pour la dédup par PROXIMITÉ. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Deux clés partagent-elles un mot SIGNIFICATIF (≥ 4 lettres) ? Garde-fou de la dédup
 *  par proximité : on ne fusionne PAS deux lieux distincts voisins aux noms sans rapport. */
export function shareToken(k1: string, k2: string): boolean {
  const t2 = new Set(k2.split(" ").filter((t) => t.length >= 4));
  return k1.split(" ").some((t) => t.length >= 4 && t2.has(t));
}

/**
 * Agrège plusieurs sources RÉELLES en parallèle puis fusionne :
 *   - Wikivoyage (listings curated + liens officiels), OpenStreetMap (Overpass,
 *     POI notables) et Wikipédia : gratuits, sans clé, toujours actifs ;
 *   - Foursquare (lieux commerciaux) : seulement si sa clé est configurée.
 * Dédoublonné par nom normalisé (sans accents), on garde le tout (les catégories
 * servent au filtre UI).
 */
const inFlight = new Map<string, Promise<PlaceActivity[]>>();

export async function fetchPlaceActivities(
  destination: string,
): Promise<PlaceActivity[]> {
  const key = destination.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.places;
  // Déduplication des requêtes EN COURS : si un fetch pour cette destination
  // tourne déjà (ex. pré-chauffe en arrière-plan à la création du voyage), on
  // PARTAGE sa promesse au lieu d'en lancer un 2nd → zéro double travail, et
  // l'appelant récupère le résultat dès qu'il est prêt (au lieu de refetcher).
  const running = inFlight.get(key);
  if (running) return running;
  const p = doFetchPlaceActivities(destination, key);
  inFlight.set(key, p);
  try {
    return await p;
  } finally {
    inFlight.delete(key);
  }
}

/** Plafond total de la liste finale (alimente aussi la pagination « plus d'idées »). */
const FINAL_LIMIT = 50;
/** Variété en tête : au plus N par catégorie au 1er passage (le surplus comble ensuite). */
const PER_CATEGORY_HEAD = 20;

/**
 * Curation finale d'un pool DÉJÀ TRIÉ par notoriété → liste affichée. Deux passages :
 *  1. VARIÉTÉ en tête : au plus `PER_CATEGORY_HEAD` par catégorie (le surplus d'une
 *     catégorie dominante est mis de côté, PAS jeté).
 *  2. PROFONDEUR : on complète jusqu'à `FINAL_LIMIT` avec ce surplus (déjà trié).
 * Sans le 2e passage, une mégapole mono-thème (New York = 57 lieux « Visite »)
 * resterait tronquée à ~28 par le seul plafond/catégorie. Le 1er passage retient
 * EXACTEMENT les mêmes items en tête qu'avant → top de liste inchangé ; le surplus
 * n'arrive qu'en QUEUE. Fonction PURE (testée sans réseau).
 */
export function curate(pool: PlaceActivity[]): PlaceActivity[] {
  const perCat: Record<string, number> = {};
  const curated: PlaceActivity[] = [];
  const overflow: PlaceActivity[] = [];
  for (const p of pool) {
    if (curated.length >= FINAL_LIMIT) break;
    perCat[p.category] = (perCat[p.category] ?? 0) + 1;
    if (perCat[p.category] > PER_CATEGORY_HEAD) {
      overflow.push(p);
      continue;
    }
    curated.push(p);
  }
  for (const p of overflow) {
    if (curated.length >= FINAL_LIMIT) break;
    curated.push(p);
  }
  return curated;
}

async function doFetchPlaceActivities(
  destination: string,
  key: string,
): Promise<PlaceActivity[]> {
  try {
    const geo = await geocode(destination);
    if (!geo) return [];

    // Toutes les sources en parallèle. Wikidata (notoriété) gère les mégapoles ;
    // Foursquare (à clé) renvoie [] si non configurée → aucun impact.
    const [wd, fs, wv, ov, wk] = await Promise.all([
      discoverWikidata(geo.lat, geo.lon, destination).catch(
        () => [] as PlaceActivity[],
      ),
      discoverFoursquare(geo.lat, geo.lon, destination).catch(
        () => [] as PlaceActivity[],
      ),
      discoverWikivoyage(destination).catch(() => [] as PlaceActivity[]),
      discoverOverpass(geo.lat, geo.lon, destination).catch(
        () => [] as PlaceActivity[],
      ),
      discoverWikipedia(geo.lat, geo.lon, destination).catch(
        () => [] as PlaceActivity[],
      ),
    ]);

    // Wikipédia (recherche de proximité) ramène des INSTITUTIONS (ministères,
    // journaux, banques…) qui esquivent le filtre « lieu » de Wikidata. On ne
    // l'utilise donc qu'en SECOURS, quand Wikidata est pauvre (petites villes).
    const wikipediaFallback = wd.length >= 20 ? [] : wk;

    // Fusion + dédoublonnage (nom normalisé). On rassemble large, on curera après.
    const seen = new Set<string>();
    const seenKeys: string[] = [];
    const merged: PlaceActivity[] = [];
    for (const p of [...wd, ...fs, ...wv, ...ov, ...wikipediaFallback]) {
      if (!p.name || NOISE_BLOCK.test(p.name)) continue;
      const k = dedupKey(p.name, destination);
      if (!k || seen.has(k)) continue;
      // Dédup FLOUE — deux entités du MÊME lieu aux noms quasi identiques où l'un n'est
      // que l'autre + un QUALIFICATIF de région/appartenance (ex. Grenoble : « Musée de
      // la Résistance et de la déportation » vs « … de l'Isère »). PRUDENCE EXTRÊME pour
      // ne JAMAIS fusionner des lieux distincts (« basilique Saint-Pierre » vs « … -aux-
      // Liens », deux églises de Rome) : on exige (1) un préfixe commun LONG (≥ 30 car.,
      // sur frontière de mot) ET (2) que le suffixe ajouté soit COURT (≤ 14) et commence
      // par « de/du/des… » — un vrai qualificatif, pas un mot distinctif (« aux Liens »,
      // « Moderne », « et contemporain » ne commencent pas par « de » → jamais fusionnés).
      if (seenKeys.some((s) => isNearDup(k, s))) continue;
      // Dédup par PROXIMITÉ (« regarder les adresses ») : même endroit (< 110 m) ET un
      // mot commun = même lieu quel que soit le nom (« Musée Solomon-R.-Guggenheim » ==
      // « Musée Guggenheim », « Grand Central » == « Grand Central Terminal »). On garde
      // le 1er rencontré (ordre des sources : Wikidata d'abord, le mieux renseigné).
      if (
        p.lat != null &&
        p.lon != null &&
        merged.some(
          (m, i) =>
            m.lat != null &&
            m.lon != null &&
            distanceMeters(p.lat!, p.lon!, m.lat, m.lon) < 110 &&
            shareToken(k, seenKeys[i]),
        )
      )
        continue;
      seen.add(k);
      seenKeys.push(k);
      merged.push(p);
      // Plafond du lot fusionné. Wikidata ne renvoie que son top-60 (cf. discoverWikidata),
      // donc ce plafond laisse de la place aux musées/listings Wikivoyage (MET, MoMA…) et
      // aux POI OSM avant la curation finale. Le tri par vues + curate(50) tranchent ensuite.
      if (merged.length >= 90) break;
    }

    // Enrichit avec photos + intros libres (Wikimedia). La photo devient le signal
    // de qualité : un lieu iconique en a une, le remplissage fade non.
    await enrichWikiMedia(merged);

    // CURATION « peps ou rien » : admis si une VRAIE photo OU une vraie notoriété
    // (présent dans ≥8 Wikipédia). Le reste = remplissage fade, écarté.
    const admissible = (p: PlaceActivity) => !!p.imageUrl || (p.fame ?? 0) >= 8;

    // Classement par NOTORIÉTÉ, en PALIERS — pour ne JAMAIS comparer deux échelles
    // incomparables : les vraies vues (~10³-10⁵) et le repli liens/sitelinks (~10²).
    //   • Palier 0 : les gares-transit utilitaires (`demote`) tout EN BAS — très
    //     consultées (voyageurs) mais pas touristiques. Reléguées, jamais supprimées.
    //   • Palier 1 : les lieux dont on a les VRAIES vues (triés par vues = audience FR).
    //   • Palier 2 : le reste (triés par `fame` = nb de Wikipédia).
    // ROBUSTESSE : un lieu majeur dont la récup de vues échoue (throttle) ne plonge pas
    // au milieu — il reste au pire en tête du palier 2. AUCUN bonus/malus chiffré.
    const candidates = merged.filter(admissible);

    // TOP-UP des VUES par titre Wikipédia pour les candidats qui n'en ont pas encore
    // (lieux Wikivoyage, ou Wikidata hors du top-40 sitelinks). Sans ça, des lieux
    // MAJEURS (Rockefeller, MET, MoMA, Grand Central…) restaient à `views=undefined`
    // → relégués au palier 2, SOUS des lieux mineurs qui, eux, avaient leurs vues.
    // On donne ainsi à TOUS la même mesure de notoriété (vues FR réelles, 3 ans).
    const needViews = candidates.filter((p) => p.views == null);
    if (needViews.length > 0) {
      const tv = await fetchTitleViews(
        needViews.map((p) => p.wikiTitle || p.name),
      );
      for (const p of needViews) {
        const v = tv.get(p.wikiTitle || p.name);
        if (v && v > 0) p.views = v;
      }
    }

    const ranked = candidates.sort((a, b) => {
      if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
      const av = a.views != null;
      const bv = b.views != null;
      if (av !== bv) return av ? -1 : 1;
      if (av && bv) return b.views! - a.views!;
      return (b.fame ?? 0) - (a.fame ?? 0);
    });

    // DÉDUP « même article » : deux entrées aux VUES IDENTIQUES non nulles et à < 200 m
    // sont le MÊME lieu sous deux noms — translittération (« Jemaa el-Fna » / « Jamaâ
    // el-fna ») ou synonyme (« Olympiéion » / « Temple de Zeus ») — qui tirent leurs vues
    // du MÊME article Wikipédia, d'où l'égalité EXACTE (deux lieux DISTINCTS n'ont jamais
    // exactement les mêmes vues sur 3 ans). On garde la 1ʳᵉ (tri stable → mieux classée,
    // source Wikidata d'abord). Rattrape ce que la dédup par nom/token laisse passer.
    const deduped: PlaceActivity[] = [];
    for (const p of ranked) {
      const v = p.views ?? 0;
      const dup =
        v > 0 &&
        p.lat != null &&
        p.lon != null &&
        deduped.some(
          (s) =>
            (s.views ?? 0) === v &&
            s.lat != null &&
            s.lon != null &&
            distanceMeters(p.lat!, p.lon!, s.lat!, s.lon!) < 200,
        );
      if (!dup) deduped.push(p);
    }

    // Si on a assez de lieux AVEC photo, on ne garde QUE ceux-là (peps visuel,
    // zéro carte fade). Sinon on complète avec les moins illustrés mais notables.
    const withPhoto = deduped.filter((p) => p.imageUrl);
    const pool = withPhoto.length >= 5 ? withPhoto : deduped;

    // Liste PROFONDE (pagination « Voir d'autres idées »), curée en 2 passages :
    // variété en tête PUIS remplissage jusqu'au plafond — cf. `curate` (fonction
    // pure, testée unitairement : top de liste préservé, mégapoles comblées).
    const curated = curate(pool);

    // Si Wikidata n'a rien donné (échec/throttle), le classement par notoriété est
    // dégradé → cache court (15 min) pour réessayer bientôt, au lieu de figer 6 h.
    if (curated.length > 0) {
      const ttl = wd.length > 0 ? CACHE_TTL : CACHE_TTL_DEGRADED;
      cache.set(key, { at: Date.now(), places: curated, ttl });
      capMap(cache, SUGG_CACHE_MAX);
    }
    return curated;
  } catch {
    return [];
  }
}

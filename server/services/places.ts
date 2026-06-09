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
  /\bprovince\b|ville m[ée]tropolitaine|\bm[ée]tropole\b|communaut[ée]|\bcanton\b|arrondissement|\bd[ée]partement\b|unit[ée] urbaine|aire urbaine|intercommunalit[ée]|dioc[èe]se|g[ée]n[ée]ralit[ée]|universit[ée]|saint-si[èe]ge|ordre souverain|pr[ée]lature|convention|trait[ée] de\b|\baccord\b|conf[ée]rence|protocole|\bpacte\b|\bann[ée]e des\b|\bm[ée]tro\b|organisation|\bagence\b|\bfestival\b|biennale|\bchampionnat|jeux olympiques|\b[ée]lections?\b|\bconcours\b|\battaque\b|attentat|\bop[ée]ration\b|\binvasion\b|\boffensive\b|bombardement|\bbataille\b|massacre|\bgare\b|gare routi[èe]re|a[ée]roport|\bpass\b|\bevjf\b|\bevg\b/i;

/**
 * Clé de dédoublonnage : minuscule, sans accents/ponctuation, sans le suffixe
 * désambiguïsant lié à la destination (« Cathédrale Saint-Pierre d'Annecy » ==
 * « Cathédrale Saint-Pierre », « Le Pâquier (Annecy) » == « Le Pâquier »).
 */
function dedupKey(name: string, dest: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const d = norm(dest);
  let k = norm(name);
  if (d)
    k = k
      .replace(new RegExp(`(?:\\s(?:de|d|du|des|la|le|l))?\\s${d}$`), "")
      .trim();
  return k;
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
      const nearDup = seenKeys.some((s) => {
        const a = k.length <= s.length ? k : s; // le plus court
        const b = k.length <= s.length ? s : k; // le plus long
        if (a.length < 30 || !b.startsWith(a + " ")) return false;
        const suffix = b.slice(a.length + 1);
        return (
          suffix.length <= 14 && /^(de|du|des|de la|de l)\s/.test(suffix + " ")
        );
      });
      if (nearDup) continue;
      seen.add(k);
      seenKeys.push(k);
      merged.push(p);
      if (merged.length >= 70) break;
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
    const ranked = merged.filter(admissible).sort((a, b) => {
      if (!!a.demote !== !!b.demote) return a.demote ? 1 : -1;
      const av = a.views != null;
      const bv = b.views != null;
      if (av !== bv) return av ? -1 : 1;
      if (av && bv) return b.views! - a.views!;
      return (b.fame ?? 0) - (a.fame ?? 0);
    });

    // Si on a assez de lieux AVEC photo, on ne garde QUE ceux-là (peps visuel,
    // zéro carte fade). Sinon on complète avec les moins illustrés mais notables.
    const withPhoto = ranked.filter((p) => p.imageUrl);
    const pool = withPhoto.length >= 5 ? withPhoto : ranked;

    // Liste PROFONDE classée du plus pertinent au moins pertinent (notoriété),
    // pour alimenter la pagination « Voir d'autres idées ». Plafond généreux par
    // catégorie (pas d'affamage des villes mono-thème) et total raisonnable.
    const perCat: Record<string, number> = {};
    const curated: PlaceActivity[] = [];
    for (const p of pool) {
      perCat[p.category] = (perCat[p.category] ?? 0) + 1;
      if (perCat[p.category] > 20) continue; // plafond souple : laisse les villes mono-thème aller en profondeur
      curated.push(p);
      if (curated.length >= 50) break;
    }

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

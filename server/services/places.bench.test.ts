import { describe, it, expect } from "vitest";
import { fetchPlaceActivities } from "./places";

/**
 * BANC DE TEST « vérité terrain » du moteur de suggestions — l'armure anti-régression.
 *
 * ⚠ Il appelle le VRAI moteur EN LIGNE (Wikidata + Wikipédia + OSM) → lent et
 * dépendant du réseau, donc EXCLU de la CI par défaut (sinon flaky). On le lance
 * À LA MAIN avant tout changement du moteur :
 *
 *     RUN_BENCH=1 npx vitest run server/services/places.bench.test.ts
 *     (Windows PowerShell : $env:RUN_BENCH=1; npx vitest run server/services/places.bench.test.ts)
 *
 * Chaque ville fixe ce qui DOIT figurer en page 1 (top 15) et ce qui ne DOIT PAS
 * (stades locaux « au pif », gares-transit, œuvres-en-standalone…). Toute modif qui
 * casse un de ces invariants — même pour une raison sans rapport — fait échouer le banc.
 *
 * Vérités calées sur docs/MOTEUR-SUGGESTIONS.md (§ Banc de test). À enrichir au fil de l'eau.
 */

const N = 15; // page 1 ≈ top 15

type Case = {
  city: string;
  contain: string[]; // DOIT figurer dans le top N
  notContain: string[]; // ne DOIT PAS figurer dans le top N
  containAll?: string[]; // DOIT figurer QUELQUE PART dans la liste complète
  notContainAll?: string[]; // ne DOIT JAMAIS figurer (liste ENTIÈRE, pas que le top N)
};

const CASES: Case[] = [
  {
    city: "Rome, Italie",
    contain: ["Colisée", "Panthéon", "Saint-Pierre", "Trevi", "Sixtine"],
    notContain: ["Pietà", "conclave"], // œuvre-en-standalone, événement
  },
  {
    city: "Oslo, Norvège",
    // Les MUSÉES doivent figurer (Q33506 dans l'allow-list) ; le TREMPLIN de Holmenkollen
    // aussi (belvédère touristique → exempté du démote sportif) ; AUCUN stade local.
    contain: ["Munch", "Fram", "Holmenkoll"],
    notContain: ["Ullevaal", "Bislett", "Nadderud", "Intility", "Le Cri"],
  },
  {
    city: "Barcelone, Espagne",
    // Camp Nou (LE stade de la ville) gardé ; les autres stades virés.
    contain: ["Sagrada", "Camp Nou", "Güell"],
    notContain: ["Lluís-Companys", "Cornellà", "Stade des Cort"],
  },
  {
    city: "Londres, Royaume-Uni",
    // « On laisse juste Wembley » : l'Emirates (2e stade) part.
    contain: ["Big Ben", "Wembley", "British Museum"],
    notContain: ["Emirates"],
  },
  {
    city: "Athènes, Grèce",
    // Le panathénaïque (antique, « site touristique ») reste ; stades modernes virés ;
    // statues antiques DÉTRUITES (« œuvre perdue ») purgées.
    contain: ["Parthénon", "panathénaïque"],
    notContain: ["Athéna Parthénos", "Karaïsk", "olympique d'Athènes"],
  },
  {
    city: "Marseille, France",
    // Vélodrome (LE stade de la ville) gardé ; gares-transit reléguées hors page 1.
    contain: ["Vélodrome", "Notre-Dame-de-la-Garde"],
    notContain: ["Saint-Charles", "Aix-en-Provence"],
  },
  {
    city: "Paris, France",
    // Stade de France (LE stade gardé) ; Parc des Princes (2e) relégué.
    // (⚠ dépend de la décision « 1 seul stade par ville » — à rediscuter si besoin.)
    contain: ["Eiffel", "Louvre", "Notre-Dame"],
    notContain: ["Parc des Princes"],
  },
  {
    city: "Chamonix, France",
    // Ville de montagne : les ICÔNES + les ACTIVITÉS doivent figurer, PAS la
    // ribambelle de pics mineurs (plafonnés à SUMMIT_KEEP). « pointe X » = pics
    // secondaires rétrogradés (pointe Baretti/Louis-Amédée… étaient #30+).
    contain: ["mont Blanc", "aiguille du Midi", "Mer de Glace", "Montenvers"],
    notContain: ["pointe"],
  },
  {
    city: "Viviers, Ardèche, France",
    // Petite commune près du Rhône : SURTOUT aucune CENTRALE (Tricastin/Cruas =
    // sites industriels, pas des visites). La cathédrale Saint-Vincent (plus petite
    // cathédrale de France) est le point d'intérêt emblématique.
    contain: ["cathédrale"],
    notContain: ["centrale", "nucléaire", "Tricastin", "Cruas"],
  },
  {
    // Mégapole à l'ÉTRANGER : verrouille les trois fixes de cette série.
    city: "New York",
    // Icônes mondiales toujours en page 1.
    contain: ["liberté", "empire state", "world trade", "central park"],
    // (a) Voie « tourist attraction » : le mémorial du 11-Septembre (musée, 34 sitelinks
    // → jadis coupé au rang ~138) DOIT être présent — classé par ses vraies vues FR+EN.
    containAll: ["septembre"],
    // (b) Demote des QUARTIERS résidentiels (Broadway/Greenwich Village rétrogradés hors
    // page 1) + (c) purge des ARRONDISSEMENTS (Queens = comté « consolidated city-county »).
    notContain: ["Queens", "Broadway", "Greenwich Village"],
    // (c) purge des ZONES larges : communes du New Jersey, aire urbaine, rivière/estuaire —
    // ABSENTES de toute la liste (la purge fiabilisée ne doit plus les laisser repasser).
    notContainAll: ["Jersey City", "Hoboken", "Grand New York", "Hudson", "East River"],
  },
  {
    // Petite ville FR : valide le SEUIL BAS (≥8 langues) — la Bastille (8 langues, l'icône)
    // doit remonter — ET le filtre « lieu » des sources de secours : l'émeute « Journée des
    // Tuiles » et l'académie (non-lieux venus de Wikipédia) doivent DISPARAÎTRE.
    city: "Grenoble, France",
    contain: ["Bastille", "musée de Grenoble"],
    notContain: ["Académie de Grenoble"],
    notContainAll: ["Journée des Tuiles"],
  },
  {
    // Pays NON européen / faible couverture Wikidata : les icônes peu multilingues doivent
    // être mesurées par leurs VRAIES vues FR+EN (jadis Koutoubia [1 vue], Majorelle [30]).
    city: "Marrakech, Maroc",
    contain: ["Majorelle", "Koutoubia"],
    notContain: [],
    // La place Jemaa el-Fna ressort sous une orthographe VARIABLE selon la source qui gagne
    // le tri (Wikidata « Jemaa el-Fna » vs Wikivoyage « Place Jamaâ el-fna ») → on matche le
    // radical commun « el-fna », et sur la liste ENTIÈRE (robuste au throttle de l'API vues).
    containAll: ["el-fna"],
    // Un ÉVÉNEMENT géotaggé au Grand Stade (finale de la Coupe du monde des clubs FIFA 2014)
    // ne doit JAMAIS apparaître — type finale Q1366722 dans WD_BAD_TYPES (fil-piège fail-open).
    notContainAll: ["Coupe du monde des clubs"],
  },
  {
    // Stade RÉGIONAL (Chaban-Delmas, 166k vues FR < plancher 250k) NE doit PAS dominer une
    // ville riche en icônes → rétrogradé. La Cité du Vin (récente, peu multilingue) remonte.
    city: "Bordeaux, France",
    contain: ["cathédrale", "Bourse", "Cité du Vin"],
    notContain: ["stade Chaban"],
  },
  {
    // Ville moyenne : le palais des ducs + les musées sortent (icônes patrimoniales).
    city: "Dijon, France",
    contain: ["palais des ducs", "musée des Beaux-Arts"],
    notContain: [],
  },
  {
    // Mégapole touristique étrangère : les incontournables en tête.
    city: "Venise, Italie",
    contain: ["Saint-Marc", "Doges", "Rialto"],
    notContain: [],
  },
];

describe.skipIf(!process.env.RUN_BENCH)(
  "banc suggestions (réseau LIVE — lancer avec RUN_BENCH=1)",
  () => {
    for (const c of CASES) {
      it(
        c.city,
        async () => {
          // Espace les villes : 8 fetchs d'affilée saturent l'API des vues
          // (throttle) → une icône peut faux-échouer. Une pause laisse l'API
          // respirer (le banc est manuel, la lenteur n'est pas un souci).
          await new Promise((r) => setTimeout(r, 4000));
          const list = await fetchPlaceActivities(c.city);
          expect(
            list.length,
            `${c.city} : trop peu de résultats (${list.length})`,
          ).toBeGreaterThan(8);

          const top = list.slice(0, N).map((p) => p.name.toLowerCase());
          const has = (s: string) =>
            top.some((n) => n.includes(s.toLowerCase()));

          for (const m of c.contain) {
            expect(
              has(m),
              `${c.city} DOIT contenir « ${m} » dans le top ${N}`,
            ).toBe(true);
          }
          for (const m of c.notContain) {
            expect(
              has(m),
              `${c.city} ne DOIT PAS contenir « ${m} » dans le top ${N}`,
            ).toBe(false);
          }

          // Vérités sur la LISTE ENTIÈRE (≠ top N) — invariants plus STRICTS : un lieu
          // qui DOIT exister quelque part, ou qui ne doit JAMAIS réapparaître (purges).
          const all = list.map((p) => p.name.toLowerCase());
          const hasAll = (s: string) =>
            all.some((n) => n.includes(s.toLowerCase()));
          for (const m of c.containAll ?? []) {
            expect(
              hasAll(m),
              `${c.city} DOIT contenir « ${m} » (liste complète)`,
            ).toBe(true);
          }
          for (const m of c.notContainAll ?? []) {
            expect(
              hasAll(m),
              `${c.city} ne DOIT JAMAIS contenir « ${m} » (liste complète)`,
            ).toBe(false);
          }
        },
        180_000,
      );
    }
  },
);

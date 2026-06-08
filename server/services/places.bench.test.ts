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

type Case = { city: string; contain: string[]; notContain: string[] };

const CASES: Case[] = [
  {
    city: "Rome, Italie",
    contain: ["Colisée", "Panthéon", "Saint-Pierre", "Trevi", "Sixtine"],
    notContain: ["Pietà", "conclave"], // œuvre-en-standalone, événement
  },
  {
    city: "Oslo, Norvège",
    // Les MUSÉES doivent figurer (Q33506 dans l'allow-list) ; AUCUN stade local.
    contain: ["Munch", "Fram"],
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
        },
        180_000,
      );
    }
  },
);

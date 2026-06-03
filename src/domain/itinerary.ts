import type { ItineraryDay, ItineraryEvent, Trip, ActivityProposal } from "../types";
import type { ActivitySeed } from "./activities";
import { addMinutesToTime, parseDurationToMinutes } from "./schedule";

/** Construit un itinéraire vide de `targetDays` jours, prêt à être rempli. */
export function buildEmptyItinerary(
  targetDays: number,
  destinationLabel: string,
): ItineraryDay[] {
  return Array.from({ length: targetDays }, (_, idx) => ({
    day: idx + 1,
    title: `Jour ${idx + 1} : Exploration de ${destinationLabel}`,
    events: [],
  }));
}

export interface MockItineraryResult {
  activities: ActivitySeed[];
  itinerary: ItineraryDay[];
  averageLodgingCostPerNight: number;
  averageLocalTransportCostPerDay: number;
}

/**
 * Génère un itinéraire et un jeu d'activités curatés hors-ligne, ajustés au
 * type de budget. Sert de repli déterministe lorsque l'API est injoignable.
 * Fonction pure (aucune clé d'API requise).
 */
export function getMockDynamicItinerary(
  destination: string,
  days: number,
  budgetType: string,
): MockItineraryResult {
  const lowercaseDest = destination.toLowerCase();

  let activityThemes: ActivitySeed[] = [
    { name: `Visite guidée historique de ${destination}`, description: "Découverte historique des monuments incontournables et trésors cachés.", cost: 20, category: "Visite" },
    { name: "Expérience culinaire en groupe", description: "Bistrot typique, dégustation de spécialités et de planches à partager.", cost: 30, category: "Gastronomie" },
    { name: "Balade nature et panorama d'exception", description: "Randonnée douce ou marche à pied vers les meilleurs panoramas.", cost: 0, category: "Nature" },
    { name: "Jeu de piste ou escape game urbain", description: "Une activité connectée amusante pour renforcer la cohésion d'équipe.", cost: 15, category: "Loisir" },
    { name: "Flânerie libre dans le quartier branché", description: "Boutiques conceptuelles, artisans d'art et café de spécialité.", cost: 10, category: "Shopping" },
  ];

  let lodgingCost = budgetType === "Économique" ? 35 : budgetType === "Luxe" ? 180 : 75;
  const transportCost = budgetType === "Économique" ? 8 : budgetType === "Luxe" ? 35 : 14;

  if (lowercaseDest.includes("rome") || lowercaseDest.includes("italie")) {
    activityThemes = [
      { name: "Visite coupe-file du Colisée de Rome", description: "Immersion unique dans l'histoire de l'arène impériale antique.", cost: 24, category: "Culture" },
      { name: "Dégustation culinaire guidée à Trastevere", description: "Parcours gourmand dans le quartier bohème : pizza rouge, pâtes Cacio e Pepe et glaces artisanales.", cost: 35, category: "Gastronomie" },
      { name: "Pique-nique champêtre à la Villa Borghese", description: "Un immense parc arboré idéal pour se détendre en barque.", cost: 10, category: "Nature" },
      { name: "Soirée Piazza & Fontaines éclairées", description: "Découverte de la Fontaine de Trevi et du Panthéon de nuit.", cost: 0, category: "Visite" },
      { name: "Visite des Musées du Vatican", description: "Admirez la somptueuse Chapelle Sixtine de Michel-Ange.", cost: 22, category: "Culture" },
    ];
    lodgingCost = budgetType === "Économique" ? 40 : budgetType === "Luxe" ? 220 : 85;
  } else if (lowercaseDest.includes("paris") || lowercaseDest.includes("france")) {
    activityThemes = [
      { name: "Billets d'ascension de la mythique Tour Eiffel", description: "Prendre de la hauteur et observer toute la capitale au crépuscule.", cost: 28, category: "Culture" },
      { name: "Croisière conviviale au fil de la Seine", description: "Au départ du Pont Neuf, une découverte fluide des monuments historiques.", cost: 15, category: "Visite" },
      { name: "Bistro parisien et dégustation de vins", description: "Soirée gourmande dans un établissement typique du Marais.", cost: 35, category: "Gastronomie" },
      { name: "Balade bohème à Montmartre", description: "Flânerie sur les marches de la Basilique du Sacré-Cœur.", cost: 0, category: "Visite" },
      { name: "Visite nocturne du Musée du Louvre", description: "Découvrir la Joconde et la Vénus de Milo dans une ambiance feutrée.", cost: 17, category: "Culture" },
    ];
    lodgingCost = budgetType === "Économique" ? 45 : budgetType === "Luxe" ? 240 : 95;
  } else if (lowercaseDest.includes("barcelone") || lowercaseDest.includes("espagne")) {
    activityThemes = [
      { name: "Entrées pour la basilique de la Sagrada Família", description: "L'insolite chef-d'œuvre inachevé de l'architecte Antoni Gaudí.", cost: 26, category: "Culture" },
      { name: "Tapas festives au cœur du quartier El Born", description: "Poulpes, croquetas fondantes, charcuteries et patatas bravas épicées.", cost: 25, category: "Gastronomie" },
      { name: "Journée Beach Volley et plage à Barceloneta", description: "Tournois amicaux sur la plage suivis d'un bain rafraîchissant.", cost: 0, category: "Nature" },
      { name: "Coucher de soleil magique aux Bunkers del Carmel", description: "La plus spectaculaire vue à 360 degrés sur la cité catalane.", cost: 0, category: "Visite" },
      { name: "Parcours architectural moderniste du Passeig de Gràcia", description: "Contempler la Casa Batlló et la Pedrera illuminées.", cost: 12, category: "Culture" },
    ];
    lodgingCost = budgetType === "Économique" ? 30 : budgetType === "Luxe" ? 190 : 65;
  } else if (lowercaseDest.includes("tokyo") || lowercaseDest.includes("japon")) {
    activityThemes = [
      { name: "Ascension au Shibuya Sky Observatory", description: "Vue vertigineuse au dessus du carrefour le plus fréquenté au monde.", cost: 18, category: "Visite" },
      { name: "Dîner Izakaya traditionnel en groupe", description: "Brochettes Yakitori, gyozas et boissons régionales dans une ruelle rétro.", cost: 30, category: "Gastronomie" },
      { name: "Visite de l'exposition immersive teamLab Planets", description: "Un chef-d'œuvre technologique d'installations numériques d'art.", cost: 26, category: "Culture" },
      { name: "Salles de Karaoké privatives à Shinjuku", description: "Chanter vos hymnes de groupe préférés dans un salon futuriste équipé.", cost: 15, category: "Loisir" },
      { name: "Tour historique du temple bouddhiste Senso-ji", description: "Explorer le vieux quartier d'Asakusa et ses boutiques d'artisanat.", cost: 0, category: "Culture" },
    ];
    lodgingCost = budgetType === "Économique" ? 35 : budgetType === "Luxe" ? 250 : 80;
  }

  const costMultiplier = budgetType === "Économique" ? 0.6 : budgetType === "Luxe" ? 2.2 : 1.0;
  const adjustedActivities = activityThemes.map((act) => ({
    ...act,
    cost: Math.round(act.cost * costMultiplier),
  }));

  const itinerary: ItineraryDay[] = [];
  for (let d = 1; d <= days; d++) {
    const act1 = adjustedActivities[(d * 2 - 2) % adjustedActivities.length];
    const act2 = adjustedActivities[(d * 2 - 1) % adjustedActivities.length];

    itinerary.push({
      day: d,
      title: `Jour ${d} : Découverte majeure de ${destination}`,
      events: [
        { id: `gen-ev-${d}-1`, time: "09:00", description: `Petit-déjeuner gourmand local`, cost: budgetType === "Économique" ? 6 : budgetType === "Luxe" ? 22 : 11 },
        { id: `gen-ev-${d}-2`, time: "10:30", description: `${act1.name} - ${act1.description}`, cost: act1.cost },
        { id: `gen-ev-${d}-3`, time: "13:00", description: "Déjeuner convivial de spécialités locales", cost: budgetType === "Économique" ? 9 : budgetType === "Luxe" ? 38 : 18 },
        { id: `gen-ev-${d}-4`, time: "15:00", description: `${act2.name} - ${act2.description}`, cost: act2.cost },
        { id: `gen-ev-${d}-5`, time: "19:30", description: "Dîner festif et débriefing du groupe", cost: budgetType === "Économique" ? 14 : budgetType === "Luxe" ? 65 : 25 },
      ],
    });
  }

  return {
    activities: adjustedActivities,
    itinerary,
    averageLodgingCostPerNight: lodgingCost,
    averageLocalTransportCostPerDay: transportCost,
  };
}

/**
 * Construit un itinéraire automatique à partir des activités les plus votées
 * du voyage, en intercalant les repas selon le type de budget. Pur : ne touche
 * pas à l'état, renvoie simplement le nouvel itinéraire.
 */
/** Une activité d'au moins 6h occupe la journée entière (pas de 2e activité). */
const FULL_DAY_MIN = 360;

/** Renvoie la plus tardive de deux heures "HH:MM" (format zéro-paddé). */
function laterTime(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Construit un itinéraire automatique COHÉRENT à partir des activités les plus
 * votées : chaque jour enchaîne petit-déjeuner → activité(s) → repas → dîner en
 * respectant la **durée** de chaque activité (heures de début ET de fin, aucun
 * chevauchement). Une activité « journée complète » occupe seule son jour. Les
 * activités ne sont pas répétées d'un jour à l'autre.
 */
export function buildAutoPlanItinerary(trip: Trip): ItineraryDay[] {
  const sorted = [...trip.activities].sort((a, b) => b.votes.length - a.votes.length);
  const dur = (a: ActivityProposal) => parseDurationToMinutes(a.duration) ?? 120;

  const mealCostBreakfast = trip.budgetType === "Économique" ? 5 : trip.budgetType === "Luxe" ? 22 : 11;
  const mealCostLunch = trip.budgetType === "Économique" ? 9 : trip.budgetType === "Luxe" ? 40 : 18;
  const mealCostDinner = trip.budgetType === "Économique" ? 14 : trip.budgetType === "Luxe" ? 65 : 28;

  const queue = [...sorted];
  const days: ItineraryDay[] = [];

  for (let d = 1; d <= trip.targetDays; d++) {
    // 1 activité par jour, 2 si la 1re est courte et qu'elles tiennent en ~8h.
    const dayActs: ActivityProposal[] = [];
    if (queue.length) {
      const first = queue.shift()!;
      dayActs.push(first);
      if (
        dur(first) < FULL_DAY_MIN &&
        queue.length &&
        dur(queue[0]) < FULL_DAY_MIN &&
        dur(first) + dur(queue[0]) <= 8 * 60
      ) {
        dayActs.push(queue.shift()!);
      }
    }

    const hasFullDay = dayActs.some((a) => dur(a) >= FULL_DAY_MIN);
    const events: ItineraryEvent[] = [];
    let n = 0;
    const push = (time: string, endTime: string, description: string, cost: number) =>
      events.push({ id: `ev-auto-${d}-${n++}`, time, endTime, description, cost });

    // Petit-déjeuner.
    push("08:30", "09:15", "☕ Petit-déjeuner convivial en groupe près de l'hébergement", mealCostBreakfast);

    let cursor = "10:00"; // les activités démarrent à 10h
    if (dayActs[0]) {
      const end = addMinutesToTime(cursor, dur(dayActs[0]));
      const a = dayActs[0];
      push(cursor, end, `${a.name}${a.description ? ` — ${a.description}` : ""}`, a.cost);
      cursor = addMinutesToTime(end, 30); // 30 min de battement
    }

    // Déjeuner, sauf si une activité « journée complète » l'englobe.
    if (!hasFullDay) {
      const lunch = laterTime(cursor, "12:30");
      push(lunch, addMinutesToTime(lunch, 60), "🍽️ Pause déjeuner — dégustation locale", mealCostLunch);
      cursor = addMinutesToTime(lunch, 90); // 60 min repas + 30 min battement
    }

    if (dayActs[1]) {
      const end = addMinutesToTime(cursor, dur(dayActs[1]));
      const a = dayActs[1];
      push(cursor, end, `${a.name}${a.description ? ` — ${a.description}` : ""}`, a.cost);
      cursor = addMinutesToTime(end, 30);
    }

    // Dîner : jamais avant 19:30.
    const dinner = laterTime(cursor, "19:30");
    push(dinner, addMinutesToTime(dinner, 90), "🍷 Dîner de clôture de l'étape et repos bien mérité", mealCostDinner);

    events.sort((a, b) => a.time.localeCompare(b.time));
    days.push({
      day: d,
      title: `Jour ${d} : Sélection de l'équipe à ${trip.selectedDestination}`,
      events,
    });
  }

  return days;
}

import { describe, it, expect } from "vitest";
import {
  buildEmptyItinerary,
  getMockDynamicItinerary,
  buildAutoPlanItinerary,
} from "./itinerary";
import type { Trip } from "../types";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Test",
    description: "",
    selectedDestination: "Rome",
    targetDays: 4,
    budgetType: "Modéré",
    members: [],
    availabilities: [],
    destinations: [],
    activities: [],
    itinerary: [],
    averageLodgingCostPerNight: 75,
    averageLocalTransportCostPerDay: 14,
    messages: [],
    documents: [],
    photos: [],
    externalTransportCost: 120,
    ...overrides,
  };
}

describe("buildEmptyItinerary", () => {
  it("crée N jours vides numérotés avec la destination dans le titre", () => {
    const it = buildEmptyItinerary(3, "Rome");
    expect(it).toHaveLength(3);
    expect(it[0]).toMatchObject({ day: 1, events: [] });
    expect(it[2].title).toContain("Rome");
  });
});

describe("getMockDynamicItinerary", () => {
  it("génère un itinéraire de la durée demandée avec des activités", () => {
    const r = getMockDynamicItinerary("Rome", 5, "Modéré");
    expect(r.itinerary).toHaveLength(5);
    expect(r.activities.length).toBeGreaterThan(0);
  });

  it("applique un hébergement plus cher en Luxe qu'en Économique", () => {
    const eco = getMockDynamicItinerary("Rome", 3, "Économique");
    const lux = getMockDynamicItinerary("Rome", 3, "Luxe");
    expect(lux.averageLodgingCostPerNight).toBeGreaterThan(
      eco.averageLodgingCostPerNight,
    );
  });
});

describe("buildAutoPlanItinerary", () => {
  /** Vrai si les créneaux [time,endTime) ne se chevauchent pas (triés par début). */
  function noOverlap(events: { time: string; endTime?: string }[]): boolean {
    for (let i = 1; i < events.length; i++) {
      const prevEnd = events[i - 1].endTime ?? events[i - 1].time;
      if (events[i].time < prevEnd) return false;
    }
    return true;
  }

  it("place l'activité la plus votée le matin et intercale les repas", () => {
    const trip = makeTrip({
      targetDays: 1,
      activities: [
        { id: "a1", name: "Peu votée", description: "d", cost: 5, category: "Visite", votes: ["m1"] },
        { id: "a2", name: "Très votée", description: "d", cost: 5, category: "Visite", votes: ["m1", "m2", "m3"] },
      ],
    });
    const plan = buildAutoPlanItinerary(trip);
    expect(plan).toHaveLength(1);

    const descriptions = plan[0].events.map((e) => e.description).join(" | ");
    expect(descriptions).toContain("Petit-déjeuner");
    expect(descriptions).toContain("Très votée");

    const morning = plan[0].events.find((e) => e.time === "10:00");
    expect(morning?.description).toContain("Très votée");
    // Chaque étape a une heure de fin et rien ne se chevauche.
    expect(plan[0].events.every((e) => !!e.endTime)).toBe(true);
    expect(noOverlap(plan[0].events)).toBe(true);
  });

  it("respecte la durée : une activité journée complète n'a ni 2e activité ni déjeuner séparé, sans chevauchement", () => {
    const trip = makeTrip({
      targetDays: 1,
      activities: [
        { id: "a1", name: "Excursion journée", description: "d", cost: 60, category: "Nature", votes: ["m1", "m2"], duration: "1 journée" },
        { id: "a2", name: "Autre visite", description: "d", cost: 10, category: "Visite", votes: ["m1"], duration: "2h" },
      ],
    });
    const plan = buildAutoPlanItinerary(trip);
    const day = plan[0];
    expect(noOverlap(day.events)).toBe(true);
    // Pas de déjeuner intercalé quand la journée est occupée par une excursion.
    expect(day.events.some((e) => e.description.includes("Pause déjeuner"))).toBe(false);
    // La 2e activité n'est pas casée le même jour (journée complète seule).
    expect(day.events.some((e) => e.description.includes("Autre visite"))).toBe(false);
    // L'excursion finit bien avant le dîner (≥ 19:30).
    const dinner = day.events.find((e) => e.description.includes("Dîner"));
    expect(dinner && dinner.time >= "19:30").toBe(true);
  });
});

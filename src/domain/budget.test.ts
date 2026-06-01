import { describe, it, expect } from "vitest";
import { computeBudgetBreakdown } from "./budget";
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

describe("computeBudgetBreakdown", () => {
  it("somme les coûts de tous les événements de l'itinéraire", () => {
    const trip = makeTrip({
      itinerary: [
        { day: 1, title: "J1", events: [
          { id: "e1", time: "10:00", description: "x", cost: 20 },
          { id: "e2", time: "12:00", description: "y", cost: 30 },
        ] },
        { day: 2, title: "J2", events: [
          { id: "e3", time: "10:00", description: "z", cost: 10 },
        ] },
      ],
    });
    expect(computeBudgetBreakdown(trip).activitiesCost).toBe(60);
  });

  it("calcule l'hébergement sur (jours - 1) nuits", () => {
    const b = computeBudgetBreakdown(makeTrip({ targetDays: 4, averageLodgingCostPerNight: 75 }));
    expect(b.totalLodging).toBe(3 * 75);
  });

  it("garantit au moins 1 nuit même pour un séjour d'1 jour", () => {
    const b = computeBudgetBreakdown(makeTrip({ targetDays: 1, averageLodgingCostPerNight: 50 }));
    expect(b.totalLodging).toBe(50);
  });

  it("transport local = jours × coût journalier", () => {
    const b = computeBudgetBreakdown(makeTrip({ targetDays: 4, averageLocalTransportCostPerDay: 14 }));
    expect(b.totalLocalTransport).toBe(56);
  });

  it("total individuel = activités + hébergement + transport local + vol", () => {
    const trip = makeTrip({
      targetDays: 4,
      averageLodgingCostPerNight: 75,
      averageLocalTransportCostPerDay: 14,
      externalTransportCost: 120,
      itinerary: [{ day: 1, title: "J1", events: [{ id: "e1", time: "10:00", description: "x", cost: 26 }] }],
    });
    const b = computeBudgetBreakdown(trip);
    expect(b.totalIndividual).toBe(26 + 225 + 56 + 120);
  });

  it("traite un coût de transport externe à 0 sans NaN", () => {
    const b = computeBudgetBreakdown(makeTrip({ externalTransportCost: 0 }));
    expect(b.flightCost).toBe(0);
    expect(Number.isNaN(b.totalIndividual)).toBe(false);
  });
});

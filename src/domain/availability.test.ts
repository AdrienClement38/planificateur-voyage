import { describe, it, expect } from "vitest";
import { findBestTravelWindow, buildDailyAvailabilityMap } from "./availability";
import type { Availability } from "../types";

describe("buildDailyAvailabilityMap", () => {
  it("liste les membres disponibles par jour sans doublon", () => {
    const map = buildDailyAvailabilityMap([
      { id: "a1", memberId: "m1", start: "2026-07-10", end: "2026-07-11" },
      { id: "a2", memberId: "m2", start: "2026-07-11", end: "2026-07-11" },
    ]);
    expect(map["2026-07-10"]).toEqual(["m1"]);
    expect([...map["2026-07-11"]].sort()).toEqual(["m1", "m2"]);
  });

  it("borne les intervalles aberrants via maxDaysPerRange", () => {
    const map = buildDailyAvailabilityMap(
      [{ id: "a1", memberId: "m1", start: "2026-01-01", end: "2030-01-01" }],
      5,
    );
    expect(Object.keys(map)).toHaveLength(5);
  });
});

describe("findBestTravelWindow", () => {
  it("renvoie le fallback si aucune disponibilité", () => {
    expect(findBestTravelWindow([], 4)).toEqual({
      checkin: "2026-07-20",
      checkout: "2026-07-26",
    });
  });

  it("privilégie la fenêtre où le plus de membres sont disponibles tous les jours", () => {
    const av: Availability[] = [
      { id: "a1", memberId: "m1", start: "2026-07-10", end: "2026-07-14" },
      { id: "a2", memberId: "m2", start: "2026-07-12", end: "2026-07-16" },
    ];
    // Intersection commune (m1 ∩ m2) = 12,13,14 → meilleure fenêtre de 3 jours.
    expect(findBestTravelWindow(av, 3)).toEqual({
      checkin: "2026-07-12",
      checkout: "2026-07-14",
    });
  });
});

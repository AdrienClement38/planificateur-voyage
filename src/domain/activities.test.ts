import { describe, it, expect } from "vitest";
import {
  mergeActivitiesByName,
  buildFallbackActivities,
  type ActivitySeed,
} from "./activities";
import type { ActivityProposal } from "../types";

function act(name: string, overrides: Partial<ActivityProposal> = {}): ActivityProposal {
  return { id: name, name, description: "", cost: 10, category: "Visite", votes: [], ...overrides };
}

describe("mergeActivitiesByName", () => {
  it("ajoute les activités absentes", () => {
    const merged = mergeActivitiesByName([act("Tour Eiffel")], [act("Louvre")]);
    expect(merged).toHaveLength(2);
  });

  it("déduplique par nom, insensible à la casse et aux espaces de bord", () => {
    const merged = mergeActivitiesByName(
      [act("Tour Eiffel", { id: "keep" })],
      [act("  tour eiffel ", { id: "drop", cost: 99 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("keep");
  });

  it("préserve l'ordre : existantes d'abord, nouvelles ensuite", () => {
    const merged = mergeActivitiesByName([act("A")], [act("B"), act("C")]);
    expect(merged.map((m) => m.name)).toEqual(["A", "B", "C"]);
  });
});

describe("buildFallbackActivities", () => {
  const ctx = {
    destination: "Lisbonne",
    adults: 6,
    checkin: "2026-07-20",
    checkout: "2026-07-26",
    memberId: "m1",
  };
  const seeds: ActivitySeed[] = [
    { name: "A", description: "", cost: 10, category: "Visite" },
    { name: "B", description: "", cost: 20, category: "Culture" },
    { name: "C", description: "", cost: 0, category: "Nature" },
  ];

  it("répartit les sources GYG / Airbnb / Google cycliquement", () => {
    const res = buildFallbackActivities(seeds, ctx);
    expect(res.map((r) => r.source)).toEqual([
      "GetYourGuide",
      "Airbnb Expériences",
      "Google Activités",
    ]);
  });

  it("ajoute le membre courant aux votes et un lien de réservation https", () => {
    const res = buildFallbackActivities([seeds[0]], ctx);
    expect(res[0].votes).toContain("m1");
    expect(res[0].bookingUrl).toMatch(/^https:\/\//);
  });
});

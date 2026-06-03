import { describe, it, expect } from "vitest";
import {
  parseDurationToMinutes,
  addMinutesToTime,
  computeEndTime,
  isValidTime,
} from "./schedule";

describe("parseDurationToMinutes", () => {
  it("lit les heures simples", () => {
    expect(parseDurationToMinutes("2h")).toBe(120);
    expect(parseDurationToMinutes("2 h")).toBe(120);
    expect(parseDurationToMinutes("2 heures")).toBe(120);
    expect(parseDurationToMinutes("1 heure")).toBe(60);
  });

  it("lit les heures + minutes", () => {
    expect(parseDurationToMinutes("1h30")).toBe(90);
    expect(parseDurationToMinutes("1h30min")).toBe(90);
    expect(parseDurationToMinutes("2h15")).toBe(135);
  });

  it("prend la première valeur d'une plage", () => {
    expect(parseDurationToMinutes("2h – 3h")).toBe(120);
    expect(parseDurationToMinutes("2h - 3h")).toBe(120);
  });

  it("lit les minutes seules", () => {
    expect(parseDurationToMinutes("90 min")).toBe(90);
    expect(parseDurationToMinutes("45 minutes")).toBe(45);
    expect(parseDurationToMinutes("30 mn")).toBe(30);
  });

  it("gère la journée / demi-journée (avec ou sans accent)", () => {
    expect(parseDurationToMinutes("1 journée")).toBe(480);
    expect(parseDurationToMinutes("journee complète")).toBe(480);
    expect(parseDurationToMinutes("demi-journée")).toBe(240);
  });

  it("renvoie null si illisible ou vide", () => {
    expect(parseDurationToMinutes("Visite libre")).toBeNull();
    expect(parseDurationToMinutes("")).toBeNull();
    expect(parseDurationToMinutes(undefined)).toBeNull();
    expect(parseDurationToMinutes(null)).toBeNull();
  });
});

describe("addMinutesToTime", () => {
  it("ajoute des minutes simplement", () => {
    expect(addMinutesToTime("10:00", 60)).toBe("11:00");
    expect(addMinutesToTime("10:00", 90)).toBe("11:30");
    expect(addMinutesToTime("10:45", 30)).toBe("11:15");
  });

  it("borne à 23:59 sans passer au lendemain", () => {
    expect(addMinutesToTime("23:00", 120)).toBe("23:59");
  });

  it("renvoie l'entrée si format invalide", () => {
    expect(addMinutesToTime("midi", 60)).toBe("midi");
  });
});

describe("computeEndTime", () => {
  it("calcule la fin depuis une durée connue", () => {
    expect(computeEndTime("10:00", "2h")).toEqual({
      endTime: "12:00",
      estimated: false,
      minutes: 120,
    });
  });

  it("retombe sur +1h et marque estimé si durée inconnue", () => {
    const r = computeEndTime("10:00", "Visite libre");
    expect(r.endTime).toBe("11:00");
    expect(r.estimated).toBe(true);
    expect(r.minutes).toBe(60);
  });
});

describe("isValidTime", () => {
  it("valide les heures correctes", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("9:05")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });
  it("rejette les heures incorrectes", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("10:60")).toBe(false);
    expect(isValidTime("midi")).toBe(false);
  });
});

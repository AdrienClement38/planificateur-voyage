import { describe, it, expect } from "vitest";
import {
  parseDurationToMinutes,
  addMinutesToTime,
  computeEndTime,
  isValidTime,
  slotsOverlap,
  findConflictingEvent,
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

describe("slotsOverlap", () => {
  it("détecte un chevauchement", () => {
    expect(slotsOverlap("10:00", "12:00", "11:00", "13:00")).toBe(true);
    expect(slotsOverlap("10:00", "18:30", "14:00", "15:00")).toBe(true); // inclus
  });
  it("autorise les créneaux adjacents", () => {
    expect(slotsOverlap("11:00", "12:00", "12:00", "13:00")).toBe(false);
    expect(slotsOverlap("10:00", "11:00", "09:00", "10:00")).toBe(false);
  });
  it("autorise les créneaux disjoints", () => {
    expect(slotsOverlap("10:00", "11:00", "14:00", "15:00")).toBe(false);
  });
  it("traite une fin absente comme un instant", () => {
    expect(slotsOverlap("12:00", undefined, "10:00", "18:00")).toBe(true); // point dans le créneau
    expect(slotsOverlap("19:00", undefined, "10:00", "18:00")).toBe(false);
  });
});

describe("findConflictingEvent", () => {
  const events = [
    { id: "a", time: "10:00", endTime: "18:30", description: "Excursion" },
    { id: "b", time: "20:00", endTime: "22:00", description: "Dîner" },
  ];
  it("renvoie l'étape en conflit", () => {
    expect(findConflictingEvent(events, "14:00", "15:00")?.id).toBe("a");
  });
  it("renvoie null si le créneau est libre", () => {
    expect(findConflictingEvent(events, "18:30", "19:30")).toBeNull();
  });
  it("ignore l'étape en cours d'édition", () => {
    expect(findConflictingEvent(events, "10:00", "18:30", "a")).toBeNull();
  });
});

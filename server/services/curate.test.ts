import { describe, it, expect } from "vitest";
import { curate } from "./places";
import type { PlaceActivity } from "./core";

/**
 * Tests DÉTERMINISTES (sans réseau) de la curation finale. Garantit l'invariant
 * critique : le fix « combler jusqu'à 50 » n'ajoute QU'EN QUEUE → le TOP de liste
 * (donc les vérités du banc, qui portent sur le top 15) est strictement préservé.
 */
const mk = (category: string, name: string): PlaceActivity => ({
  name,
  description: "",
  category: category as PlaceActivity["category"],
  duration: "1h",
  bookingUrl: "",
  provider: "test",
});

describe("curate", () => {
  it("comble jusqu'à 50 une ville mono-thème (le fix NYC : 57 « Visite » → 50)", () => {
    const pool = Array.from({ length: 60 }, (_, i) => mk("Visite", `v${i}`));
    const out = curate(pool);
    expect(out.length).toBe(50); // l'ancien passage unique aurait tronqué à 20
    expect(out.every((p) => p.category === "Visite")).toBe(true);
  });

  it("préserve le TOP de liste à l'identique quand rien ne déborde", () => {
    const cats = ["Visite", "Culture", "Nature", "Loisir"];
    const pool = Array.from({ length: 15 }, (_, i) => mk(cats[i % 4], `p${i}`));
    expect(curate(pool).slice(0, 15)).toEqual(pool.slice(0, 15));
  });

  it("préserve les 20 PREMIERS même quand une catégorie déborde (invariant banc)", () => {
    // 30 « Visite » puis 10 « Culture » : la tête reste l'ordre de notoriété du pool.
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => mk("Visite", `v${i}`)),
      ...Array.from({ length: 10 }, (_, i) => mk("Culture", `c${i}`)),
    ];
    const out = curate(pool);
    // Le top 20 est BYTE-IDENTIQUE au pool → le banc (top 15) ne peut pas bouger.
    expect(out.slice(0, 20)).toEqual(pool.slice(0, 20));
  });

  it("met le surplus d'une catégorie EN QUEUE (rien jeté), variété en tête", () => {
    const pool = [
      ...Array.from({ length: 30 }, (_, i) => mk("Visite", `v${i}`)),
      ...Array.from({ length: 10 }, (_, i) => mk("Culture", `c${i}`)),
    ];
    const out = curate(pool);
    expect(out.length).toBe(40); // 20 Visite (tête) + 10 Culture + 10 Visite (surplus)
    expect(out.slice(0, 20).every((p) => p.category === "Visite")).toBe(true);
    expect(out.slice(20, 30).every((p) => p.category === "Culture")).toBe(true);
    // Le surplus Visite (v20..v29) revient bien en queue, dans l'ordre, pas perdu.
    expect(out.slice(30).map((p) => p.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `v${20 + i}`),
    );
  });

  it("plafonne le total à 50 même avec beaucoup de catégories", () => {
    const cats = [
      "Visite",
      "Culture",
      "Nature",
      "Loisir",
      "Gastronomie",
      "Shopping",
    ];
    const pool = Array.from({ length: 100 }, (_, i) => mk(cats[i % 6], `p${i}`));
    expect(curate(pool).length).toBe(50);
  });

  it("laisse un petit pool intact (petites villes inchangées)", () => {
    const pool = Array.from({ length: 8 }, (_, i) => mk("Culture", `c${i}`));
    expect(curate(pool)).toEqual(pool);
  });
});

import { describe, it, expect } from "vitest";
import { dedupKey, isNearDup, distanceMeters, shareToken } from "./places";

/**
 * Tests DÉTERMINISTES (sans réseau) de la déduplication des suggestions. Garantit
 * qu'on fusionne les doublons RÉELS (même lieu, sources différentes) SANS jamais
 * fusionner deux lieux distincts.
 */
describe("dedupKey", () => {
  it("retire le suffixe avec la VILLE seule (dest « Ville, Pays »)", () => {
    // Le bug : avant, on cherchait « marseille france » → pas de fusion.
    const a = dedupKey("Vieux-Port de Marseille", "Marseille, France");
    const b = dedupKey("Vieux Port", "Marseille, France");
    expect(a).toBe("vieux port");
    expect(b).toBe("vieux port");
    expect(a).toBe(b); // → fusionnés par clé exacte
  });

  it("normalise (accents, ponctuation, parenthèses, suffixe destination)", () => {
    expect(dedupKey("Le Pâquier (Annecy)", "Annecy")).toBe("le paquier");
    expect(dedupKey("Cathédrale Saint-Pierre d'Annecy", "Annecy, France")).toBe(
      "cathedrale saint pierre",
    );
  });
});

describe("isNearDup", () => {
  it("fusionne un préfixe de TYPE (« basilique X » == « X »)", () => {
    expect(
      isNearDup("basilique notre dame de la garde", "notre dame de la garde"),
    ).toBe(true);
    expect(isNearDup("stade velodrome", "velodrome")).toBe(true);
  });

  it("fusionne un suffixe de TYPE transport (« X » == « X Terminal »)", () => {
    expect(isNearDup("grand central", "grand central terminal")).toBe(true);
    expect(isNearDup("penn", "penn station")).toBe(true);
  });

  it("fusionne un qualificatif de région (préfixe long + « de … »)", () => {
    expect(
      isNearDup(
        "musee de la resistance et de la deportation",
        "musee de la resistance et de la deportation de l isere",
      ),
    ).toBe(true);
  });

  it("ne fusionne JAMAIS deux lieux distincts", () => {
    // « aux Liens » distingue deux églises de Rome (suffixe ≠ qualificatif « de »)
    expect(
      isNearDup("basilique saint pierre", "basilique saint pierre aux liens"),
    ).toBe(false);
    // l'Ombrière est un AUTRE lieu que le Vieux-Port (préfixe « ombriere du » ≠ type)
    expect(isNearDup("ombriere du vieux port", "vieux port")).toBe(false);
    // musée ≠ galerie du même sujet
    expect(isNearDup("musee d art moderne", "galerie d art moderne")).toBe(
      false,
    );
    // suffixe non-transport (« Square ») → distincts
    expect(isNearDup("union", "union square")).toBe(false);
    // « Musée d'Art » vs « Musée d'Art Moderne » : suffixe court mais pas « de … »
    expect(isNearDup("musee d art", "musee d art moderne")).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("0 pour le même point, ~111 m pour 0,001° de latitude", () => {
    expect(distanceMeters(48.8, 2.3, 48.8, 2.3)).toBe(0);
    const d = distanceMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe("shareToken", () => {
  it("vrai si un mot ≥ 4 lettres est commun", () => {
    expect(shareToken("musee guggenheim", "musee solomon r guggenheim")).toBe(
      true,
    );
    expect(shareToken("grand central", "grand central terminal")).toBe(true);
  });
  it("faux sinon (lieux distincts voisins, noms sans rapport)", () => {
    expect(shareToken("le pont", "la gare")).toBe(false);
    expect(shareToken("louvre", "tour eiffel")).toBe(false);
  });
});

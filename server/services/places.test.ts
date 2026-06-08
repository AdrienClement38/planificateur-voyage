import { describe, it, expect } from "vitest";
import { photonToCitySuggestions } from "./places";

/**
 * Tests de la transformation PURE de la réponse Photon → suggestions de villes.
 * Fixtures calquées sur la vraie forme GeoJSON de Photon (komoot, vérifiée en
 * direct) : on couvre le filtrage par calque `type==="city"`, l'exclusion des
 * POI/gares/aéroports, le classement ville > village et la déduplication — sans
 * aucun appel réseau.
 */
describe("photonToCitySuggestions", () => {
  it("classe la VILLE avant le village quasi-homonyme et construit « Ville, Pays »", () => {
    const data = {
      type: "FeatureCollection",
      features: [
        // Photon renvoie le village EN PREMIER pour le préfixe « Barce »…
        {
          properties: {
            osm_key: "place",
            osm_value: "village",
            type: "city",
            name: "Barceo",
            country: "Espagne",
            countrycode: "es",
          },
          geometry: { type: "Point", coordinates: [-6.45, 41.06] },
        },
        // …mais c'est la vraie ville qu'on veut en tête.
        {
          properties: {
            osm_key: "place",
            osm_value: "city",
            type: "city",
            name: "Barcelone",
            country: "Espagne",
            countrycode: "es",
            state: "Catalogne",
          },
          geometry: { type: "Point", coordinates: [2.17, 41.38] },
        },
      ],
    };

    const out = photonToCitySuggestions(data);
    expect(out.map((s) => s.label)).toEqual([
      "Barcelone, Espagne", // ville (rang 0) remontée devant…
      "Barceo, Espagne", // …le village (rang 2)
    ]);
    expect(out[0]).toMatchObject({
      name: "Barcelone",
      country: "Espagne",
      countryCode: "ES", // normalisé en majuscules
      region: "Catalogne",
      lat: 41.38,
      lon: 2.17,
    });
  });

  it("garde la métropole taguée place=province (type=city) en tête, devant un village", () => {
    // Tokyo est OSM place=province mais Photon le normalise type=city : il doit
    // rester prioritaire (rang « notable »), pas être doublé par un village.
    const out = photonToCitySuggestions({
      features: [
        {
          properties: {
            osm_key: "place",
            osm_value: "province",
            type: "city",
            name: "Tokyo",
            country: "Japon",
          },
          geometry: { coordinates: [139.69, 35.69] },
        },
        {
          properties: {
            osm_key: "place",
            osm_value: "village",
            type: "city",
            name: "Tokio",
            country: "Ukraine",
          },
          geometry: { coordinates: [37.0, 47.0] },
        },
      ],
    });
    expect(out[0].label).toBe("Tokyo, Japon");
  });

  it("exclut les POI, gares et aéroports (type ≠ city), dont Haneda tagué place=island", () => {
    const out = photonToCitySuggestions({
      features: [
        {
          properties: {
            osm_key: "leisure",
            osm_value: "stadium",
            type: "house",
            name: "Tokyo Dome",
            country: "Japon",
          },
          geometry: { coordinates: [139.7, 35.7] },
        },
        {
          properties: {
            osm_key: "railway",
            osm_value: "station",
            type: "house",
            name: "Tokyo",
            country: "Japon",
          },
          geometry: { coordinates: [139.7, 35.6] },
        },
        // Aéroport de Haneda : tagué place=island mais type=house → écarté.
        {
          properties: {
            osm_key: "place",
            osm_value: "island",
            type: "house",
            name: "Aéroport International de Tokyo",
            country: "Japon",
          },
          geometry: { coordinates: [139.78, 35.55] },
        },
        {
          properties: {
            osm_key: "place",
            osm_value: "country",
            type: "country",
            name: "Japon",
            country: "Japon",
          },
          geometry: { coordinates: [138, 38] },
        },
      ],
    });
    expect(out).toEqual([]);
  });

  it("déduplique par label et ignore les entrées sans nom/coordonnées", () => {
    const out = photonToCitySuggestions({
      features: [
        {
          properties: {
            osm_key: "place",
            osm_value: "town",
            type: "city",
            name: "Chamonix-Mont-Blanc",
            country: "France",
          },
          geometry: { coordinates: [6.86, 45.92] },
        },
        // même label → dédupliqué
        {
          properties: {
            osm_key: "place",
            osm_value: "town",
            type: "city",
            name: "Chamonix-Mont-Blanc",
            country: "France",
          },
          geometry: { coordinates: [6.87, 45.93] },
        },
        // sans coordonnées → ignoré
        {
          properties: {
            osm_key: "place",
            osm_value: "city",
            type: "city",
            name: "SansCoord",
            country: "France",
          },
        },
        // sans nom → ignoré
        {
          properties: {
            osm_key: "place",
            osm_value: "city",
            type: "city",
            country: "France",
          },
          geometry: { coordinates: [1, 2] },
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("Chamonix-Mont-Blanc, France");
  });

  it("retombe sur le nom seul quand le pays est absent", () => {
    const out = photonToCitySuggestions({
      features: [
        {
          properties: {
            osm_key: "place",
            osm_value: "city",
            type: "city",
            name: "Singapour",
          },
          geometry: { coordinates: [103.8, 1.35] },
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("Singapour");
    expect(out[0].country).toBeUndefined();
  });

  it("renvoie [] pour une charge utile invalide", () => {
    expect(photonToCitySuggestions(null)).toEqual([]);
    expect(photonToCitySuggestions({})).toEqual([]);
    expect(photonToCitySuggestions({ features: "nope" })).toEqual([]);
  });

  it("met le DÉPARTEMENT dans le label des communes homonymes (désambiguïse le géocodage)", () => {
    const out = photonToCitySuggestions({
      features: [
        // Viviers en Ardèche (commune) → département dans le label
        {
          properties: {
            osm_key: "place",
            osm_value: "town",
            type: "city",
            name: "Viviers",
            country: "France",
            state: "Auvergne-Rhône-Alpes",
            county: "Ardèche",
          },
          geometry: { coordinates: [4.7, 44.48] },
        },
        // Viviers en Moselle (autre commune homonyme) → gardée DISTINCTE (plus de fusion)
        {
          properties: {
            osm_key: "place",
            osm_value: "village",
            type: "city",
            name: "Viviers",
            country: "France",
            state: "Grand Est",
            county: "Moselle",
          },
          geometry: { coordinates: [6.5, 48.9] },
        },
        // Grande ville → label PROPRE, sans département
        {
          properties: {
            osm_key: "place",
            osm_value: "city",
            type: "city",
            name: "Lyon",
            country: "France",
            state: "Auvergne-Rhône-Alpes",
            county: "Métropole de Lyon",
          },
          geometry: { coordinates: [4.83, 45.76] },
        },
      ],
    });
    const labels = out.map((c) => c.label);
    expect(labels).toContain("Viviers, Ardèche, France"); // commune désambiguïsée
    expect(labels).toContain("Viviers, Moselle, France"); // l'homonyme, gardé distinct
    expect(labels).toContain("Lyon, France"); // grande ville : pas de département
    // Le sous-titre (region) = la région seule (le dépt est déjà dans le label).
    expect(
      out.find((c) => c.label === "Viviers, Ardèche, France")?.region,
    ).toBe("Auvergne-Rhône-Alpes");
  });
});

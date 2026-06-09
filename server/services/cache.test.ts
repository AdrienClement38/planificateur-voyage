import { describe, it, expect } from "vitest";
import { capMap } from "./cache";

describe("capMap", () => {
  it("ne touche à rien sous le plafond", () => {
    const m = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    capMap(m, 5);
    expect([...m.keys()]).toEqual(["a", "b"]);
  });

  it("évince les plus ANCIENNES entrées au-delà du plafond (FIFO)", () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 10; i++) m.set(`k${i}`, i);
    capMap(m, 3);
    expect(m.size).toBe(3);
    expect([...m.keys()]).toEqual(["k7", "k8", "k9"]); // les 3 plus récentes restent
  });

  it("gère un plafond de 0 (vide tout) sans boucler", () => {
    const m = new Map([["a", 1]]);
    capMap(m, 0);
    expect(m.size).toBe(0);
  });

  it("est idempotent (un 2e appel ne change rien)", () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 5; i++) m.set(`k${i}`, i);
    capMap(m, 2);
    capMap(m, 2);
    expect(m.size).toBe(2);
    expect([...m.keys()]).toEqual(["k3", "k4"]);
  });
});

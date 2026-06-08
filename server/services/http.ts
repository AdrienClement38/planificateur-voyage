/**
 * Helpers HTTP partagés par les modules de découverte (geo, sources Wikidata/
 * Wikipédia/OSM…). Isolés ici pour une seule raison : tout le reste du moteur
 * dépend de ces deux primitives, donc les sortir des « god-files » casse la
 * dépendance circulaire qui apparaîtrait sinon entre `geo.ts` et `places.ts`.
 */

// Wikimedia exige un User-Agent identifiable avec contact (réduit le throttling).
export const UA =
  "Co-Tripper/1.0 (https://co-tripper.example; contact@co-tripper.example)";

/**
 * GET JSON tolérant à l'échec : timeout dur (AbortController), renvoie `null` sur
 * toute erreur (réseau, statut ≠ 2xx, JSON invalide) au lieu de jeter. L'appelant
 * traite `null` comme « source indisponible » → dégradation gracieuse, jamais de
 * crash. C'est la brique de robustesse de tout le moteur de suggestions.
 */
export async function fetchJson(
  url: string,
  ms = 6000,
): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

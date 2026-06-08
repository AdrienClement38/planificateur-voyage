/**
 * Enrichissement des lieux par de VRAIES descriptions Wikipédia (intros FR).
 * `fetchExtracts` récupère, en un seul appel, les 2 premières phrases d'intro
 * d'une liste de titres — partagé par plusieurs sources (Overpass, Wikipédia)
 * pour donner une description factuelle, jamais inventée (titre sans intro →
 * description de repli neutre côté appelant).
 */
import { fetchJson } from "./http";

/** Récupère les intros Wikipédia (fr) pour une liste de titres, en un appel. */
export async function fetchExtracts(
  titles: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (titles.length === 0) return out;
  const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exsentences=2&redirects=1&titles=${encodeURIComponent(
    titles.join("|"),
  )}&format=json`;
  const data = (await fetchJson(url)) as {
    query?: { pages?: Record<string, { title?: string; extract?: string }> };
  } | null;
  for (const p of Object.values(data?.query?.pages ?? {})) {
    if (p.title && p.extract) out[p.title] = p.extract;
  }
  return out;
}

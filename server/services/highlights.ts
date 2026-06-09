/**
 * « Œuvres à voir » dans un lieu (musée, chapelle, cathédrale…), via Wikidata.
 * Fonctionnalité DISTINCTE des suggestions d'activités : pour un lot de lieux,
 * renvoie les œuvres majeures qui s'y trouvent (P276 emplacement / P195 collection),
 * filtrées par notoriété (≥5 sitelinks). 100 % données réelles, rien d'inventé.
 * Utilisé par la route /api ; n'intervient PAS dans le classement des activités.
 */
import { fetchJson } from "./http";

export interface PlaceHighlight {
  /** Nom de l'œuvre (FR). */
  name: string;
  /** Photo réelle (Commons), sinon undefined. */
  imageUrl?: string;
}

// Types « œuvre d'art » acceptés (peinture, fresque, sculpture, statue, œuvre
// d'art, œuvre visuelle, + « groupe de peintures » : pour les chefs-d'œuvre en
// plusieurs versions comme Le Cri, dont la notoriété est portée par l'entité
// « groupe », les versions physiques étant quasi inconnues sur Wikipédia).
// Liste DIRECTE (pas de P279*) = requête rapide.
const WD_ART_TYPES = [
  "wd:Q3305213",
  "wd:Q22669139",
  "wd:Q860861",
  "wd:Q179700",
  "wd:Q838948",
  "wd:Q4502142",
  "wd:Q18573970",
];

const highlightsCache = new Map<
  string,
  { at: number; items: PlaceHighlight[]; ttl: number }
>();
const HL_TTL = 6 * 60 * 60 * 1000; // 6 h
const HL_TTL_EMPTY = 30 * 60 * 1000; // 30 min si vide/échec (auto-réparation)

/**
 * Œuvres majeures à voir DANS des lieux (musée, chapelle, cathédrale…), en LOT.
 * S'appuie sur Wikidata : une œuvre déclare son lieu via P276 (emplacement) ou
 * P195 (collection) — 100 % données réelles, rien d'inventé. Seuil de notoriété
 * (≥5 langues) : on ne garde que les œuvres qui valent vraiment le détour, et la
 * requête reste rapide même pour les musées immenses (la Galerie Borghèse a 184
 * œuvres, dont l'écrasante majorité d'inconnues). Renvoie une map
 * { nomDuLieu → œuvres }, tableau vide si le lieu n'a aucune œuvre notable.
 */
export async function discoverPlaceHighlightsBatch(
  names: string[],
): Promise<Record<string, PlaceHighlight[]>> {
  const out: Record<string, PlaceHighlight[]> = {};
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const missing: string[] = [];
  for (const name of uniq) {
    const hit = highlightsCache.get(name.toLowerCase());
    if (hit && Date.now() - hit.at < hit.ttl) out[name] = hit.items;
    else missing.push(name);
  }
  if (missing.length === 0) return out;

  // Une requête par paquet de 12 lieux, en parallèle : chaque requête reste
  // bornée (~1 s) et un musée géant ne fait pas exploser un gros lot.
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 12)
    chunks.push(missing.slice(i, i + 12));
  const maps = await Promise.all(chunks.map((c) => highlightsChunk(c)));
  const merged = new Map<string, PlaceHighlight[]>();
  for (const m of maps) for (const [k, v] of m) merged.set(k, v);

  for (const name of missing) {
    const items = merged.get(name.toLowerCase()) ?? [];
    out[name] = items;
    highlightsCache.set(name.toLowerCase(), {
      at: Date.now(),
      items,
      ttl: items.length ? HL_TTL : HL_TTL_EMPTY,
    });
  }
  return out;
}

/** Une requête groupée pour ≤12 lieux → map { nomLieu(minuscule) → top 6 œuvres }. */
async function highlightsChunk(
  names: string[],
): Promise<Map<string, PlaceHighlight[]>> {
  const result = new Map<string, PlaceHighlight[]>();
  if (names.length === 0) return result;
  // Labels @fr (INDEXÉS → rapide). Littéral sûr : on neutralise guillemets/antislash.
  const vals = names.map((n) => `"${n.replace(/[\\"]/g, " ")}"@fr`).join(" ");
  const sparql =
    `SELECT DISTINCT ?lbl ?artLabel ?img ?sl WHERE {` +
    `VALUES ?lbl { ${vals} }` +
    `?place rdfs:label ?lbl.` +
    // Œuvre rattachée au lieu : emplacement (P276), collection (P195) — y compris
    // une SOUS-collection « partie de » l'institution (P361*, ex. La Joconde dont
    // la collection est le « département des peintures » du Louvre) — OU via une
    // de ses PARTIES (P527 : chefs-d'œuvre en plusieurs versions, ex. Le Cri au
    // musée Munch dont les versions physiques sont à sl 2, invisibles sinon).
    `?art (wdt:P276|wdt:P195/wdt:P361*|wdt:P527/wdt:P276|wdt:P527/wdt:P195/wdt:P361*) ?place.` +
    `?art wdt:P31 ?t. VALUES ?t { ${WD_ART_TYPES.join(" ")} }` +
    `?art wikibase:sitelinks ?sl. FILTER(?sl >= 5)` +
    `OPTIONAL { ?art wdt:P18 ?img. }` +
    `?art rdfs:label ?artLabel. FILTER(lang(?artLabel) = "fr")` +
    `} ORDER BY ?lbl DESC(?sl) LIMIT 400`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  // 15 s : le chemin sous-collection (P361*) sur un musée géant (Louvre) est lourd.
  const data = (await fetchJson(url, 15000)) as {
    results?: {
      bindings?: Array<{
        lbl?: { value?: string };
        artLabel?: { value?: string };
        img?: { value?: string };
      }>;
    };
  } | null;

  const seen = new Map<string, Set<string>>();
  for (const b of data?.results?.bindings ?? []) {
    const lbl = b.lbl?.value?.toLowerCase();
    const artName = b.artLabel?.value?.trim();
    if (!lbl || !artName) continue;
    let items = result.get(lbl);
    if (!items) {
      items = [];
      result.set(lbl, items);
      seen.set(lbl, new Set());
    }
    const dedup = seen.get(lbl)!;
    const ak = artName.toLowerCase();
    if (dedup.has(ak) || items.length >= 6) continue;
    dedup.add(ak);
    items.push({
      name: artName,
      imageUrl: b.img?.value
        ? b.img.value.replace(/^http:/, "https:") + "?width=320"
        : undefined,
    });
  }
  return result;
}

/**
 * Source : Wikivoyage (FR) — guide de voyage collaboratif, licence CC-BY-SA
 * (comme Wikipédia → stockable avec attribution). On extrait les listings
 * {{voir}} et {{faire}}, curated par des humains : ils donnent souvent un VRAI
 * lien officiel et une description, là où OSM ne livre qu'un POI brut. On écarte
 * les listings « pratiques » (offices de tourisme, admin, transport, santé…).
 */
import { fetchJson } from "./http";
import { mapsLink, type PlaceActivity } from "./core";
import { classifyTitle } from "./classify";

/** Nettoie le wikitexte (liens, templates, balises, gras) en texte simple. */
function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrait le contenu interne de chaque template {{name …}} (comptage d'accolades). */
function wvBlocks(wikitext: string, name: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`\\{\\{\\s*${name}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    let i = m.index + 2;
    let depth = 1;
    const start = i;
    while (i < wikitext.length && depth > 0) {
      const two = wikitext.slice(i, i + 2);
      if (two === "{{") {
        i += 2;
        depth++;
      } else if (two === "}}") {
        i += 2;
        depth--;
      } else {
        i++;
      }
    }
    blocks.push(wikitext.slice(start, i - 2));
    re.lastIndex = i;
  }
  return blocks;
}

/** Parse les paramètres |clé=valeur d'un bloc (en respectant {{}} et [[]] imbriqués). */
function wvFields(block: string): Record<string, string> {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < block.length; i++) {
    const two = block.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      cur += two;
      i++;
    } else if (two === "}}" || two === "]]") {
      if (depth > 0) depth--;
      cur += two;
      i++;
    } else if (block[i] === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += block[i];
    }
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0)
      out[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return out;
}

async function wvWikitext(title: string): Promise<string | null> {
  const url = `https://fr.wikivoyage.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(
    title,
  )}&format=json`;
  const data = (await fetchJson(url)) as {
    query?: {
      pages?: Record<
        string,
        { revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }
      >;
    };
  } | null;
  const page = Object.values(data?.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

// Listings « pratiques » à écarter (offices de tourisme, admin, transport, santé…) :
// ce ne sont pas des activités à planifier.
const WV_BLOCK =
  /office de tourisme|information[s]? touristique|syndicat d'initiative|maison du tourisme|pr[ée]fecture|sous-pr[ée]fecture|\bmairie\b|h[ôo]tel de ville|consulat|ambassade|\bgare\b|gare routi[èe]re|a[ée]roport|\bparking\b|station-service|station service|h[ôo]pital|clinique|pharmacie|\bla poste\b|bureau de poste|commissariat|gendarmerie|\bbanque\b|distributeur|bureau de change|laverie|location de v[ée]lo|\btaxi\b|supermarch[ée]|\blyc[ée]e\b|\bcoll[èe]ge\b|universit[ée]|palais de justice|\btribunal\b/i;

export async function discoverWikivoyage(
  destination: string,
): Promise<PlaceActivity[]> {
  const q = destination.split(/[,(]/)[0].trim();
  // Essai direct par titre (gère les redirections) ; sinon, recherche plein texte.
  let wikitext = await wvWikitext(q);
  if (!wikitext) {
    const sUrl = `https://fr.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q,
    )}&srlimit=1&format=json`;
    const sd = (await fetchJson(sUrl)) as {
      query?: { search?: Array<{ title: string }> };
    } | null;
    const title = sd?.query?.search?.[0]?.title;
    if (title) wikitext = await wvWikitext(title);
  }
  if (!wikitext) return [];
  const wt = wikitext;

  const out: PlaceActivity[] = [];
  const seen = new Set<string>();
  const collect = (tpl: string, isActivity: boolean) => {
    for (const block of wvBlocks(wt, tpl)) {
      const f = wvFields(block);
      const name = stripWiki(f["nom"] || "");
      const k = name.toLowerCase();
      if (name.length < 2 || seen.has(k) || WV_BLOCK.test(k)) continue;
      seen.add(k);
      const guess = classifyTitle(name);
      // {{faire}} = activité → Loisir par défaut si le nom ne dit rien de précis.
      const generic = guess.category === "Visite";
      const lat = parseFloat(f["latitude"] ?? "");
      const lon = parseFloat(f["longitude"] ?? "");
      out.push({
        name,
        description: (
          stripWiki(f["description"] || "") ||
          stripWiki(f["adresse"] || "") ||
          `Lieu réel à découvrir à ${destination}.`
        ).slice(0, 240),
        category: isActivity && generic ? "Loisir" : guess.category,
        duration: isActivity && generic ? "demi-journée" : guess.duration,
        bookingUrl: mapsLink(name, destination),
        provider: "Wikivoyage",
        wikiTitle:
          stripWiki(f["wikipédia"] || f["wikipedia"] || "") || undefined,
        lat: Number.isFinite(lat) ? lat : undefined,
        lon: Number.isFinite(lon) ? lon : undefined,
      });
    }
  };
  collect("voir", false);
  collect("faire", true);
  return out.slice(0, 18);
}

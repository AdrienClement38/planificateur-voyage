/**
 * Source (clé optionnelle) : Foursquare Places. N'apporte de VRAIS lieux que si
 * `FOURSQUARE_API_KEY` est défini (sinon renvoie `[]` sans bruit). Sa valeur :
 * capter ce qu'OSM/Wikipédia ratent (spas, luge, parcs, téléphériques…). Niveau
 * gratuit = nom/catégorie/site web uniquement — note/photo « Premium » payantes
 * NON demandées (zéro donnée inventée).
 */
import { mapsLink, type Cat, type PlaceActivity } from "./core";

// Catégorie Foursquare (nom lisible) → notre taxonomie. Large, pour bien capter
// les lieux que OSM/Wikipédia ratent (spas, luge, parcs, téléphériques…).
function fsqCategory(cats: Array<{ name?: string }> | undefined): Cat {
  const n = (cats?.[0]?.name || "").toLowerCase();
  if (/spa|bath|sauna|wellness|massage|hammam|thermal|therme|onsen/.test(n))
    return "Bien-être";
  if (
    /museum|gallery|\bart\b|theater|theatre|historic|monument|church|temple|cathedral|mosque|synagogue|landmark|memorial|castle|palace|heritage|cultural|library|exhibit|opera/.test(
      n,
    )
  )
    return "Culture";
  if (
    /park|garden|mountain|lake|beach|trail|scenic|nature|forest|waterfall|\bhill\b|valley|river|island|\bcave\b|viewpoint|lookout|botanical|reserve|glacier/.test(
      n,
    )
  )
    return "Nature";
  if (
    /amusement|aquarium|\bzoo\b|cable car|funicular|gondola|cog railway|\bski\b|climb|water park|theme|luge|toboggan|playground|recreation|golf|bowling|arcade|stadium|arena|adventure|rafting|kayak|\bboat\b|cruise|entertainment/.test(
      n,
    )
  )
    return "Loisir";
  if (
    /restaurant|food|café|cafe|\bbar\b|bistro|brasserie|winery|brewery|eatery|diner/.test(
      n,
    )
  )
    return "Gastronomie";
  if (/shop|mall|store|boutique|market/.test(n)) return "Shopping";
  return "Visite";
}

// API Foursquare Places (v2025) : l'ancien /v3 a été déprécié le 15/05/2026.
// Endpoint places-api.foursquare.com, auth Bearer + en-tête de version daté.
// Niveau GRATUIT ("Places Pro") : nom, catégories, site web — note/photo sont
// des champs "Premium" payants, qu'on ne demande donc PAS (zéro donnée inventée).
// Foursquare apporte de VRAIS lieux absents d'OSM/Wikipédia (spas, luge, parcs).
// On écarte le bruit (commerces, restos, services non touristiques).
export async function discoverFoursquare(
  lat: number,
  lon: number,
  destination: string,
): Promise<PlaceActivity[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const fields = "fsq_place_id,name,categories,website,location";
    const url =
      `https://places-api.foursquare.com/places/search?ll=${lat},${lon}&radius=8000&limit=50` +
      `&fields=${encodeURIComponent(fields)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Places-Api-Version": "2025-06-17",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      results?: Array<{
        name?: string;
        categories?: Array<{ name?: string }>;
        website?: string;
        location?: { formatted_address?: string };
      }>;
    };
    const out: PlaceActivity[] = [];
    for (const p of j.results ?? []) {
      if (!p.name) continue;
      const category = fsqCategory(p.categories);
      // On ne garde que le touristique : on écarte "Visite" générique (commerces,
      // services), la restauration et le shopping (bruit pour un planning).
      if (
        category === "Visite" ||
        category === "Gastronomie" ||
        category === "Shopping"
      )
        continue;
      const catName = p.categories?.[0]?.name;
      out.push({
        name: p.name,
        description: (
          catName ||
          p.location?.formatted_address ||
          `Lieu réel à ${destination}.`
        ).slice(0, 240),
        category,
        duration: category === "Bien-être" ? "demi-journée" : "1h30",
        bookingUrl: mapsLink(p.name, destination),
        provider: "Foursquare",
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

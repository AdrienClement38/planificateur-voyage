import { uid } from "../lib/id";
import type { ActivityProposal } from "../types";

/** Une suggestion d'activité « brute » telle que produite hors-ligne. */
export interface ActivitySeed {
  name: string;
  description: string;
  cost: number;
  category: string;
}

/**
 * Fusionne deux listes d'activités en dédupliquant par nom (insensible à la
 * casse et aux espaces de bord). Les activités existantes sont préservées en
 * tête ; seules les nouvelles non déjà présentes sont ajoutées.
 */
export function mergeActivitiesByName(
  existing: ActivityProposal[],
  incoming: ActivityProposal[],
): ActivityProposal[] {
  const merged = [...existing];
  for (const inc of incoming) {
    const duplicate = existing.some(
      (e) => e.name.toLowerCase().trim() === inc.name.toLowerCase().trim(),
    );
    if (!duplicate) merged.push(inc);
  }
  return merged;
}

export interface FallbackContext {
  destination: string;
  adults: number;
  checkin: string;
  checkout: string;
  memberId: string;
}

/**
 * Transforme des suggestions brutes (repli hors-ligne quand le serveur est
 * injoignable) en `ActivityProposal` complètes, en répartissant cycliquement
 * les sources GetYourGuide / Airbnb / Google et en fabriquant un lien de
 * réservation plausible pour chacune.
 */
export function buildFallbackActivities(
  seeds: ActivitySeed[],
  ctx: FallbackContext,
): ActivityProposal[] {
  const isBarce = ctx.destination.toLowerCase().includes("barcelon");

  return seeds.map((a, i) => {
    const cleanName = a.name.replace(/[^\w\sÀ-ÿ]/gi, "").trim();
    let source: ActivityProposal["source"];
    let proposedBy = "";
    let bookingUrl = "";

    if (i % 3 === 0) {
      source = "GetYourGuide";
      proposedBy = "GetYourGuide 🎫";
      bookingUrl =
        isBarce && cleanName.toLowerCase().includes("sagrada")
          ? "https://www.getyourguide.fr/sagrada-familia-l2699/"
          : `https://www.getyourguide.fr/s/?q=${encodeURIComponent(ctx.destination + " " + cleanName)}`;
    } else if (i % 3 === 1) {
      source = "Airbnb Expériences";
      proposedBy = "Airbnb Expériences 🏠";
      bookingUrl =
        isBarce && cleanName.toLowerCase().includes("sagrada")
          ? `https://www.airbnb.fr/experiences/4527793?adults=${ctx.adults}&checkin=${ctx.checkin}&checkout=${ctx.checkout}&location=Barcelone%2C%20Espagne&currentTab=experience_tab&federatedSearchId=cdeb7f58-95c2-44dc-b657-1c2ca55ff964&sectionId=51d71af4-1887-4b5b-bda5-e5a52e26d961`
          : `https://www.airbnb.fr/s/${encodeURIComponent(ctx.destination)}/experiences?query=${encodeURIComponent(cleanName)}&adults=${ctx.adults}&checkin=${ctx.checkin}&checkout=${ctx.checkout}&refinement_paths%5B%5D=%2Fexperiences`;
    } else {
      source = "Google Activités";
      proposedBy = "Google Activités ✈️";
      const query = `Activités à découvrir à ${ctx.destination} ${cleanName}`;
      bookingUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&sa=X&sqi=2&bih=695&biw=1536&dpr=1.25#ttdcs=EAE`;
    }

    return {
      id: uid(`act-gen-fallback-${i}`),
      name: a.name,
      description: a.description,
      cost: a.cost,
      category: a.category,
      votes: [ctx.memberId],
      source,
      proposedBy,
      bookingUrl,
    };
  });
}

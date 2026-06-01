import type { Availability } from "../types";

export interface TravelWindow {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
}

const DEFAULT_WINDOW: TravelWindow = {
  checkin: "2026-07-20",
  checkout: "2026-07-26",
};

/** Normalise une date locale en chaîne `YYYY-MM-DD`. */
function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Construit, pour chaque jour couvert par au moins une disponibilité, la liste
 * des membres disponibles ce jour-là.
 *
 * Le garde-fou `maxDaysPerRange` borne les intervalles aberrants (ex. une
 * disponibilité de plusieurs années) pour éviter une boucle trop longue.
 */
export function buildDailyAvailabilityMap(
  availabilities: Availability[],
  maxDaysPerRange = 60,
): Record<string, string[]> {
  const dayMembers: Record<string, string[]> = {};
  for (const avail of availabilities) {
    const current = new Date(avail.start);
    const end = new Date(avail.end);
    let count = 0;
    while (current <= end && count < maxDaysPerRange) {
      const dateStr = toISODate(current);
      if (!dayMembers[dateStr]) dayMembers[dateStr] = [];
      if (!dayMembers[dateStr].includes(avail.memberId)) {
        dayMembers[dateStr].push(avail.memberId);
      }
      current.setDate(current.getDate() + 1);
      count++;
    }
  }
  return dayMembers;
}

/**
 * Trouve la meilleure fenêtre de `targetDays` jours consécutifs en privilégiant
 * d'abord le nombre de membres disponibles **tous les jours** de la fenêtre
 * (intersection), puis le nombre total de membres concernés (union).
 *
 * Fonction pure extraite de l'ancien `handleGenerateItinerary` ; sert à
 * pré-remplir les paramètres check-in / check-out des liens de réservation.
 */
export function findBestTravelWindow(
  availabilities: Availability[],
  targetDays: number,
  fallback: TravelWindow = DEFAULT_WINDOW,
): TravelWindow {
  if (!availabilities || availabilities.length === 0) return fallback;

  const dayMembers = buildDailyAvailabilityMap(availabilities);
  const activeDates = Object.keys(dayMembers).sort();
  if (activeDates.length === 0) return fallback;

  const neededDays = targetDays || 4;
  let bestScore = 0;
  let bestRange: string[] = [];

  for (let i = 0; i <= activeDates.length - neededDays; i++) {
    const candidateStart = new Date(activeDates[i]);
    const candidateRange: string[] = [];
    let intersection: string[] | null = null;
    const union = new Set<string>();

    for (let offset = 0; offset < neededDays; offset++) {
      const d = new Date(candidateStart);
      d.setDate(d.getDate() + offset);
      const dStr = toISODate(d);
      candidateRange.push(dStr);
      const members = dayMembers[dStr] || [];
      members.forEach((m) => union.add(m));
      intersection =
        intersection === null
          ? [...members]
          : intersection.filter((m) => members.includes(m));
    }

    const intersectCount = intersection ? intersection.length : 0;
    const score = intersectCount * 1000 + union.size;
    if (score > bestScore) {
      bestScore = score;
      bestRange = candidateRange;
    }
  }

  if (bestRange.length > 0) {
    return { checkin: bestRange[0], checkout: bestRange[bestRange.length - 1] };
  }
  return {
    checkin: availabilities[0].start,
    checkout: availabilities[0].end,
  };
}

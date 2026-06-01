import type { Trip } from "../types";

/** Décomposition du budget individuel estimé pour un voyage. */
export interface BudgetBreakdown {
  /** Somme du coût de tous les événements planifiés dans l'itinéraire. */
  activitiesCost: number;
  /** Hébergement = (jours − 1) nuits × coût moyen par nuit. */
  totalLodging: number;
  /** Transports locaux = jours × coût moyen journalier. */
  totalLocalTransport: number;
  /** Transport individuel A/R vers la destination (vol/train). */
  flightCost: number;
  /** Total individuel estimé. */
  totalIndividual: number;
}

/**
 * Calcule la répartition du budget individuel d'un voyage.
 * Fonction pure : aucune dépendance à React, directement testable et
 * mémoïsable côté composant.
 */
export function computeBudgetBreakdown(trip: Trip): BudgetBreakdown {
  let activitiesCost = 0;
  for (const day of trip.itinerary) {
    for (const ev of day.events) {
      activitiesCost += ev.cost;
    }
  }

  const totalNights = Math.max(trip.targetDays - 1, 1);
  const totalLodging = totalNights * trip.averageLodgingCostPerNight;
  const totalLocalTransport =
    trip.targetDays * trip.averageLocalTransportCostPerDay;
  const flightCost = trip.externalTransportCost || 0;

  const totalIndividual =
    activitiesCost + totalLodging + totalLocalTransport + flightCost;

  return {
    activitiesCost,
    totalLodging,
    totalLocalTransport,
    flightCost,
    totalIndividual,
  };
}

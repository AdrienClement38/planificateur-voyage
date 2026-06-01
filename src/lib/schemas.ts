/**
 * Schémas de validation runtime (Zod) pour les données persistées dans le
 * `localStorage`. Objectif : si la forme des données évolue entre deux
 * versions de l'app (ou si le stockage est corrompu/altéré), on détecte le
 * problème au chargement et on retombe proprement sur les données par défaut
 * au lieu de planter silencieusement à l'usage.
 *
 * Les types TS canoniques restent dans `src/types.ts`. Les assertions
 * `satisfies` en bas de fichier garantissent à la compilation que ces schémas
 * et ces types ne divergent pas.
 */
import { z } from "zod";
import type {
  Member,
  Availability,
  ProposedDestination,
  ActivityProposal,
  ItineraryEvent,
  ItineraryDay,
  ChatMessage,
  SharedDoc,
  SharedPhoto,
  Trip,
} from "../types";

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
});

export const availabilitySchema = z.object({
  id: z.string(),
  memberId: z.string(),
  start: z.string(),
  end: z.string(),
});

export const proposedDestinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  proposedBy: z.string(),
  votes: z.array(z.string()),
});

export const activityProposalSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost: z.number(),
  category: z.string(),
  proposedBy: z.string().optional(),
  votes: z.array(z.string()),
  source: z
    .enum(["GetYourGuide", "Airbnb Expériences", "Google Activités"])
    .optional(),
  rating: z.number().optional(),
  reviewsCount: z.number().optional(),
  duration: z.string().optional(),
  bookingUrl: z.string().optional(),
});

export const itineraryEventSchema = z.object({
  id: z.string(),
  time: z.string(),
  description: z.string(),
  cost: z.number(),
});

export const itineraryDaySchema = z.object({
  day: z.number(),
  title: z.string(),
  events: z.array(itineraryEventSchema),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  senderAvatar: z.string(),
  text: z.string(),
  timestamp: z.string(),
});

export const sharedDocSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["pdf", "image", "doc", "other"]),
  uploadedBy: z.string(),
  size: z.string(),
  date: z.string(),
  url: z.string().optional(),
});

export const sharedPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: z.string(),
  uploadedBy: z.string(),
  date: z.string(),
});

export const tripSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  selectedDestination: z.string(),
  targetDays: z.number(),
  budgetType: z.enum(["Économique", "Modéré", "Luxe"]),
  members: z.array(memberSchema),
  availabilities: z.array(availabilitySchema),
  destinations: z.array(proposedDestinationSchema),
  activities: z.array(activityProposalSchema),
  itinerary: z.array(itineraryDaySchema),
  averageLodgingCostPerNight: z.number(),
  averageLocalTransportCostPerDay: z.number(),
  messages: z.array(chatMessageSchema),
  documents: z.array(sharedDocSchema),
  photos: z.array(sharedPhotoSchema),
  externalTransportCost: z.number(),
});

export const tripsSchema = z.array(tripSchema);
export const membersSchema = z.array(memberSchema);

// --- Garde-fous de compilation : schémas ⇆ types ne doivent pas diverger ---
// `AssertAssignable<T, U>` exige `T extends U` ; instancié ci-dessous, il
// provoque une erreur `tsc` si la sortie d'un schéma cesse d'être assignable
// à l'interface correspondante (champ ajouté/retiré d'un seul côté).
type AssertAssignable<T extends U, U> = T;

type _AssertMember = AssertAssignable<z.infer<typeof memberSchema>, Member>;
type _AssertAvailability = AssertAssignable<z.infer<typeof availabilitySchema>, Availability>;
type _AssertDestination = AssertAssignable<z.infer<typeof proposedDestinationSchema>, ProposedDestination>;
type _AssertActivity = AssertAssignable<z.infer<typeof activityProposalSchema>, ActivityProposal>;
type _AssertEvent = AssertAssignable<z.infer<typeof itineraryEventSchema>, ItineraryEvent>;
type _AssertDay = AssertAssignable<z.infer<typeof itineraryDaySchema>, ItineraryDay>;
type _AssertMessage = AssertAssignable<z.infer<typeof chatMessageSchema>, ChatMessage>;
type _AssertDoc = AssertAssignable<z.infer<typeof sharedDocSchema>, SharedDoc>;
type _AssertPhoto = AssertAssignable<z.infer<typeof sharedPhotoSchema>, SharedPhoto>;
type _AssertTrip = AssertAssignable<z.infer<typeof tripSchema>, Trip>;

export interface Member {
  id: string;
  name: string;
  avatar: string;
}

export interface Availability {
  id: string;
  memberId: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface ProposedDestination {
  id: string;
  name: string;
  proposedBy: string; // Member Name
  votes: string[]; // Member IDs
}

export interface ActivityProposal {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  proposedBy?: string;
  votes: string[]; // Member IDs
  source?: "GetYourGuide" | "Airbnb Expériences" | "Google Activités";
  rating?: number;
  reviewsCount?: number;
  duration?: string;
  bookingUrl?: string;
  imageUrl?: string;
}

export interface ItineraryEvent {
  id: string;
  time: string;
  /** Heure de fin "HH:MM" (optionnelle). */
  endTime?: string;
  description: string;
  cost: number;
  /** Lien de l'offre/booking, conservé depuis la suggestion (optionnel). */
  bookingUrl?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  events: ItineraryEvent[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
}

export interface SharedDoc {
  id: string;
  name: string;
  type: "pdf" | "image" | "doc" | "other";
  uploadedBy: string;
  size: string;
  date: string;
  url?: string;
}

export interface SharedPhoto {
  id: string;
  url: string;
  caption: string;
  uploadedBy: string;
  date: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  selectedDestination: string; // Winning destination
  targetDays: number;
  budgetType: "Économique" | "Modéré" | "Luxe";
  members: Member[];
  availabilities: Availability[];
  destinations: ProposedDestination[];
  activities: ActivityProposal[];
  itinerary: ItineraryDay[];
  averageLodgingCostPerNight: number;
  averageLocalTransportCostPerDay: number;
  messages: ChatMessage[];
  documents: SharedDoc[];
  photos: SharedPhoto[];
  // Shared individual participant transport cost (e.g. flights)
  externalTransportCost: number;
}

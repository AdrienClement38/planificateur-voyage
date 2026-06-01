import {
  createContext,
  useContext,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type SetStateAction,
} from "react";
import type { Member, Trip, ActivityProposal } from "../types";
import type { BudgetBreakdown } from "../domain/budget";

export type BudgetType = "Économique" | "Modéré" | "Luxe";
export type ActivePage = "dashboard" | "account" | "create-trip";
export type ActiveTab = "calendar" | "voting" | "itinerary" | "chat" | "media";
export type ActivityFilter = "all" | "gyg" | "airbnb" | "google";

/**
 * Contrat exposé par le store de l'application aux composants de l'UI.
 *
 * `tsc` garantit que la valeur fournie par le provider (`App`) et ce contrat
 * restent strictement alignés, ce qui rend le découpage incrémental sûr.
 */
export interface TripStore {
  // --- État partagé ---
  trips: Trip[];
  members: Member[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
  activeTrip: Trip;
  selectedTripId: string;
  currentMember: Member;
  currentMemberId: string;
  setCurrentMemberId: Dispatch<SetStateAction<string>>;
  isOffline: boolean;
  setIsOffline: Dispatch<SetStateAction<boolean>>;
  activePage: ActivePage;
  setActivePage: Dispatch<SetStateAction<ActivePage>>;
  activeTab: ActiveTab;
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>;
  budgetBreakdown: BudgetBreakdown;

  // --- Formulaire : création de voyage ---
  newTripName: string;
  setNewTripName: Dispatch<SetStateAction<string>>;
  newTripDays: number;
  setNewTripDays: Dispatch<SetStateAction<number>>;
  newTripBudget: BudgetType;
  setNewTripBudget: Dispatch<SetStateAction<BudgetType>>;

  // --- Formulaire : destinations / chat ---
  newDestName: string;
  setNewDestName: Dispatch<SetStateAction<string>>;
  chatText: string;
  setChatText: Dispatch<SetStateAction<string>>;

  // --- Génération d'itinéraire ---
  isGenerating: boolean;
  generationError: string;
  activityFilter: ActivityFilter;
  setActivityFilter: Dispatch<SetStateAction<ActivityFilter>>;

  // --- Médias (documents / photos) ---
  dragActive: boolean;
  simulatedDocName: string;
  setSimulatedDocName: Dispatch<SetStateAction<string>>;
  photoUrlInput: string;
  setPhotoUrlInput: Dispatch<SetStateAction<string>>;
  photoCaptionInput: string;
  setPhotoCaptionInput: Dispatch<SetStateAction<string>>;

  // --- Ajout manuel d'événement ---
  manualEventDay: number;
  setManualEventDay: Dispatch<SetStateAction<number>>;
  manualEventTime: string;
  setManualEventTime: Dispatch<SetStateAction<string>>;
  manualEventDesc: string;
  setManualEventDesc: Dispatch<SetStateAction<string>>;
  manualEventCost: number;
  setManualEventCost: Dispatch<SetStateAction<number>>;

  // --- Budget / profil / invitation ---
  isBudgetDropdownOpen: boolean;
  setIsBudgetDropdownOpen: Dispatch<SetStateAction<boolean>>;
  newProfileName: string;
  setNewProfileName: Dispatch<SetStateAction<string>>;
  newProfileAvatar: string;
  setNewProfileAvatar: Dispatch<SetStateAction<string>>;
  inviteEmailInput: string;
  setInviteEmailInput: Dispatch<SetStateAction<string>>;

  // --- Actions ---
  handleLogout: () => void;
  handleLoginAs: (memberId: string) => void;
  handleCreateProfileAndJoin: (name: string, avatar: string) => void;
  handleSimulateFriendJoin: (friendName?: string) => string;
  handleSendEmailInvite: (e: FormEvent) => void;
  handleUpdateTrip: (updatedTrip: Trip) => void;
  handleSelectTrip: (id: string) => void;
  handleCreateTrip: (e: FormEvent) => void;
  handleAddDestination: (e: FormEvent) => void;
  handleVoteDestination: (destId: string) => void;
  handleGenerateItinerary: () => Promise<void>;
  handleToggleActivityVote: (activityId: string) => void;
  handleScheduleActivity: (
    act: ActivityProposal,
    dayNum: number,
    timeStr?: string,
  ) => void;
  handleAutoPlanFromVotes: () => void;
  handleSendChat: (e: FormEvent) => void;
  handleDrag: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  handleAddManualDoc: (e: FormEvent) => void;
  handleAddPhoto: (e: FormEvent) => void;
  handleAddManualEvent: (e: FormEvent) => void;
  handleDeleteEvent: (dayNum: number, eventId: string) => void;
  handleDeleteDoc: (docId: string) => void;
  handleDeletePhoto: (photoId: string) => void;
  handleDeleteDestinationProposal: (destId: string) => void;
  handleUpdateTransportValue: (value: number) => void;
}

export const TripContext = createContext<TripStore | null>(null);

/** Accès typé au store. Lève une erreur claire si utilisé hors provider. */
export function useTripStore(): TripStore {
  const ctx = useContext(TripContext);
  if (!ctx) {
    throw new Error(
      "useTripStore doit être utilisé à l'intérieur de <TripContext.Provider>.",
    );
  }
  return ctx;
}

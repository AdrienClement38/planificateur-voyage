import { lazy, Suspense } from "react";
import { Clock, MapPin, Sparkles, MessageSquare, FileText } from "lucide-react";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import LoadingFallback from "../components/LoadingFallback";
import { useTripStore } from "../store/TripContext";

// Onglets chargés à la demande (chunks séparés) : seul l'onglet affiché est
// téléchargé, ce qui allège le bundle initial. Le calendrier reste eager car
// c'est l'onglet ouvert par défaut.
const VotingTab = lazy(() => import("./VotingTab"));
const ChatTab = lazy(() => import("./ChatTab"));
const MediaTab = lazy(() => import("./MediaTab"));
const ItineraryTab = lazy(() => import("./ItineraryTab"));

/** Colonne droite du tableau de bord : en-tête du voyage, barre d'onglets et contenu de l'onglet actif. */
export default function TripWorkspace() {
  const { activeTrip, activeTab, setActiveTab } = useTripStore();
  if (!activeTrip) return null;

  return (
    <div className="space-y-5">

      {/* NAVIGATION TABS BAR AT THE TOP OF THE COLUMN */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
            activeTab === "calendar"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Disponibilités</span>
        </button>

        <button
          onClick={() => setActiveTab("voting")}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
            activeTab === "voting"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span>Destinations</span>
          {activeTrip.destinations.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "voting" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {activeTrip.destinations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("itinerary")}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
            activeTab === "itinerary"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Programme & Suggestions</span>
        </button>

        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
            activeTab === "chat"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>Messagerie</span>
          {activeTrip.messages.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "chat" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {activeTrip.messages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("media")}
          className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
            activeTab === "media"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Partages ({activeTrip.documents.length + activeTrip.photos.length})</span>
        </button>
      </div>

      {/* TAB CONTAINER: REACTIVE MOUNTING OF INDIVIDUAL COMPONENTS */}

      {/* 1. CALENDAR TAB */}
      {activeTab === "calendar" && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs relative animate-fadeIn">
          <AvailabilityCalendar />
        </div>
      )}

      {/* Onglets chargés à la demande : un seul est monté à la fois, sous Suspense */}
      {activeTab !== "calendar" && (
        <Suspense fallback={<LoadingFallback />}>
          {/* 2. DESTINATION VOTING TAB */}
          {activeTab === "voting" && <VotingTab />}

          {/* 3. INTEGRATED DISCUSSION AND MESSAGING BOARD TAB */}
          {activeTab === "chat" && <ChatTab />}

          {/* 4. SHARED PHOTO GALLERY & DOCUMENTS SANDBOX TAB */}
          {activeTab === "media" && <MediaTab />}

          {/* 5. DYNAMIC MULTI-SOURCE ACTIVITY SUGGESTIONS & PROGRAM TAB */}
          {activeTab === "itinerary" && <ItineraryTab />}
        </Suspense>
      )}

    </div>
  );
}

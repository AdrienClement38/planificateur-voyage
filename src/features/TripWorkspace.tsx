import { Clock, MapPin, Sparkles, MessageSquare, FileText } from "lucide-react";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import VotingTab from "./VotingTab";
import ChatTab from "./ChatTab";
import MediaTab from "./MediaTab";
import ItineraryTab from "./ItineraryTab";
import { useTripStore } from "../store/TripContext";

/** Colonne droite du tableau de bord : en-tête du voyage, barre d'onglets et contenu de l'onglet actif. */
export default function TripWorkspace() {
  const {
    activeTrip,
    activeTab,
    setActiveTab,
    currentMember,
    isOffline,
    handleUpdateTrip,
  } = useTripStore();

  return (
    <div className="lg:col-span-8 space-y-5">

      {/* CHOSEN ADVENTURE COMPACT HEADER BANNER */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn text-left">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full blur-2xl pointer-events-none translate-x-12 -translate-y-12"></div>

        <div className="relative z-10 space-y-1.5">
          <span className="text-[9.5px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
            📂 Voyage Sélectionné
          </span>
          <h2 className="text-xl font-bold font-display text-slate-800 tracking-tight pt-1.5">
            {activeTrip.name}
          </h2>
          <p className="text-xs text-slate-500 italic max-w-xl">
            "{activeTrip.description}"
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shrink-0 min-w-[70px]">
            <span className="block text-[8px] uppercase font-bold text-slate-400">DURÉE</span>
            <span className="text-xs font-black text-slate-700">{activeTrip.targetDays} jours</span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shrink-0 min-w-[75px]">
            <span className="block text-[8px] uppercase font-bold text-slate-400">SERVICES</span>
            <span className="text-xs font-black text-indigo-600">{activeTrip.budgetType}</span>
          </div>
        </div>
      </div>

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
          <AvailabilityCalendar
            trip={activeTrip}
            currentMember={currentMember}
            isOffline={isOffline}
            onUpdateTrip={handleUpdateTrip}
          />
        </div>
      )}

      {/* 2. DESTINATION VOTING TAB */}
      {activeTab === "voting" && <VotingTab />}

      {/* 3. INTEGRATED DISCUSSION AND MESSAGING BOARD TAB */}
      {activeTab === "chat" && <ChatTab />}

      {/* 4. SHARED PHOTO GALLERY & DOCUMENTS SANDBOX TAB */}
      {activeTab === "media" && <MediaTab />}

      {/* 5. DYNAMIC MULTI-SOURCE ACTIVITY SUGGESTIONS & PROGRAM TAB */}
      {activeTab === "itinerary" && <ItineraryTab />}

    </div>
  );
}

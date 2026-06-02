import { ChevronDown, LogOut } from "lucide-react";
import OfflineIndicator from "./OfflineIndicator";
import { useTripStore } from "../store/TripContext";

/** En-tête de navigation (pages, budget, connectivité, déconnexion). */
export default function AppHeader() {
  const {
    setActivePage,
    activePage,
    currentMember,
    isBudgetDropdownOpen,
    setIsBudgetDropdownOpen,
    budgetBreakdown,
    activeTrip,
    handleUpdateTransportValue,
    handleLogout,
  } = useTripStore();

  return (
    <>
      {/* TOP LEVEL NAVIGATION & SPACIOUS BRANDING HEADER */}
      <header className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row justify-between lg:items-center gap-4 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 select-none">
            🛶
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <span className="text-xl sm:text-2xl font-black font-display tracking-widest text-slate-950">
                CO-TRIPPER
              </span>
              <span className="bg-indigo-50 text-indigo-700 text-[10.5px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100/50 self-start sm:self-auto">
                🧭 Planificateur de Voyage Coordonné
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Sillonnez le monde ensemble • Gestion des dates, des budgets et du programme collectif
            </p>
          </div>
        </div>

        {/* PERSISTENT HEADER NAV LINKS */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
          <button
            onClick={() => setActivePage("dashboard")}
            className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
              activePage === "dashboard"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            🗺️ Tableau de Bord
          </button>

          <button
            onClick={() => setActivePage("create-trip")}
            className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
              activePage === "create-trip"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            ➕ Initier un Voyage
          </button>

          <button
            onClick={() => setActivePage("account")}
            className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
              activePage === "account"
                ? "bg-indigo-600 text-white"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            }`}
          >
            👤 Mon Compte ({currentMember?.name ?? "moi"})
          </button>

          <div className="h-6 w-[1.5px] bg-slate-200 hidden sm:block mx-1"></div>

          {/* INTEGRATED "BUDGET PAR PARTICIPANT" DROPDOWN PILL */}
          {activeTrip && (
          <div className="relative">
            <button
              onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
              className={`flex items-center gap-2 px-3.5 py-1.8 rounded-xl text-xs font-extrabold transition duration-200 cursor-pointer border ${
                isBudgetDropdownOpen
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800"
              }`}
              title="Consulter le budget détaillé estimé par voyageur"
            >
              <span>💰 Budget: <strong className="font-black">{budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€</strong> / pers</span>
              <ChevronDown className={`w-3 h-3 transition duration-250 ${isBudgetDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isBudgetDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl z-55 text-white text-left text-xs space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-extrabold text-[10.5px] uppercase text-emerald-400 tracking-wider">💰 Budget par participant estimé</span>
                  <button
                    onClick={() => setIsBudgetDropdownOpen(false)}
                    className="text-slate-400 hover:text-white transition text-sm font-bold w-5 h-5 flex items-center justify-center bg-slate-800 rounded-full cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                <div className="bg-gradient-to-br from-emerald-950/80 to-slate-850 p-3.5 rounded-xl border border-emerald-900/30 text-center space-y-1">
                  <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Moyenne collective individuelle</span>
                  <span className="text-3xl font-black text-white font-display tracking-tight">
                    {budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€
                  </span>
                  <span className="block text-[10px] text-emerald-300">
                    Calculé sur {activeTrip.targetDays} jours de séjour ({activeTrip.budgetType})
                  </span>
                </div>

                <div className="space-y-2.5 pt-1.5 font-medium text-slate-300">
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span className="flex items-center gap-1.5">🏠 Hébergement ({activeTrip.averageLodgingCostPerNight}€/nuit)</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.totalLodging}€</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span className="flex items-center gap-1.5">🚌 Transport Local ({activeTrip.averageLocalTransportCostPerDay}€/jour)</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.totalLocalTransport}€</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span className="flex items-center gap-1.5">✨ Activités votées au programme</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.activitiesCost}€</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="flex items-center gap-1 text-slate-400 font-bold uppercase tracking-wider text-[9px]">✈️ Transport Principal A/R :</span>
                      <span className="font-extrabold text-emerald-450 font-mono text-sm">{budgetBreakdown.flightCost}€</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1400"
                      step="20"
                      value={activeTrip.externalTransportCost || 0}
                      onChange={(e) => handleUpdateTransportValue(Number(e.target.value))}
                      className="w-full accent-emerald-400 cursor-ew-resize h-1 bg-slate-800 rounded-lg"
                    />
                    <span className="block text-[9px] text-slate-400 text-right italic font-medium">Glissez pour modifier en direct</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          <OfflineIndicator />

          <button
            onClick={handleLogout}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer ml-auto"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </header>
    </>
  );
}

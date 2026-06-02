import { LogOut } from "lucide-react";
import OfflineIndicator from "./OfflineIndicator";
import { useTripStore } from "../store/TripContext";

/** En-tête applicatif : navigation entre pages, connectivité, déconnexion. */
export default function AppHeader() {
  const { setActivePage, activePage, currentMember, handleLogout } = useTripStore();

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

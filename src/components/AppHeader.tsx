import { useState } from "react";
import { LogOut, UserCog } from "lucide-react";
import { useTripStore } from "../store/TripContext";

/** Avatar par défaut (dicebear) si pas d'image. */
function avatarUrl(name: string, custom?: string | null): string {
  return custom || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(name);
}

/** En-tête applicatif épuré : logo (→ tableau de bord) + menu compte (avatar). */
export default function AppHeader() {
  const { setActivePage, currentMember, currentUser, handleLogout } = useTripStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = currentMember?.name ?? "moi";

  return (
    <header className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 relative z-50">
      {/* Marque — clic = retour tableau de bord */}
      <button
        onClick={() => setActivePage("dashboard")}
        className="flex items-center gap-3 cursor-pointer text-left group"
        title="Aller au tableau de bord"
      >
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 select-none">
          🛶
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <span className="text-2xl sm:text-3xl font-brand text-slate-950 leading-tight">
            Co-Traveler
          </span>
          <span className="bg-indigo-50 text-indigo-700 text-[10.5px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100/50 self-start sm:self-auto">
            🧭 Planificateur de Voyage Coordonné
          </span>
        </div>
      </button>

      {/* Menu compte (avatar) */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`rounded-full transition cursor-pointer ring-2 ${
            menuOpen ? "ring-indigo-400" : "ring-transparent hover:ring-slate-200"
          }`}
          title={`Compte de ${name}`}
        >
          <img
            src={avatarUrl(name, currentMember?.avatar)}
            alt={name}
            className="w-11 h-11 rounded-full border border-slate-200 bg-slate-100 object-cover block"
          />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 animate-fadeIn text-left">
              <div className="flex items-center gap-3 px-2.5 py-2.5 border-b border-slate-100 mb-1.5">
                <img
                  src={avatarUrl(name, currentMember?.avatar)}
                  alt={name}
                  className="w-10 h-10 rounded-full border border-slate-200 bg-slate-100 object-cover"
                />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{name}</p>
                  {currentUser?.email && (
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  setActivePage("account");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <UserCog className="w-4 h-4 text-slate-500" />
                Gérer mon compte
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

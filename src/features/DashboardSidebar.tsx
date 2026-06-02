import { useTripStore } from "../store/TripContext";

/** Colonne gauche du tableau de bord (Variante A) : sélecteur de voyages. */
export default function DashboardSidebar() {
  const { activeTrip, trips, selectedTripId, handleSelectTrip, handleDeleteTrip, setActivePage } =
    useTripStore();
  if (!activeTrip) return null;

  return (
    <div className="lg:col-span-3 space-y-5 animate-fadeIn">
      <div
        id="bento-card-trips-summary"
        className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3.5 text-left"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            📁 Mes Voyages ({trips.length})
          </h3>
        </div>

        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {trips.map((t) => (
            <div
              key={t.id}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition text-left ${
                t.id === selectedTripId
                  ? "border-indigo-200 bg-indigo-50/40"
                  : "border-slate-100 hover:border-indigo-150 hover:bg-slate-50"
              }`}
            >
              <button
                onClick={() => handleSelectTrip(t.id)}
                className="truncate flex-1 cursor-pointer text-left"
              >
                <p className="font-bold text-slate-800 text-xs truncate">{t.name}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {t.selectedDestination || t.description || "Destination à définir"}
                </p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded-full font-bold">
                  {t.targetDays}j
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer le voyage « ${t.name} » ? (réservé au créateur)`))
                      handleDeleteTrip(t.id);
                  }}
                  className="text-slate-300 hover:text-rose-500 p-1 rounded transition cursor-pointer"
                  title="Supprimer (créateur uniquement)"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setActivePage("create-trip")}
          className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-indigo-650 text-[10.5px] font-bold py-2.5 rounded-xl transition duration-150 text-center flex items-center justify-center gap-1 cursor-pointer"
        >
          ➕ Créer un nouveau projet
        </button>
      </div>
    </div>
  );
}

import { useTripStore, type BudgetType } from "../store/TripContext";

/** Page autonome de création d'un nouveau voyage de groupe. */
export default function CreateTripPage() {
  const {
    handleCreateTrip,
    newTripName,
    setNewTripName,
    newTripDays,
    setNewTripDays,
    newTripBudget,
    setNewTripBudget,
    members,
    setActivePage,
  } = useTripStore();

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div className="space-y-2 border-b border-slate-100 pb-4">
        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest">
          🚀 Nouveau Projet de Voyage
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Initier une Nouvelle Aventure Collective
        </h2>
        <p className="text-xs text-slate-500">
          Créez un nouveau groupe de voyage. Vous pourrez ensuite inviter vos amis, voter pour des destinations de rêve, synchroniser vos calendriers et suivre le budget en direct.
        </p>
      </div>

      <form onSubmit={handleCreateTrip} className="space-y-5">
        <div className="space-y-1.5 font-sans">
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
            Nom du Voyage Co-Tripper
          </label>
          <input
            type="text"
            required
            placeholder="ex: Roadtrip au Portugal 🇵🇹 ou Trek Chamonix 🥾"
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              Durée du séjour (en jours)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={newTripDays}
              onChange={(e) => setNewTripDays(Number(e.target.value) || 4)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
              Style de budget
            </label>
            <select
              value={newTripBudget}
              onChange={(e) => setNewTripBudget(e.target.value as BudgetType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold cursor-pointer"
            >
              <option value="Économique">Économique (Moins cher, auberges, bus)</option>
              <option value="Modéré">Modéré (Hôtel confort, bistrots savoureux)</option>
              <option value="Luxe">Luxe (Hôtel de standing, taxis, activités exclusives)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-xs text-slate-500 space-y-2">
          <p className="font-bold text-slate-700">👥 Participants associés par défaut :</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
                <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                <span>{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActivePage("dashboard")}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition duration-300 text-center"
          >
            Annuler et revenir
          </button>
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl transition duration-300 shadow-sm text-center cursor-pointer"
          >
            Lancer ce voyage collectif 🚀
          </button>
        </div>
      </form>
    </div>
  );
}

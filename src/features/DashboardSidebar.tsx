import { useTripStore } from "../store/TripContext";

/** Colonne gauche du tableau de bord : équipe, invitations réelles, liste des voyages. */
export default function DashboardSidebar() {
  const {
    activeTrip,
    currentMember,
    trips,
    selectedTripId,
    handleSelectTrip,
    handleDeleteTrip,
    setActivePage,
    joinTripIdInput,
    setJoinTripIdInput,
    handleJoinTrip,
  } = useTripStore();
  if (!activeTrip || !currentMember) return null;

  const copyInviteCode = () => {
    navigator.clipboard
      .writeText(activeTrip.id)
      .then(() => alert("🔗 Code de partage copié ! Envoyez-le à vos amis pour qu'ils rejoignent ce voyage."))
      .catch(() => alert(`Code de partage : ${activeTrip.id}`));
  };

  return (
    <div className="lg:col-span-4 space-y-5 animate-fadeIn">
      {/* PANNEAU ÉQUIPE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-5 relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none translate-x-12 -translate-y-12"></div>

        <div className="relative z-10 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
              👥 Co-Trippeurs & Équipe
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
              {activeTrip.members.length} voyageur{activeTrip.members.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Profil connecté */}
          <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img
                  src={currentMember.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(currentMember.name)}
                  alt={currentMember.name}
                  className="w-10 h-10 rounded-full border border-emerald-250 bg-emerald-100 object-cover"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="text-left">
                <span className="block text-[8px] uppercase font-extrabold tracking-wider text-emerald-600">VOUS ÊTES CONNECTÉ</span>
                <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{currentMember.name}</span>
              </div>
            </div>
            <button
              onClick={() => setActivePage("account")}
              className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Profil
            </button>
          </div>

          {/* Liste des membres (réels) */}
          <div className="space-y-2 text-left">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              👥 Membres du voyage
            </span>
            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
              {activeTrip.members.map((m) => {
                const isSelf = m.id === currentMember.id;
                const hasAvail = activeTrip.availabilities.some((a) => a.memberId === m.id);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                      isSelf ? "bg-indigo-50/60 border-indigo-100" : "bg-slate-50/50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={m.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(m.name)}
                        alt={m.name}
                        className="w-7 h-7 rounded-full border border-slate-200 bg-slate-100 object-cover"
                      />
                      <div className="text-left">
                        <span className="font-bold text-slate-800 text-xs block">
                          {m.name} {isSelf && <span className="text-[9px] text-indigo-600 font-extrabold">(Moi)</span>}
                        </span>
                        <span
                          className={`text-[9px] rounded px-1 py-0.2 font-medium ${
                            hasAvail ? "bg-emerald-50 text-emerald-600 font-bold" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {hasAvail ? "🗓️ Dates saisies" : "⏳ En attente de dates"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invitation réelle (code de partage + rejoindre) */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-100 rounded-2xl p-4 border border-indigo-900 shadow-md space-y-3.5 text-xs text-left">
            <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider flex items-center gap-2">
              🔗 Inviter des amis
            </h4>
            <div className="space-y-2.5">
              <div>
                <span className="block text-[9.5px] uppercase font-bold text-indigo-300 mb-1">CODE DE PARTAGE DE CE VOYAGE :</span>
                <div className="bg-slate-950 p-2 rounded-xl border border-indigo-850 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-indigo-200 truncate select-all max-w-[150px]">{activeTrip.id}</span>
                  <button
                    onClick={copyInviteCode}
                    className="bg-indigo-650 hover:bg-indigo-550 font-bold px-2 py-1 text-[10px] text-white rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Copier
                  </button>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinTrip(joinTripIdInput);
                }}
                className="pt-2 border-t border-indigo-900/40 space-y-1.5"
              >
                <span className="block text-[9.5px] uppercase font-bold text-indigo-300">REJOINDRE UN VOYAGE (CODE) :</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={joinTripIdInput}
                    onChange={(e) => setJoinTripIdInput(e.target.value)}
                    placeholder="Coller un code de partage"
                    className="bg-slate-950 border border-indigo-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-indigo-450 focus:outline-hidden focus:ring-1 focus:ring-indigo-505 w-full font-medium"
                  />
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 rounded-xl transition text-[10px] shrink-0 cursor-pointer">
                    Rejoindre
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* LISTE DES AUTRES VOYAGES */}
      <div id="bento-card-trips-summary" className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3.5 text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            📁 Mes Voyages ({trips.length})
          </h3>
        </div>

        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
          {trips.map((t) => (
            <div
              key={t.id}
              className={`w-full flex items-center justify-between p-2 rounded-lg border transition text-left ${
                t.id === selectedTripId ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 hover:border-indigo-150 hover:bg-slate-50"
              }`}
            >
              <button onClick={() => handleSelectTrip(t.id)} className="truncate max-w-[180px] cursor-pointer text-left">
                <p className="font-bold text-slate-800 text-[11px] truncate">{t.name}</p>
                <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{t.selectedDestination || t.description}</p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[8px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded-full font-bold">{t.targetDays}j</span>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer le voyage « ${t.name} » ? (réservé au créateur)`)) handleDeleteTrip(t.id);
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
          className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-indigo-650 text-[10.5px] font-bold py-2 rounded-xl transition duration-150 text-center flex items-center justify-center gap-1 cursor-pointer"
        >
          ➕ Créer un nouveau projet
        </button>
      </div>
    </div>
  );
}

import { useTripStore } from "../store/TripContext";

/** Colonne gauche du tableau de bord : équipe, profil, simulation, invitations, liste des voyages. */
export default function DashboardSidebar() {
  const {
    activeTrip,
    currentMember,
    currentMemberId,
    setCurrentMemberId,
    newProfileName,
    setNewProfileName,
    newProfileAvatar,
    setNewProfileAvatar,
    handleCreateProfileAndJoin,
    handleSimulateFriendJoin,
    handleSendEmailInvite,
    inviteEmailInput,
    setInviteEmailInput,
    trips,
    selectedTripId,
    handleSelectTrip,
    setActivePage,
  } = useTripStore();

  return (
    <div className="lg:col-span-4 space-y-5 animate-fadeIn">

      {/* CO-TRIPPER WORKSPACE PANEL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-5 relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none translate-x-12 -translate-y-12"></div>

        <div className="relative z-10 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
              👥 Co-Trippeurs & Équipe
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
              {activeTrip.members.length} voyageurs
            </span>
          </div>

          {/* ACTIVE PROFILES VIEW */}
          <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img
                  src={currentMember.avatar}
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
          </div>

          {/* MINI FORM FOR PROFILE REGISTRATION */}
          <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-3.5 space-y-2.5 text-xs text-left">
            <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 border-b border-slate-200/40 pb-1.5">
              👤 Créer mon profil voyageur
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-normal">
              Inscrivez-vous instantanément dans ce groupe de voyage pour planifier ensemble !
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Ex: Emma, Antoine, Léa..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.8 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* Interactive presets for quick avatar choice */}
              <div className="flex items-center justify-between gap-2.5 pt-1.5">
                <span className="text-[10px] text-slate-400 font-bold">Avatar :</span>
                <div className="flex gap-1.5">
                  {["🧭", "🏕️", "📸", "🏖️", "🎒"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewProfileAvatar(emoji)}
                      className={`w-6 h-6 flex items-center justify-center rounded-lg text-sm border transition ${
                        newProfileAvatar === emoji
                          ? "bg-indigo-600 border-indigo-650 text-white shadow-xs"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleCreateProfileAndJoin(newProfileName, newProfileAvatar)}
                disabled={!newProfileName.trim()}
                className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-400 text-white font-bold text-[10.5px] py-2 rounded-xl transition duration-150 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                Créer mon profil & Rejoindre 🛶
              </button>
            </div>
          </div>

          {/* ACTIVE CO-TRIPPERS POOL AND EASY SWITCHER */}
          <div className="space-y-2 text-left">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              👥 Liste des passagers & simulateur contextuel
            </span>

            <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
              {activeTrip.members.map((m) => {
                const isSelf = m.id === currentMemberId;
                // check if has availability
                const hasAvail = activeTrip.availabilities.some(a => a.memberId === m.id);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs transition group ${
                      isSelf
                        ? "bg-indigo-50/60 border-indigo-100"
                        : "bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full border border-slate-200 bg-slate-100 object-cover container" />
                      <div className="text-left">
                        <span className="font-bold text-slate-800 text-xs block">
                          {m.name} {isSelf && <span className="text-[9px] text-indigo-600 font-extrabold">(Moi)</span>}
                        </span>
                        <span className={`text-[9px] rounded px-1 py-0.2 font-medium ${
                          hasAvail ? "bg-emerald-50 text-emerald-600 font-bold" : "bg-amber-50 text-amber-600"
                        }`}>
                          {hasAvail ? "🗓️ Dates saisies" : "⏳ En attente de dates"}
                        </span>
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={() => setCurrentMemberId(m.id)}
                        className="block opacity-85 group-hover:opacity-100 text-[10px] bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 font-bold px-2 py-1 rounded-lg shadow-xs transition cursor-pointer"
                        title="Prendre l'identité de cet ami pour tester ses votes et ajouter ses dates"
                      >
                        Simuler 👥
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* INVITER DES AMIS BLOCK */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-indigo-100 rounded-2xl p-4 border border-indigo-900 shadow-md space-y-3.5 text-xs text-left">
            <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider flex items-center gap-2">
              🔗 Inviter des amis
            </h4>

            <div className="space-y-2.5">
              <div>
                <span className="block text-[9.5px] uppercase font-bold text-indigo-300 mb-1">PARTAGER LE LIEN D'INVITATION :</span>
                <div className="bg-slate-950 p-2 rounded-xl border border-indigo-850 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-indigo-200 truncate select-all max-w-[120px]">
                    co-tripper.com/join/{activeTrip.id}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://co-tripper.com/join/${activeTrip.id}`);
                      alert("🔗 Lien d'invitation copié dans votre presse-papiers ! Partagez-le sur WhatsApp, Discord, etc.");
                      const friendJoined = handleSimulateFriendJoin();
                      alert(`👥 [SIMULATION] Un ami nommé ${friendJoined} vient de cliquer sur votre lien de partage, s'est inscrit en 2 secondes, et a rejoint votre groupe de voyage ! Ses dates sont synchronisées.`);
                    }}
                    className="bg-indigo-650 hover:bg-indigo-550 font-bold px-2 py-1 text-[10px] text-white rounded-lg transition shrink-0 cursor-pointer"
                  >
                    Copier & Simuler
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendEmailInvite} className="pt-2 border-t border-indigo-900/40 space-y-1.5">
                <span className="block text-[9.5px] uppercase font-bold text-indigo-300">INVITATION DIRECTE PAR EMAIL :</span>
                <div className="flex gap-1">
                  <input
                    type="email"
                    required
                    placeholder="ami@voyage.com"
                    value={inviteEmailInput}
                    onChange={(e) => setInviteEmailInput(e.target.value)}
                    className="bg-slate-950 border border-indigo-900/40 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-indigo-450 focus:outline-hidden focus:ring-1 focus:ring-indigo-505 w-full font-medium"
                  />
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 rounded-xl transition text-[10px] shrink-0 cursor-pointer">
                    Inviter
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>

      {/* LISTING OF COMPACT GROUPS */}
      <div id="bento-card-trips-summary" className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3.5 text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            📁 Autres Voyages du groupe ({trips.length})
          </h3>
        </div>

        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
          {trips.length <= 1 ? (
            <p className="text-[10px] text-slate-400 italic">Aucun autre projet de voyage.</p>
          ) : (
            trips.filter(t => t.id !== selectedTripId).map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTrip(t.id)}
                className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-indigo-150 hover:bg-slate-50 transition text-left cursor-pointer"
              >
                <div className="truncate max-w-[190px]">
                  <p className="font-bold text-slate-800 text-[11px] truncate">{t.name}</p>
                  <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{t.selectedDestination || t.description}</p>
                </div>
                <span className="text-[8px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded-full font-bold">
                  {t.targetDays}j
                </span>
              </button>
            ))
          )}
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

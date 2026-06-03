import { useState, type FormEvent } from "react";
import { ChevronDown, Link2, Pencil, X } from "lucide-react";
import { useTripStore } from "../store/TripContext";

const BUDGET_TYPES = ["Économique", "Modéré", "Luxe"] as const;

/** Avatar par défaut (dicebear) si le membre n'a pas d'image. */
function avatarUrl(name: string, custom?: string | null): string {
  return custom || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(name);
}

/**
 * Bandeau d'identité du voyage actif (Variante A) : nom, destination, durée,
 * budget/pers (avec détail), membres, et invitation (fenêtre). Regroupe au même
 * endroit tout ce qui concerne LE voyage, séparé du chrome applicatif.
 */
export default function TripHeroBanner() {
  const {
    activeTrip,
    members,
    budgetBreakdown,
    isBudgetDropdownOpen,
    setIsBudgetDropdownOpen,
    handleUpdateTransportValue,
    joinTripIdInput,
    setJoinTripIdInput,
    handleJoinTrip,
    trips,
    selectedTripId,
    handleSelectTrip,
    handleDeleteTrip,
    handlePatchTrip,
    setActivePage,
  } = useTripStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Édition du voyage en cours (nom, destination, durée, type, description).
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    selectedDestination: "",
    targetDays: 4,
    budgetType: "Modéré" as (typeof BUDGET_TYPES)[number],
    description: "",
  });

  if (!activeTrip) return null;

  const openEdit = () => {
    setForm({
      name: activeTrip.name,
      selectedDestination: activeTrip.selectedDestination ?? "",
      targetDays: activeTrip.targetDays,
      budgetType: (BUDGET_TYPES.includes(activeTrip.budgetType as (typeof BUDGET_TYPES)[number])
        ? activeTrip.budgetType
        : "Modéré") as (typeof BUDGET_TYPES)[number],
      description: activeTrip.description ?? "",
    });
    setEditOpen(true);
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    handlePatchTrip({
      name,
      selectedDestination: form.selectedDestination.trim(),
      targetDays: form.targetDays,
      budgetType: form.budgetType,
      description: form.description.trim(),
    });
    setEditOpen(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(activeTrip.id).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => undefined,
    );
  };

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  return (
    <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 relative animate-fadeIn">
      {/* Déco floue clippée dans un calque interne, pour ne PAS rogner les menus déroulants. */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-full blur-3xl translate-x-16 -translate-y-16"></div>
      </div>

      <div className="relative z-20 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Identité du voyage + sélecteur de voyage */}
        <div className="min-w-0">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500">
            Voyage en cours
          </span>
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen((v) => !v)}
              className="group flex items-center gap-2 mt-0.5 max-w-full cursor-pointer"
              title="Changer de voyage"
            >
              <h1 className="text-2xl sm:text-3xl font-black font-display text-slate-950 tracking-tight truncate">
                {activeTrip.name}
              </h1>
              <ChevronDown
                className={`w-5 h-5 text-slate-400 group-hover:text-slate-700 transition shrink-0 ${
                  switcherOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {switcherOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSwitcherOpen(false)} />
                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2 animate-fadeIn">
                  <div className="px-2 py-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      📁 Mes voyages ({trips.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-[280px] overflow-y-auto pr-0.5">
                    {trips.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between rounded-xl px-2.5 py-2 border ${
                          t.id === selectedTripId
                            ? "bg-indigo-50 border-indigo-100"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <button
                          onClick={() => {
                            handleSelectTrip(t.id);
                            setSwitcherOpen(false);
                          }}
                          className="flex-1 text-left truncate cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                            {t.name}
                            {t.id === selectedTripId && <span className="text-indigo-600">✓</span>}
                          </span>
                          <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                            {t.selectedDestination || t.description || "Destination à définir"}
                          </span>
                        </button>
                        <div className="flex items-center gap-1 shrink-0 pl-1.5">
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
                    onClick={() => {
                      setActivePage("create-trip");
                      setSwitcherOpen(false);
                    }}
                    className="w-full mt-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-indigo-650 text-[11px] font-bold py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    ➕ Créer un nouveau projet
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">
              📍 {activeTrip.selectedDestination?.trim() || "Destination à définir"}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">
              🗓️ {activeTrip.targetDays} jours
            </span>
            <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">
              🎚️ {activeTrip.budgetType}
            </span>
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
              title="Modifier le voyage (nom, durée, type…)"
            >
              <Pencil className="w-3 h-3" /> Modifier
            </button>
          </div>
        </div>

        {/* Outils du voyage : budget · membres · inviter */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Budget par personne (avec détail) */}
          <div className="relative">
            <button
              onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-extrabold transition border ${
                isBudgetDropdownOpen
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800"
              }`}
              title="Détail du budget estimé par voyageur"
            >
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[9px] uppercase tracking-wider opacity-80 font-bold">Budget / pers</span>
                <span className="font-black text-base">
                  {budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 transition ${isBudgetDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isBudgetDropdownOpen && (
              <div className="absolute left-0 mt-2.5 w-80 max-w-[calc(100vw-3rem)] bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl z-40 text-white text-left text-xs space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-extrabold text-[10.5px] uppercase text-emerald-400 tracking-wider">
                    💰 Budget par participant estimé
                  </span>
                  <button
                    onClick={() => setIsBudgetDropdownOpen(false)}
                    className="text-slate-400 hover:text-white transition w-5 h-5 flex items-center justify-center bg-slate-800 rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-gradient-to-br from-emerald-950/80 to-slate-850 p-3.5 rounded-xl border border-emerald-900/30 text-center space-y-1">
                  <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">
                    Moyenne collective individuelle
                  </span>
                  <span className="text-3xl font-black text-white font-display tracking-tight">
                    {budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€
                  </span>
                  <span className="block text-[10px] text-emerald-300">
                    Sur {activeTrip.targetDays} jours ({activeTrip.budgetType})
                  </span>
                </div>
                <div className="space-y-2.5 pt-1.5 font-medium text-slate-300">
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span>🏠 Hébergement ({activeTrip.averageLodgingCostPerNight}€/nuit)</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.totalLodging}€</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span>🚌 Transport local ({activeTrip.averageLocalTransportCostPerDay}€/jour)</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.totalLocalTransport}€</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                    <span>✨ Activités votées</span>
                    <span className="font-bold text-white font-mono">{budgetBreakdown.activitiesCost}€</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        ✈️ Transport principal A/R
                      </span>
                      <span className="font-extrabold text-emerald-450 font-mono text-sm">
                        {budgetBreakdown.flightCost}€
                      </span>
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
                    <span className="block text-[9px] text-slate-400 text-right italic">
                      Glissez pour ajuster en direct
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Membres (avatars empilés) */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2.5">
              {shown.map((m) => (
                <img
                  key={m.id}
                  src={avatarUrl(m.name, m.avatar)}
                  alt={m.name}
                  title={m.name}
                  className="w-9 h-9 rounded-full border-2 border-white bg-slate-100 object-cover"
                />
              ))}
              {extra > 0 && (
                <span className="w-9 h-9 rounded-full border-2 border-white bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                  +{extra}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:block">
              {members.length} voyageur{members.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Inviter */}
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-2xl transition cursor-pointer"
          >
            <Link2 className="w-4 h-4" />
            Inviter
          </button>
        </div>
      </div>

      {/* Fenêtre d'invitation */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-indigo-600" /> Inviter des amis
              </h3>
              <button
                onClick={() => setInviteOpen(false)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                Code de partage de ce voyage
              </span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
                <span className="text-xs font-mono text-slate-600 truncate select-all flex-1">
                  {activeTrip.id}
                </span>
                <button
                  onClick={copyCode}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 text-xs rounded-xl transition shrink-0 cursor-pointer"
                >
                  {copied ? "Copié ✓" : "Copier"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Envoyez ce code à vos amis pour qu'ils rejoignent le voyage.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinTrip(joinTripIdInput);
                setInviteOpen(false);
              }}
              className="space-y-1.5 pt-4 border-t border-slate-100"
            >
              <span className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                Rejoindre un autre voyage
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinTripIdInput}
                  onChange={(e) => setJoinTripIdInput(e.target.value)}
                  placeholder="Coller un code de partage"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 rounded-2xl transition text-sm shrink-0 cursor-pointer"
                >
                  Rejoindre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fenêtre d'édition du voyage */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setEditOpen(false)}
        >
          <form
            onSubmit={submitEdit}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-left max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" /> Modifier le voyage
              </h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                Nom du voyage
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                Destination
              </label>
              <input
                type="text"
                maxLength={200}
                value={form.selectedDestination}
                onChange={(e) => setForm((f) => ({ ...f, selectedDestination: e.target.value }))}
                placeholder="Laisser vide pour « à définir »"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                Durée du séjour
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.targetDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      targetDays: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-24 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                />
                <span className="text-sm font-semibold text-slate-500">jours</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                Type de budget
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BUDGET_TYPES.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, budgetType: bt }))}
                    className={`py-2.5 rounded-2xl text-xs font-bold border transition cursor-pointer ${
                      form.budgetType === bt
                        ? "bg-indigo-600 text-white border-indigo-700"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                Description (optionnel)
              </label>
              <textarea
                rows={2}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition text-sm cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition text-sm cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

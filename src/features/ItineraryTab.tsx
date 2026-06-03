import { useState, type FormEvent } from "react";
import {
  Sparkles,
  AlertCircle,
  ThumbsUp,
  Trash2,
  Plus,
  CalendarPlus,
  Pencil,
  ExternalLink,
  Check,
  RefreshCw,
} from "lucide-react";
import { useTripStore } from "../store/TripContext";
import {
  computeEndTime,
  findConflictingEvent,
  findNextFreeSlot,
  parseDurationToMinutes,
  addMinutesToTime,
} from "../domain/schedule";
import type { ActivityProposal } from "../types";

/** Onglet des suggestions d'activités et du programme journalier. */
export default function ItineraryTab() {
  const {
    activeTrip,
    isGenerating,
    generationError,
    handleGenerateItinerary,
    activityFilter,
    setActivityFilter,
    currentMember,
    handleToggleActivityVote,
    handleScheduleActivity,
    handleAutoPlanFromVotes,
    handleDeleteEvent,
    handleUpdateEvent,
    handleAddManualEvent,
    manualEventDay,
    setManualEventDay,
    manualEventTime,
    setManualEventTime,
    manualEventEndTime,
    setManualEventEndTime,
    manualEventDesc,
    setManualEventDesc,
    manualEventCost,
    setManualEventCost,
  } = useTripStore();

  // Mini-formulaire de planification (déplié sous l'activité concernée).
  const [planActId, setPlanActId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ day: 1, start: "10:00", end: "11:00", estimated: false });
  const [planError, setPlanError] = useState("");
  const [manualError, setManualError] = useState("");

  // Édition d'une étape déjà planifiée.
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ day: 1, start: "10:00", end: "", description: "", cost: 0 });
  const [editError, setEditError] = useState("");

  // Fenêtre de suggestions (combien on en montre, et à partir d'où).
  const SUGGESTIONS_PER_PAGE = 6;
  const [suggestionOffset, setSuggestionOffset] = useState(0);

  if (!activeTrip || !currentMember) return null;

  /** Étapes d'un jour donné (pour la détection de conflit de créneau). */
  const dayEventsOf = (dayNum: number) =>
    activeTrip.itinerary.find((d) => d.day === dayNum)?.events ?? [];

  // Propose d'emblée le 1er créneau libre : on parcourt les jours dans l'ordre
  // et on s'arrête au premier qui a la place pour la durée de l'activité.
  const proposeSlot = (act: ActivityProposal) => {
    const mins = parseDurationToMinutes(act.duration) ?? 60;
    const estimated = parseDurationToMinutes(act.duration) === null;
    for (let day = 1; day <= activeTrip.targetDays; day++) {
      const slot = findNextFreeSlot(dayEventsOf(day), mins);
      if (slot) return { day, start: slot.start, end: slot.end, estimated };
    }
    // Tous les jours sont pleins : repli sur le jour 1 à 10:00 (conflit signalé).
    return { day: 1, start: "10:00", end: addMinutesToTime("10:00", mins), estimated };
  };

  // Ouvre le mini-formulaire en pré-remplissant un créneau libre.
  const openPlanner = (act: ActivityProposal) => {
    setPlanForm(proposeSlot(act));
    setPlanError("");
    setEditEventId(null);
    setPlanActId(act.id);
  };

  // Changement de jour : propose le 1er créneau libre de CE jour.
  const onPlanDayChange = (act: ActivityProposal, day: number) => {
    const mins = parseDurationToMinutes(act.duration) ?? 60;
    const slot = findNextFreeSlot(dayEventsOf(day), mins);
    setPlanForm((f) => ({
      ...f,
      day,
      start: slot ? slot.start : f.start,
      end: slot ? slot.end : f.end,
    }));
    setPlanError("");
  };

  // Recalcule la fin quand l'heure de début change (selon la durée de l'activité).
  const onStartChange = (act: ActivityProposal, start: string) => {
    const { endTime, estimated } = computeEndTime(start, act.duration);
    setPlanForm((f) => ({ ...f, start, end: endTime, estimated }));
    setPlanError("");
  };

  const confirmPlan = (act: ActivityProposal) => {
    const conflict = findConflictingEvent(dayEventsOf(planForm.day), planForm.start, planForm.end);
    if (conflict) {
      setPlanError(
        `Créneau déjà occupé par « ${conflict.description} » (${conflict.time}${conflict.endTime ? ` → ${conflict.endTime}` : ""}). Choisis un autre horaire.`,
      );
      return;
    }
    handleScheduleActivity(act, planForm.day, planForm.start, planForm.end);
    setPlanActId(null);
  };

  // Soumission du formulaire manuel, avec contrôle de conflit de créneau.
  const onManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualEventDesc.trim()) return;
    const conflict = findConflictingEvent(
      dayEventsOf(Number(manualEventDay)),
      manualEventTime,
      manualEventEndTime || undefined,
    );
    if (conflict) {
      setManualError(
        `Le jour ${manualEventDay} a déjà « ${conflict.description} » sur ce créneau (${conflict.time}${conflict.endTime ? ` → ${conflict.endTime}` : ""}).`,
      );
      return;
    }
    setManualError("");
    handleAddManualEvent(e);
  };

  // Ouvre l'édition d'une étape existante.
  const openEditEvent = (
    dayNum: number,
    ev: { id: string; time: string; endTime?: string; description: string; cost: number },
  ) => {
    setEditForm({
      day: dayNum,
      start: ev.time,
      end: ev.endTime ?? "",
      description: ev.description,
      cost: ev.cost,
    });
    setEditError("");
    setPlanActId(null);
    setEditEventId(ev.id);
  };

  const saveEditEvent = () => {
    if (!editEventId || !editForm.description.trim()) return;
    const conflict = findConflictingEvent(
      dayEventsOf(editForm.day),
      editForm.start,
      editForm.end || undefined,
      editEventId,
    );
    if (conflict) {
      setEditError(
        `Chevauchement avec « ${conflict.description} » (${conflict.time}${conflict.endTime ? ` → ${conflict.endTime}` : ""}).`,
      );
      return;
    }
    handleUpdateEvent(editEventId, {
      time: editForm.start,
      endTime: editForm.end.trim() || null,
      description: editForm.description.trim(),
      cost: Number(editForm.cost) || 0,
    });
    setEditEventId(null);
  };

  // Descriptions des étapes déjà au programme. Une activité est « planifiée » si
  // une étape porte son nom — quel que soit le format ajouté à la planification
  // (« Nom [Source] » manuel, « Nom — description » auto-plan).
  const plannedDescriptions = activeTrip.itinerary
    .flatMap((d) => d.events)
    .map((e) => e.description.trim().toLowerCase());
  const isPlanned = (name: string) => {
    const n = name.trim().toLowerCase();
    return plannedDescriptions.some(
      (d) => d === n || d.startsWith(`${n} [`) || d.startsWith(`${n} —`) || d.startsWith(`${n} -`),
    );
  };

  // Pool de suggestions disponibles = activités du filtre courant, non planifiées.
  const suggestionPool = activeTrip.activities.filter((act) => {
    if (activityFilter === "gyg" && act.source !== "GetYourGuide") return false;
    if (activityFilter === "airbnb" && act.source !== "Airbnb Expériences") return false;
    if (activityFilter === "google" && act.source !== "Google Activités") return false;
    return !isPlanned(act.name);
  });

  // Fenêtre visible (avec rotation circulaire pour « voir d'autres suggestions »).
  const canShowMore = suggestionPool.length > SUGGESTIONS_PER_PAGE;
  const safeOffset = suggestionPool.length > 0 ? suggestionOffset % suggestionPool.length : 0;
  const visibleSuggestions = canShowMore
    ? [...suggestionPool, ...suggestionPool].slice(safeOffset, safeOffset + SUGGESTIONS_PER_PAGE)
    : suggestionPool;

  // Change de filtre source en réinitialisant la fenêtre.
  const setFilter = (f: typeof activityFilter) => {
    setActivityFilter(f);
    setSuggestionOffset(0);
  };

  return (
    <div id="bento-card-itinerary" className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-6 animate-fadeIn">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -translate-y-20 translate-x-10"></div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            Suggestions d'Activités & Programme
          </h3>
          <p className="text-xs text-indigo-300 mt-0.5">
            Explorez {activeTrip.selectedDestination ? `à ${activeTrip.selectedDestination}` : "votre destination"} de vrais spots via Wikipédia et des bons plans GetYourGuide.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 self-end md:self-auto">
          {activeTrip.selectedDestination ? (
            <button
              onClick={handleGenerateItinerary}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md transition duration-200 flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? "Chargement des spots..." : "Rechercher des activités 🔍"}
            </button>
          ) : (
            <span className="text-[11px] text-rose-300 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/30 font-semibold uppercase">
              ⚠️ Votez d'abord une ville gagnante
            </span>
          )}
        </div>
      </div>

      {generationError && (
        <div className="bg-rose-500/20 text-rose-200 p-3 rounded-2xl text-xs border border-rose-500/20 flex items-center gap-2 relative z-10 animate-shake">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{generationError}</span>
        </div>
      )}

      {/* Main activities section with double column logic: left suggestions feed, right programmatic timeline */}
      {!activeTrip.activities || activeTrip.activities.length === 0 ? (
        <div className="text-center py-10 space-y-4 relative z-10 bg-white/5 rounded-3xl border border-white/10 p-5">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-full text-indigo-300 text-2xl">
            🗺️
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="font-bold text-sm text-slate-100">Aucune activité n'a été suggérée collectivement</h4>
            <p className="text-xs text-slate-400">
              {activeTrip.selectedDestination
                ? `Consultez les suggestions en temps réel pour ${activeTrip.selectedDestination}. Notre moteur va interroger les attractions de Wikipédia 📚 & le catalogue d'excursions GetYourGuide 🎫 gratuitement.`
                : "Veuillez désigner et élire une destination gagnante dans l'onglet 'Destinations' afin de lancer la recherche d'activités !"
              }
            </p>
          </div>
          {activeTrip.selectedDestination && (
            <button
              onClick={handleGenerateItinerary}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-200 cursor-pointer"
            >
              {isGenerating ? "Connexions en cours..." : "Lancer la recherche maintenant !"}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">

          {/* COLUMN 1: SUGGESTIONS POOL & MULTI-SOURCES FINDER */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                📂 Idées de sorties ({suggestionPool.length})
              </h4>

              {/* Filters tab buttons */}
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0 overflow-x-auto max-w-[340px] sm:max-w-none">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setFilter("gyg")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "gyg" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  GetYourGuide 🎫
                </button>
                <button
                  onClick={() => setFilter("airbnb")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "airbnb" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Airbnb expériences 🏠
                </button>
                <button
                  onClick={() => setFilter("google")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "google" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Google Activités ✈️
                </button>
              </div>
            </div>

            {/* Suggestions list scroll box */}
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {visibleSuggestions.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-4">
                  🎉 Toutes les idées de cette catégorie sont déjà au programme. Changez de filtre ou
                  relancez une recherche pour en découvrir d'autres.
                </div>
              )}
              {visibleSuggestions.map((act) => {
                  const isVotedByCurrent = act.votes.includes(currentMember.id);
                  const totalVotes = act.votes.length;
                  const isGYG = act.source === "GetYourGuide";
                  const isAirbnb = act.source === "Airbnb Expériences";
                  const isGoogle = act.source === "Google Activités";

                  return (
                    <div key={act.id} className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2 hover:border-indigo-500/30 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h5 className="font-bold text-xs text-indigo-50 leading-snug">{act.name}</h5>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                            {isGYG && (
                              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none whitespace-nowrap">
                                GetYourGuide ⭐ {act.rating || 4.7} ({act.reviewsCount || 120} avis) | {act.duration || "2h"}
                              </span>
                            )}
                            {isAirbnb && (
                              <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none whitespace-nowrap">
                                Airbnb ⭐ {act.rating || 4.9} ({act.reviewsCount || 45} avis) | {act.duration || "2h"}
                              </span>
                            )}
                            {isGoogle && (
                              <span className="bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none whitespace-nowrap">
                                Google ⭐ {act.rating || 4.5} | {act.duration || "Visite libre"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed block">
                            {act.description}
                          </p>
                        </div>

                        <span className="text-xs font-bold text-emerald-400 shrink-0 bg-emerald-950/60 border border-emerald-900/30 px-2 py-0.5 rounded">
                          {act.cost === 0 ? "Gratuit" : `${act.cost}€`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          Source : <strong className="text-indigo-300 font-semibold">{act.proposedBy}</strong>
                          {act.bookingUrl && (
                            <a
                              href={act.bookingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline transition ml-1.5"
                            >
                              Voir l'offre ↗️
                            </a>
                          )}
                        </span>

                        {/* Activity Interactivity buttons: Vote and Schedule */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleActivityVote(act.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition select-none ${
                              isVotedByCurrent
                                ? "bg-indigo-600 text-white"
                                : "bg-white/10 hover:bg-white/15 text-slate-300"
                            }`}
                            title="Voter pour cette visite"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>{totalVotes} vote(s)</span>
                          </button>

                          {/* Bouton qui déplie le mini-planificateur (jour + heures) */}
                          <button
                            onClick={() =>
                              planActId === act.id ? setPlanActId(null) : openPlanner(act)
                            }
                            className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition select-none ${
                              planActId === act.id
                                ? "bg-indigo-500 text-white"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                            }`}
                          >
                            <CalendarPlus className="w-3 h-3" /> Planifier
                          </button>
                        </div>
                      </div>

                      {/* Mini-formulaire de planification (jour, heure début, heure fin) */}
                      {planActId === act.id && (
                        <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                          <div className="grid grid-cols-3 gap-2">
                            <label className="block">
                              <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">Jour</span>
                              <select
                                value={planForm.day}
                                onChange={(e) => onPlanDayChange(act, Number(e.target.value))}
                                className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                              >
                                {Array.from({ length: activeTrip.targetDays }).map((_, idx) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    Jour {idx + 1}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">Début</span>
                              <input
                                type="time"
                                value={planForm.start}
                                onChange={(e) => onStartChange(act, e.target.value)}
                                className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                              />
                            </label>
                            <label className="block">
                              <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">Fin</span>
                              <input
                                type="time"
                                value={planForm.end}
                                onChange={(e) =>
                                  setPlanForm((f) => ({ ...f, end: e.target.value, estimated: false }))
                                }
                                className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                              />
                            </label>
                          </div>

                          {planForm.estimated && !planError && (
                            <p className="flex items-start gap-1.5 text-[9.5px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5 leading-snug">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
                              <span>
                                Durée inconnue : fin estimée à <strong>+1h</strong>. Vérifie-la et
                                ajuste-la pour un programme cohérent.
                              </span>
                            </p>
                          )}

                          {planError && (
                            <p className="flex items-start gap-1.5 text-[9.5px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1.5 leading-snug">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
                              <span>{planError}</span>
                            </p>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => setPlanActId(null)}
                              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => confirmPlan(act)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Ajouter au programme
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {canShowMore && (
              <button
                onClick={() => setSuggestionOffset((o) => o + SUGGESTIONS_PER_PAGE)}
                className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-indigo-200 text-[11px] font-bold py-2.5 rounded-xl border border-white/10 transition cursor-pointer"
                title="Afficher d'autres idées du catalogue"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Voir d'autres suggestions ({suggestionPool.length})
              </button>
            )}
          </div>

          {/* COLUMN 2: COLLABORATIVE ITINERARY TIMELINE */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                🗒️ Notre Programme Journalier
              </h4>

              {/* Auto package from votes of the travellers */}
              <button
                onClick={handleAutoPlanFromVotes}
                disabled={isGenerating}
                className="bg-radial from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-[10.5px] font-bold py-1.5 px-3 rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                title="Distribue vos activités favorites automatiquement selon l'ordre des votes"
              >
                <Sparkles className="w-3 h-3" />
                Planification Auto (votes) ✨
              </button>
            </div>

            {/* Daily sequence list */}
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {activeTrip.itinerary.map((day) => (
                <div key={day.day} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative group/day">

                  {/* Header Day */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-xs font-bold tracking-wider text-indigo-400">
                      {day.title}
                    </span>
                    <span className="text-[9px] text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded font-extrabold uppercase">
                      Jour {day.day}
                    </span>
                  </div>

                  {/* Scheduled events on that day */}
                  <div className="space-y-3">
                    {day.events && day.events.length > 0 ? (
                      day.events.map((ev) =>
                        editEventId === ev.id ? (
                          /* --- Édition en ligne de l'étape --- */
                          <div key={ev.id} className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 space-y-2.5">
                            <div className="grid grid-cols-3 gap-2">
                              <label className="block">
                                <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">Début</span>
                                <input
                                  type="time"
                                  value={editForm.start}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, start: e.target.value }))
                                  }
                                  className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">Fin</span>
                                <input
                                  type="time"
                                  value={editForm.end}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, end: e.target.value }))
                                  }
                                  className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[8px] uppercase font-bold text-indigo-300 mb-0.5">€ / pers.</span>
                                <input
                                  type="number"
                                  value={editForm.cost || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, cost: Number(e.target.value) || 0 }))
                                  }
                                  className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                                />
                              </label>
                            </div>
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, description: e.target.value }))
                              }
                              placeholder="Nom de l'étape"
                              className="bg-slate-900 border border-white/10 rounded-lg p-1.5 text-[11px] text-white w-full outline-hidden"
                            />
                            {editError && (
                              <p className="flex items-start gap-1.5 text-[9.5px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1.5 leading-snug">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-px" />
                                <span>{editError}</span>
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditEventId(null)}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold py-1.5 rounded-lg transition cursor-pointer"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={saveEditEvent}
                                className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Enregistrer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div key={ev.id} className="flex gap-2.5 text-[11px] justify-between group/ev bg-white/[0.02] hover:bg-white/[0.04] p-2 rounded-xl transition border border-transparent hover:border-white/5">
                            <div className="flex gap-2 min-w-0">
                              <span className="font-mono text-indigo-300 font-semibold shrink-0 bg-white/5 px-1.5 py-0.5 rounded text-[9.5px] self-start whitespace-nowrap">
                                {ev.time}
                                {ev.endTime ? ` → ${ev.endTime}` : ""}
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-100">{ev.description}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                  {ev.cost > 0 && (
                                    <span className="text-[9.5px] text-emerald-400 font-semibold">
                                      Estimation : {ev.cost}€ / pers.
                                    </span>
                                  )}
                                  {ev.bookingUrl && (
                                    <a
                                      href={ev.bookingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[9.5px] text-indigo-300 hover:text-indigo-200 hover:underline"
                                    >
                                      Voir l'offre <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-0.5 shrink-0">
                              <button
                                onClick={() => openEditEvent(day.day, ev)}
                                className="opacity-0 group-hover/ev:opacity-100 text-indigo-300 hover:text-indigo-200 p-1 rounded-sm transition"
                                title="Modifier cette étape"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(day.day, ev.id)}
                                className="opacity-0 group-hover/ev:opacity-100 text-rose-400 hover:text-rose-500 p-1 rounded-sm transition"
                                title="Supprimer cette étape"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="py-4 text-center border border-dashed border-white/5 rounded-xl">
                        <span className="text-[10.5px] text-slate-500 italic block">Aucune étape pour ce jour.</span>
                        <span className="text-[9px] text-indigo-400/50 mt-1 block">Sélectionnez une suggestion à gauche ou planifiez ci-dessous.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Custom manual event additions (always available once a destination is selected) */}
      {activeTrip.selectedDestination && (
        <div className="relative z-10 pt-4 border-t border-white/10 space-y-3">
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Planifier manuellement une autre étape
          </h4>

          {manualError && (
            <p className="flex items-start gap-1.5 text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 leading-snug">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{manualError}</span>
            </p>
          )}

          <form onSubmit={onManualSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Jour :</span>
              <select
                value={manualEventDay}
                onChange={(e) => setManualEventDay(Number(e.target.value))}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full outline-hidden"
              >
                {Array.from({ length: activeTrip.targetDays || 4 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Jour {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Début :</span>
              <input
                type="time"
                value={manualEventTime}
                onChange={(e) => setManualEventTime(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full outline-hidden"
              />
            </div>

            <div>
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Fin (option.) :</span>
              <input
                type="time"
                value={manualEventEndTime}
                onChange={(e) => setManualEventEndTime(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full outline-hidden"
              />
            </div>

            <div>
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Tarif (€) :</span>
              <input
                type="number"
                placeholder="Coût / pers."
                value={manualEventCost || ""}
                onChange={(e) => setManualEventCost(Number(e.target.value) || 0)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full"
              />
            </div>

            <div className="col-span-2 sm:col-span-3">
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Activité ou description :</span>
              <input
                type="text"
                required
                placeholder="Visite guidée, Cocktail, Transat..."
                value={manualEventDesc}
                onChange={(e) => setManualEventDesc(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full outline-hidden"
              />
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition duration-200 w-full cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

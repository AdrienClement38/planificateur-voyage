import { Sparkles, AlertCircle, ThumbsUp, Trash2, Plus } from "lucide-react";
import { useTripStore } from "../store/TripContext";

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
    handleAddManualEvent,
    manualEventDay,
    setManualEventDay,
    manualEventTime,
    setManualEventTime,
    manualEventDesc,
    setManualEventDesc,
    manualEventCost,
    setManualEventCost,
  } = useTripStore();

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
                📂 Idées de sorties ({activeTrip.activities.length})
              </h4>

              {/* Filters tab buttons */}
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0 overflow-x-auto max-w-[340px] sm:max-w-none">
                <button
                  onClick={() => setActivityFilter("all")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setActivityFilter("gyg")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "gyg" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  GetYourGuide 🎫
                </button>
                <button
                  onClick={() => setActivityFilter("airbnb")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activityFilter === "airbnb" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Airbnb expériences 🏠
                </button>
                <button
                  onClick={() => setActivityFilter("google")}
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
              {activeTrip.activities
                .filter(act => {
                  if (activityFilter === "gyg") return act.source === "GetYourGuide";
                  if (activityFilter === "airbnb") return act.source === "Airbnb Expériences";
                  if (activityFilter === "google") return act.source === "Google Activités";
                  return true;
                })
                .map((act) => {
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

                          {/* Action scheduling select menu */}
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleScheduleActivity(act, Number(e.target.value), "10:00");
                                e.target.value = ""; // resetting
                              }
                            }}
                            className="bg-indigo-950 text-white border border-indigo-900/30 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer outline-hidden"
                          >
                            <option value="">Planifier 📅</option>
                            {Array.from({ length: activeTrip.targetDays }).map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                Jour {idx + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
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
                      day.events.map((ev) => (
                        <div key={ev.id} className="flex gap-2.5 text-[11px] justify-between group/ev bg-white/[0.02] hover:bg-white/[0.04] p-2 rounded-xl transition border border-transparent hover:border-white/5">
                          <div className="flex gap-2">
                            <span className="font-mono text-indigo-300 font-semibold shrink-0 bg-white/5 px-1.5 py-0.5 rounded text-[9.5px] self-start">
                              {ev.time}
                            </span>
                            <div>
                              <p className="font-bold text-slate-100">{ev.description}</p>
                              {ev.cost > 0 && (
                                <span className="text-[9.5px] text-emerald-400 font-semibold block mt-0.5">
                                  Estimation : {ev.cost}€ / pers.
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteEvent(day.day, ev.id)}
                            className="opacity-0 group-hover/ev:opacity-100 text-rose-400 hover:text-rose-500 p-1 rounded-sm shrink-0 transition"
                            title="Supprimer cette étape"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
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

          <form onSubmit={handleAddManualEvent} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
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
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Heure :</span>
              <input
                type="text"
                placeholder="Ex: 10:00"
                value={manualEventTime}
                onChange={(e) => setManualEventTime(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
              <span className="block text-[9px] uppercase text-slate-400 mb-0.5">Tarif estimé (€) :</span>
              <input
                type="number"
                placeholder="Coût individuel"
                value={manualEventCost || ""}
                onChange={(e) => setManualEventCost(Number(e.target.value) || 0)}
                className="bg-slate-800 border border-white/10 rounded-xl p-2 text-xs text-white w-full"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition duration-200 w-full cursor-pointer"
              >
                Ajouter au programme
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
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
  ChevronDown,
  X,
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
import { fetchPlaceHighlightsBatch, type PlaceHighlight } from "../lib/api";

/** Majuscule à la 1re lettre (les libellés Wikidata sont souvent en minuscule). */
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1) : s);

/** Version « grande » d'une image Commons (remplace ?width=N par une large). */
const fullImage = (url: string) => url.replace(/\?width=\d+/, "?width=1400");

/** Donnée d'une image ouverte en plein écran. */
interface LightboxData {
  url: string;
  caption: string;
}

/** Visionneuse plein écran : photo complète (non rognée), fermable au clic/Échap. */
function Lightbox({ data, onClose }: { data: LightboxData | null; onClose: () => void }) {
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onClose]);

  if (!data) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex flex-col items-center max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <img
          src={data.url}
          alt={data.caption}
          className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
        />
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-bold">{data.caption}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white/15 hover:bg-white/25 text-white rounded-full p-1.5 transition cursor-pointer"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Volet « Œuvres à voir » d'un lieu. Reçoit les œuvres DÉJÀ chargées (en lot par
 * le parent) : n'affiche RIEN si le lieu n'a aucune œuvre notable → pas de bouton
 * inutile. Cliquer une œuvre ouvre sa photo en grand.
 */
function PlaceHighlights({
  items,
  isOpen,
  onToggle,
  onOpenImage,
}: {
  items: PlaceHighlight[];
  isOpen: boolean;
  onToggle: () => void;
  onOpenImage: (data: LightboxData) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="pt-1.5 border-t border-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[10px] font-bold text-amber-300/80 hover:text-amber-200 transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <Sparkles className="w-3 h-3" />
        Œuvres à voir
        <span className="text-amber-300/50 font-semibold">({items.length})</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {items.map((it) => {
            const label = cap(it.name);
            return it.imageUrl ? (
              <button
                key={it.name}
                type="button"
                onClick={() => onOpenImage({ url: fullImage(it.imageUrl!), caption: label })}
                className="shrink-0 w-24 group/hl text-left cursor-zoom-in"
                title={`${label} — agrandir`}
              >
                <img
                  src={it.imageUrl}
                  alt={label}
                  loading="lazy"
                  className="w-24 h-24 object-cover rounded-lg border border-white/10 group-hover/hl:border-amber-400/40 transition"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <span className="block text-[9px] text-slate-300 leading-tight mt-1 line-clamp-2 group-hover/hl:text-amber-200">
                  {label}
                </span>
              </button>
            ) : (
              <div key={it.name} className="shrink-0 w-24" title={label}>
                <div className="w-24 h-24 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-2xl">
                  🎨
                </div>
                <span className="block text-[9px] text-slate-300 leading-tight mt-1 line-clamp-2">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Onglet des suggestions d'activités et du programme journalier. */
export default function ItineraryTab() {
  const {
    activeTrip,
    isGenerating,
    generationError,
    handleGenerateItinerary,
    handleMoreSuggestions,
    currentMember,
    handleToggleActivityVote,
    handleDeleteActivity,
    handleClearActivities,
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

  // Compteur de rafraîchissement : réorganise visiblement la liste à chaque clic.
  const [allLoaded, setAllLoaded] = useState(false);
  // Index de la 1re nouvelle suggestion à révéler après « Voir d'autres idées »
  // (pour faire défiler l'utilisateur jusqu'à elle).
  const [scrollToIdx, setScrollToIdx] = useState<number | null>(null);
  // Vue « Mes favoris » (activités que j'ai aimées/votées).
  const [showFavorites, setShowFavorites] = useState(false);
  // Filtre par catégorie réelle (null/"all" = toutes).
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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

  // Statut de planification d'une activité (l'étape du programme qui la porte).
  const findSchedule = (name: string) => {
    const n = name.trim().toLowerCase();
    for (const day of activeTrip.itinerary) {
      for (const ev of day.events) {
        const d = ev.description.trim().toLowerCase();
        if (d === n || d.startsWith(`${n} [`) || d.startsWith(`${n} —`) || d.startsWith(`${n} -`)) {
          return { day: day.day, time: ev.time, endTime: ev.endTime };
        }
      }
    }
    return null;
  };

  // Activités non planifiées, et catégories réellement présentes (pour le filtre).
  const unplannedPool = activeTrip.activities.filter((act) => !isPlanned(act.name));
  const presentCategories: string[] = Array.from(
    new Set(unplannedPool.map((a) => String(a.category)).filter((c) => c.length > 0)),
  );
  const suggestionPool =
    categoryFilter === "all"
      ? unplannedPool
      : unplannedPool.filter((a) => a.category === categoryFilter);

  // Mes favoris = activités que j'ai aimées (vote), planifiées ou non.
  const favorites = activeTrip.activities.filter((a) => a.votes.includes(currentMember.id));

  // Ordre STABLE (du + au - connu) : surtout pas de rotation, qui casserait
  // l'ordre de notoriété quand on charge d'autres idées.
  const listToRender = showFavorites ? favorites : suggestionPool;

  // Œuvres à voir : on récupère EN LOT (1 requête groupée) les œuvres des lieux
  // Culture/Visite affichés, pour n'afficher le bouton « Œuvres à voir » que là
  // où il y en a vraiment. Mémorisé par nom : on ne redemande que les NOUVEAUX
  // lieux (après « Voir d'autres idées »), et `n in highlights` mémorise aussi
  // les lieux sans œuvre (valeur []) pour ne pas les re-interroger.
  const [highlights, setHighlights] = useState<Record<string, PlaceHighlight[]>>({});
  // Photo ouverte en plein écran (clic sur une vignette de lieu ou d'œuvre).
  const [lightbox, setLightbox] = useState<LightboxData | null>(null);
  // Volet « Œuvres à voir » actuellement déplié (un seul à la fois — accordéon).
  const [openHighlight, setOpenHighlight] = useState<string | null>(null);
  const highlightNamesKey = listToRender
    .filter((a) => a.category === "Culture" || a.category === "Visite")
    .map((a) => a.name)
    .join("|");
  useEffect(() => {
    const names = highlightNamesKey ? highlightNamesKey.split("|") : [];
    const need = names.filter((n) => !(n in highlights));
    if (need.length === 0) return;
    let cancelled = false;
    fetchPlaceHighlightsBatch(need).then((map) => {
      if (!cancelled) setHighlights((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [highlightNamesKey, highlights]);

  // « Voir d'autres idées » : va chercher la page SUIVANTE. Les nouvelles
  // s'ajoutent EN DESSOUS (ordre préservé) et on fait défiler jusqu'à la 1re
  // nouveauté. Si le catalogue est épuisé, on le signale sans toucher à la liste.
  const seeMore = async () => {
    const firstNew = suggestionPool.length;
    const added = await handleMoreSuggestions();
    if (added > 0) {
      setScrollToIdx(firstNew);
      setAllLoaded(false);
    } else {
      setAllLoaded(true);
    }
  };

  // Défile en douceur jusqu'à la 1re nouvelle suggestion une fois qu'elle est rendue.
  useEffect(() => {
    if (scrollToIdx == null) return;
    const el = document.getElementById(`sugg-card-${scrollToIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToIdx(null);
    }
  }, [scrollToIdx, suggestionPool.length]);

  // Repart à zéro (« tout chargé ») quand la destination change.
  useEffect(() => {
    setAllLoaded(false);
  }, [activeTrip.selectedDestination]);

  // Emoji de catégorie réelle (tag OSM) pour le badge des cartes.
  const CATEGORY_EMOJI: Record<string, string> = {
    Nature: "⛰️",
    Culture: "🏛️",
    Gastronomie: "🍽️",
    Loisir: "🎟️",
    Visite: "📍",
    Shopping: "🛍️",
    "Bien-être": "💆",
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
            Explorez {activeTrip.selectedDestination ? `à ${activeTrip.selectedDestination}` : "votre destination"} de vrais lieux, géolocalisés via OpenStreetMap & Wikipédia.
          </p>
        </div>

        {!activeTrip.selectedDestination && (
          <div className="shrink-0 self-end md:self-auto">
            <span className="text-[11px] text-rose-300 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/30 font-semibold uppercase">
              ⚠️ Votez d'abord une ville gagnante
            </span>
          </div>
        )}
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
                ? `Découvrez les vrais lieux à ${activeTrip.selectedDestination} : monuments, musées, parcs, points de vue… géolocalisés via OpenStreetMap 🗺️ et décrits par Wikipédia 📚, classés par notoriété.`
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              {showFavorites
                ? `⭐ Mes favoris (${favorites.length})`
                : `📂 Idées de sorties (${suggestionPool.length})`}
            </h4>

            {/* Suggestions list scroll box */}
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {listToRender.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-2xl px-4">
                  {showFavorites
                    ? "Aucun favori pour l'instant. Cliquez sur 👍 sous une activité pour l'ajouter à tes favoris."
                    : "🎉 Toutes les idées sont déjà au programme. Cliquez sur « Voir d'autres idées » pour en découvrir d'autres."}
                </div>
              )}
              {listToRender.map((act, idx) => {
                  const isVotedByCurrent = act.votes.includes(currentMember.id);
                  const totalVotes = act.votes.length;
                  const schedule = findSchedule(act.name);

                  return (
                    <div key={act.id} id={`sugg-card-${idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2 hover:border-indigo-500/30 transition-all group scroll-mt-4">
                      {/* Carte horizontale : vignette carrée (photo réelle, peu coupée) + contenu */}
                      <div className="flex gap-3">
                        {act.imageUrl && (
                          <div className="relative shrink-0">
                            <img
                              src={act.imageUrl}
                              alt={act.name}
                              loading="lazy"
                              onClick={() =>
                                act.imageUrl &&
                                setLightbox({ url: fullImage(act.imageUrl), caption: cap(act.name) })
                              }
                              className="w-32 h-32 sm:w-40 sm:h-40 object-cover object-center rounded-xl border border-white/10 cursor-zoom-in hover:border-indigo-400/40 transition"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                            {act.cost > 0 && (
                              <span className="absolute top-1 left-1 text-[10px] font-bold text-emerald-200 bg-emerald-950/85 border border-emerald-900/40 px-1.5 py-0.5 rounded">
                                {act.cost}€
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-sm text-indigo-50 leading-snug">{cap(act.name)}</h5>
                            {!act.imageUrl && act.cost > 0 && (
                              <span className="text-xs font-bold text-emerald-400 shrink-0 bg-emerald-950/60 border border-emerald-900/30 px-2 py-0.5 rounded">
                                {act.cost}€
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {act.category && (
                              <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none whitespace-nowrap uppercase tracking-wide">
                                {CATEGORY_EMOJI[act.category] ?? "📍"} {act.category}
                              </span>
                            )}
                            {/* Note RÉELLE si la source la fournit (jamais inventée) */}
                            {act.rating != null && (
                              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none whitespace-nowrap">
                                ⭐ {act.rating}
                                {act.proposedBy === "Foursquare" ? "/10" : "/5"}
                                {act.reviewsCount ? ` (${act.reviewsCount})` : ""}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                            {act.description}
                          </p>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-wrap">
                            Source : <strong className="text-indigo-300 font-semibold">{act.proposedBy}</strong>
                            {act.bookingUrl && (
                              <a
                                href={act.bookingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline transition ml-1"
                              >
                                Voir le lieu ↗️
                              </a>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Œuvres majeures à voir (affiché seulement s'il y en a) */}
                      <PlaceHighlights
                        items={highlights[act.name] ?? []}
                        isOpen={openHighlight === act.id}
                        onToggle={() =>
                          setOpenHighlight((cur) => (cur === act.id ? null : act.id))
                        }
                        onOpenImage={setLightbox}
                      />

                      <div className="flex items-center justify-end pt-1.5 border-t border-white/5">
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

                          {/* Déjà au programme → badge ; sinon bouton Planifier */}
                          {schedule ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 whitespace-nowrap">
                              <CalendarPlus className="w-3 h-3" /> Jour {schedule.day} · {schedule.time}
                              {schedule.endTime ? `–${schedule.endTime}` : ""}
                            </span>
                          ) : (
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
                          )}
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                            title="Retirer cette suggestion"
                          >
                            <Trash2 className="w-3 h-3" />
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

            {/* Contrôles en bas : vue (idées / favoris) + recherche réelle */}
            <div className="space-y-2.5 pt-1 border-t border-white/10">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setShowFavorites(false)}
                  className={`px-2 py-1.5 text-[10.5px] font-bold rounded-lg transition cursor-pointer ${
                    !showFavorites ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  📂 Toutes les idées
                </button>
                <button
                  onClick={() => setShowFavorites(true)}
                  className={`px-2 py-1.5 text-[10.5px] font-bold rounded-lg transition cursor-pointer ${
                    showFavorites ? "bg-amber-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                  title="Mes activités favorites (votées) et leur statut de planification"
                >
                  ⭐ Favoris{favorites.length > 0 ? ` (${favorites.length})` : ""}
                </button>
              </div>

              {/* Filtres par catégorie réelle (affichés selon ce qui existe) */}
              {!showFavorites && presentCategories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition cursor-pointer ${
                      categoryFilter === "all" ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Toutes
                  </button>
                  {presentCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition cursor-pointer ${
                        categoryFilter === cat ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {CATEGORY_EMOJI[cat] ?? "📍"} {cat}
                    </button>
                  ))}
                </div>
              )}

              {!showFavorites && activeTrip.selectedDestination && (
                <button
                  onClick={seeMore}
                  disabled={isGenerating || allLoaded}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:hover:bg-indigo-600 text-white text-[11px] font-bold py-2.5 rounded-xl transition cursor-pointer disabled:cursor-default"
                  title="Charger d'autres vrais lieux de la destination (les nouveaux s'ajoutent en dessous)"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recherche en cours…
                    </>
                  ) : allLoaded ? (
                    <>✓ Toutes les pépites disponibles sont affichées</>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Voir d'autres idées
                    </>
                  )}
                </button>
              )}

              {!showFavorites && suggestionPool.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Vider toutes les suggestions de ce voyage ? (le programme déjà planifié n'est pas touché)"))
                      handleClearActivities();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 text-[10.5px] font-semibold py-2 rounded-xl border border-white/10 transition cursor-pointer"
                  title="Supprimer toutes les suggestions (utile pour repartir sur du réel)"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Nettoyer les suggestions
                </button>
              )}
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

      <Lightbox data={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

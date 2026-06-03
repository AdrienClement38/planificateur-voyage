import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type SetStateAction,
} from "react";
import { connectTripSocket } from "../lib/realtime";
import type { ActivityProposal, Member, Trip } from "../types";
import { computeBudgetBreakdown, type BudgetBreakdown } from "../domain/budget";
import { findBestTravelWindow } from "../domain/availability";
import {
  buildAutoPlanItinerary,
  buildEmptyItinerary,
  getMockDynamicItinerary,
} from "../domain/itinerary";
import { suggestActivities } from "../lib/api";
import {
  ApiError,
  authApi,
  tripsApi,
  type ActivityInput,
  type AuthUser,
  type TripSummary,
} from "../lib/apiClient";

export type BudgetType = "Économique" | "Modéré" | "Luxe";
export type ActivePage = "dashboard" | "account" | "create-trip";
export type ActiveTab = "calendar" | "voting" | "itinerary" | "chat" | "media";
export type ActivityFilter = "all" | "gyg" | "airbnb" | "google";
export type AuthStatus = "loading" | "authed" | "anon";

const CACHE_PREFIX = "cotripper_trip_cache_";
const EMPTY_BUDGET: BudgetBreakdown = {
  activitiesCost: 0,
  totalLodging: 0,
  totalLocalTransport: 0,
  flightCost: 0,
  totalIndividual: 0,
};

function cacheTrip(trip: Trip) {
  try {
    localStorage.setItem(CACHE_PREFIX + trip.id, JSON.stringify(trip));
  } catch {
    /* quota / mode privé : on ignore */
  }
}
function readCachedTrip(id: string): Trip | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

/**
 * Contrôleur central de l'application : état d'authentification, voyages, et
 * tous les handlers (adossés à l'API REST, avec cache hors-ligne et remontée
 * d'erreurs). Renvoyé tel quel comme valeur du `TripContext`.
 */
export function useTripController() {
  // --- Authentification ---
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState("");

  // --- Voyages ---
  const [trips, setTripsList] = useState<TripSummary[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isLoadingTrip, setIsLoadingTrip] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const socketCloser = useRef<(() => void) | null>(null);

  // --- Navigation ---
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");

  // --- Formulaires ---
  const [newTripName, setNewTripName] = useState("");
  const [newTripDestination, setNewTripDestination] = useState("");
  const [newTripDays, setNewTripDays] = useState(4);
  const [newTripBudget, setNewTripBudget] = useState<BudgetType>("Modéré");
  const [newDestName, setNewDestName] = useState("");
  const [chatText, setChatText] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [dragActive, setDragActive] = useState(false);
  const [simulatedDocName, setSimulatedDocName] = useState("");
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [photoCaptionInput, setPhotoCaptionInput] = useState("");
  const [manualEventDay, setManualEventDay] = useState(1);
  const [manualEventTime, setManualEventTime] = useState("10:00");
  const [manualEventEndTime, setManualEventEndTime] = useState("");
  const [manualEventDesc, setManualEventDesc] = useState("");
  const [manualEventCost, setManualEventCost] = useState(0);
  const [isBudgetDropdownOpen, setIsBudgetDropdownOpen] = useState(false);
  const [joinTripIdInput, setJoinTripIdInput] = useState("");

  // --- Génération d'itinéraire ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  // ----------------------------------------------------------------- Helpers

  const refreshTripsList = useCallback(async (): Promise<TripSummary[]> => {
    const { trips: list } = await tripsApi.list();
    setTripsList(list);
    return list;
  }, []);

  /**
   * (Re)connecte le WebSocket temps réel au voyage donné. Idempotent : ferme
   * d'abord l'éventuel socket précédent. Toute modification (par n'importe quel
   * membre) arrive en direct et patche l'état actif — aucun rechargement.
   */
  const subscribeToTrip = useCallback(
    (id: string) => {
      socketCloser.current?.();
      socketCloser.current = connectTripSocket(id, {
        onTrip: (t) => {
          setActiveTrip(t);
          cacheTrip(t);
        },
        onDeleted: () => {
          socketCloser.current?.();
          socketCloser.current = null;
          setActiveTrip(null);
          setSelectedTripId(null);
          void refreshTripsList();
        },
      });
    },
    [refreshTripsList],
  );

  const openTrip = useCallback(
    async (id: string) => {
      setSelectedTripId(id);
      setIsLoadingTrip(true);
      setMutationError("");
      try {
        const { trip } = await tripsApi.get(id);
        setActiveTrip(trip);
        cacheTrip(trip);
        subscribeToTrip(id);
      } catch (err) {
        const cached = readCachedTrip(id);
        if (cached) {
          setActiveTrip(cached);
          setMutationError("Hors-ligne : données en cache affichées.");
        } else {
          setActiveTrip(null);
          setMutationError(err instanceof ApiError ? err.message : "Chargement impossible.");
        }
      } finally {
        setIsLoadingTrip(false);
      }
    },
    [subscribeToTrip],
  );

  /** Exécute une mutation API : met à jour le voyage actif + cache, remonte l'erreur. */
  const applyMutation = useCallback(
    async (fn: () => Promise<{ trip: Trip | null }>) => {
      setMutationError("");
      try {
        const { trip } = await fn();
        if (trip) {
          setActiveTrip(trip);
          cacheTrip(trip);
        }
      } catch (err) {
        setMutationError(err instanceof ApiError ? err.message : "Action impossible.");
      }
    },
    [],
  );

  const loadAfterAuth = useCallback(
    async (user: AuthUser) => {
      setCurrentUser(user);
      setAuthStatus("authed");
      const list = await refreshTripsList();
      if (list.length > 0) await openTrip(list[0].id);
      else setActiveTrip(null);
    },
    [refreshTripsList, openTrip],
  );

  // Restauration de session au démarrage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await authApi.me();
        if (!cancelled) await loadAfterAuth(user);
      } catch {
        if (!cancelled) setAuthStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAfterAuth]);

  // Ferme proprement le WebSocket temps réel au démontage du contrôleur.
  useEffect(() => () => socketCloser.current?.(), []);

  // ----------------------------------------------------------------- Auth

  const handleSignup = useCallback(
    async (email: string, password: string, displayName: string) => {
      setAuthError("");
      try {
        const { user } = await authApi.signup({ email, password, displayName });
        await loadAfterAuth(user);
        setActivePage("dashboard");
      } catch (err) {
        setAuthError(err instanceof ApiError ? err.message : "Inscription impossible.");
      }
    },
    [loadAfterAuth],
  );

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setAuthError("");
      try {
        const { user } = await authApi.login({ email, password });
        await loadAfterAuth(user);
        setActivePage("dashboard");
      } catch (err) {
        setAuthError(err instanceof ApiError ? err.message : "Connexion impossible.");
      }
    },
    [loadAfterAuth],
  );

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* on déconnecte localement quoi qu'il arrive */
    }
    socketCloser.current?.();
    socketCloser.current = null;
    setCurrentUser(null);
    setAuthStatus("anon");
    setTripsList([]);
    setActiveTrip(null);
    setSelectedTripId(null);
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "co-tripper-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMutationError(err instanceof ApiError ? err.message : "Export impossible.");
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await authApi.deleteAccount();
    } catch (err) {
      setMutationError(err instanceof ApiError ? err.message : "Suppression impossible.");
      return;
    }
    socketCloser.current?.();
    socketCloser.current = null;
    setCurrentUser(null);
    setAuthStatus("anon");
    setTripsList([]);
    setActiveTrip(null);
    setSelectedTripId(null);
  }, []);

  const handleUpdateProfile = useCallback(
    async (displayName: string, avatar: string) => {
      try {
        const { user } = await authApi.updateProfile({ displayName, avatar });
        setCurrentUser(user);
        // Le membre dans l'agrégat se met à jour au prochain chargement ; on
        // rafraîchit le voyage actif pour refléter le nom/avatar immédiatement.
        if (selectedTripId) await openTrip(selectedTripId);
      } catch (err) {
        setMutationError(err instanceof ApiError ? err.message : "Mise à jour impossible.");
      }
    },
    [selectedTripId, openTrip],
  );

  // ----------------------------------------------------------------- Voyages

  const handleSelectTrip = useCallback(
    (id: string) => {
      setGenerationError("");
      void openTrip(id);
    },
    [openTrip],
  );

  const handleCreateTrip = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!newTripName.trim()) return;
      try {
        const { trip } = await tripsApi.create({
          name: newTripName.trim(),
          selectedDestination: newTripDestination.trim() || undefined,
          targetDays: newTripDays,
          budgetType: newTripBudget,
        });
        await refreshTripsList();
        setActiveTrip(trip);
        setSelectedTripId(trip.id);
        cacheTrip(trip);
        subscribeToTrip(trip.id);
        setNewTripName("");
        setNewTripDestination("");
        setActivePage("dashboard");
      } catch (err) {
        setMutationError(err instanceof ApiError ? err.message : "Création impossible.");
      }
    },
    [newTripName, newTripDestination, newTripDays, newTripBudget, refreshTripsList, subscribeToTrip],
  );

  const handleDeleteTrip = useCallback(
    async (id: string) => {
      try {
        await tripsApi.remove(id);
        const list = await refreshTripsList();
        if (list.length > 0) await openTrip(list[0].id);
        else {
          setActiveTrip(null);
          setSelectedTripId(null);
        }
      } catch (err) {
        setMutationError(err instanceof ApiError ? err.message : "Suppression impossible.");
      }
    },
    [refreshTripsList, openTrip],
  );

  const handleJoinTrip = useCallback(
    async (id: string) => {
      const tripId = id.trim();
      if (!tripId) return;
      try {
        const { trip } = await tripsApi.join(tripId);
        await refreshTripsList();
        setActiveTrip(trip);
        setSelectedTripId(trip.id);
        cacheTrip(trip);
        subscribeToTrip(trip.id);
        setJoinTripIdInput("");
        setActivePage("dashboard");
      } catch (err) {
        setMutationError(err instanceof ApiError ? err.message : "Voyage introuvable.");
      }
    },
    [refreshTripsList, subscribeToTrip],
  );

  const handleUpdateTransportValue = useCallback(
    (value: number) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.patch(activeTrip.id, { externalTransportCost: value }));
    },
    [activeTrip, applyMutation],
  );

  const handlePatchTrip = useCallback(
    (fields: Record<string, unknown>) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.patch(activeTrip.id, fields));
    },
    [activeTrip, applyMutation],
  );

  // ----------------------------------------------------------------- Contenu

  const handleAddDestination = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!activeTrip || !newDestName.trim()) return;
      const name = newDestName.trim();
      setNewDestName("");
      void applyMutation(() => tripsApi.addDestination(activeTrip.id, { name }));
    },
    [activeTrip, newDestName, applyMutation],
  );

  const handleVoteDestination = useCallback(
    (destId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.voteDestination(activeTrip.id, destId));
    },
    [activeTrip, applyMutation],
  );

  /** Définit explicitement la destination du voyage (le vote ne le fait pas tout seul). */
  const handleChooseDestination = useCallback(
    (name: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.patch(activeTrip.id, { selectedDestination: name }));
    },
    [activeTrip, applyMutation],
  );

  const handleDeleteDestinationProposal = useCallback(
    (destId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.deleteDestination(activeTrip.id, destId));
    },
    [activeTrip, applyMutation],
  );

  const handleToggleActivityVote = useCallback(
    (activityId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.voteActivity(activeTrip.id, activityId));
    },
    [activeTrip, applyMutation],
  );

  const handleScheduleActivity = useCallback(
    (act: ActivityProposal, dayNum: number, timeStr = "10:00", endTime?: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.addEvent(activeTrip.id, {
          day: dayNum,
          time: timeStr,
          endTime: endTime || undefined,
          description: `${act.name}${act.source ? ` [${act.source}]` : ""}`,
          cost: act.cost,
          bookingUrl: act.bookingUrl || undefined,
        }),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleAutoPlanFromVotes = useCallback(async () => {
    if (!activeTrip) return;
    setIsGenerating(true);
    const days = buildAutoPlanItinerary(activeTrip).map((d) => ({
      day: d.day,
      title: d.title,
      events: d.events.map((e) => ({
        time: e.time,
        endTime: e.endTime,
        description: e.description,
        cost: e.cost,
      })),
    }));
    await applyMutation(() => tripsApi.putItinerary(activeTrip.id, days));
    setIsGenerating(false);
  }, [activeTrip, applyMutation]);

  const handleGenerateItinerary = useCallback(async () => {
    if (!activeTrip) return;
    if (!activeTrip.selectedDestination) {
      setGenerationError("Veuillez voter d'abord pour une destination gagnante.");
      return;
    }
    setIsGenerating(true);
    setGenerationError("");

    const existingNames = new Set(activeTrip.activities.map((a) => a.name.toLowerCase().trim()));
    const adults = activeTrip.members.length || 6;
    const { checkin, checkout } = findBestTravelWindow(
      activeTrip.availabilities,
      activeTrip.targetDays,
    );

    try {
      let incoming: ActivityInput[];
      let lodging: number | undefined;
      let transport: number | undefined;

      try {
        const data = (await suggestActivities({
          destination: activeTrip.selectedDestination,
          days: activeTrip.targetDays,
          budgetType: activeTrip.budgetType,
          adults,
          checkin,
          checkout,
        })) as {
          activities?: ActivityProposal[];
          averageLodgingCostPerNight?: number;
          averageLocalTransportCostPerDay?: number;
        };
        incoming = (data.activities ?? []).map(toActivityInput);
        lodging = data.averageLodgingCostPerNight;
        transport = data.averageLocalTransportCostPerDay;
      } catch {
        // Repli hors-ligne déterministe.
        const mock = getMockDynamicItinerary(
          activeTrip.selectedDestination,
          activeTrip.targetDays,
          activeTrip.budgetType,
        );
        incoming = mock.activities.map((a) => ({
          name: a.name,
          description: a.description,
          cost: a.cost,
          category: a.category,
        }));
        lodging = mock.averageLodgingCostPerNight;
        transport = mock.averageLocalTransportCostPerDay;
      }

      const fresh = incoming.filter((a) => !existingNames.has(a.name.toLowerCase().trim()));
      if (fresh.length > 0) await tripsApi.bulkActivities(activeTrip.id, fresh);
      if (lodging != null || transport != null) {
        await tripsApi.patch(activeTrip.id, {
          ...(lodging != null ? { averageLodgingCostPerNight: lodging } : {}),
          ...(transport != null ? { averageLocalTransportCostPerDay: transport } : {}),
        });
      }
      const hasPlanned = activeTrip.itinerary.some((d) => d.events.length > 0);
      if (!hasPlanned) {
        const empty = buildEmptyItinerary(activeTrip.targetDays, activeTrip.selectedDestination).map(
          (d) => ({ day: d.day, title: d.title, events: [] }),
        );
        await tripsApi.putItinerary(activeTrip.id, empty);
      }
      await openTrip(activeTrip.id);
    } catch (err) {
      setGenerationError(err instanceof ApiError ? err.message : "Génération impossible.");
    } finally {
      setIsGenerating(false);
    }
  }, [activeTrip, openTrip]);

  /**
   * Récupère un lot SUPPLÉMENTAIRE d'activités d'une source précise (bouton
   * « Chercher plus sur GetYourGuide / Airbnb / Google »), paginé, et l'ajoute
   * au pool (dédupliqué par nom). Renvoie le nombre de nouveautés ajoutées.
   */
  const handleFetchMoreActivities = useCallback(
    async (source: string, page: number): Promise<number> => {
      if (!activeTrip || !activeTrip.selectedDestination) return 0;
      setIsGenerating(true);
      setGenerationError("");
      try {
        const data = (await suggestActivities({
          destination: activeTrip.selectedDestination,
          days: activeTrip.targetDays,
          budgetType: activeTrip.budgetType,
          adults: activeTrip.members.length || 6,
          source,
          page,
        })) as { activities?: ActivityProposal[] };

        const existingNames = new Set(activeTrip.activities.map((a) => a.name.toLowerCase().trim()));
        const fresh = (data.activities ?? [])
          .map(toActivityInput)
          .filter((a) => !existingNames.has(a.name.toLowerCase().trim()));

        if (fresh.length > 0) {
          await tripsApi.bulkActivities(activeTrip.id, fresh);
          await openTrip(activeTrip.id);
        }
        // Aucune nouveauté = silencieux : la liste se réorganise quand même
        // côté UI, on n'affiche pas d'erreur (le catalogue est simplement épuisé).
        return fresh.length;
      } catch (err) {
        setGenerationError(err instanceof ApiError ? err.message : "Recherche impossible.");
        return 0;
      } finally {
        setIsGenerating(false);
      }
    },
    [activeTrip, openTrip],
  );

  const handleSendChat = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!activeTrip || !chatText.trim()) return;
      const text = chatText.trim();
      setChatText("");
      void applyMutation(() => tripsApi.sendMessage(activeTrip.id, text));
    },
    [activeTrip, chatText, applyMutation],
  );

  const handleAddManualEvent = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!activeTrip || !manualEventDesc.trim()) return;
      const payload = {
        day: Number(manualEventDay),
        time: manualEventTime,
        endTime: manualEventEndTime.trim() || undefined,
        description: manualEventDesc,
        cost: Number(manualEventCost) || 0,
      };
      setManualEventDesc("");
      setManualEventCost(0);
      setManualEventEndTime("");
      void applyMutation(() => tripsApi.addEvent(activeTrip.id, payload));
    },
    [
      activeTrip,
      manualEventDay,
      manualEventTime,
      manualEventEndTime,
      manualEventDesc,
      manualEventCost,
      applyMutation,
    ],
  );

  const handleDeleteEvent = useCallback(
    (_dayNum: number, eventId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.deleteEvent(activeTrip.id, eventId));
    },
    [activeTrip, applyMutation],
  );

  const handleUpdateEvent = useCallback(
    (
      eventId: string,
      fields: {
        time?: string;
        endTime?: string | null;
        description?: string;
        cost?: number;
        bookingUrl?: string | null;
      },
    ) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.updateEvent(activeTrip.id, eventId, fields));
    },
    [activeTrip, applyMutation],
  );

  const handleAddAvailability = useCallback(
    (start: string, end: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.addAvailability(activeTrip.id, { start, end }));
    },
    [activeTrip, applyMutation],
  );

  const handleDeleteAvailability = useCallback(
    (availId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.deleteAvailability(activeTrip.id, availId));
    },
    [activeTrip, applyMutation],
  );

  // --- Médias ---
  const uploadDoc = useCallback(
    (name: string, sizeBytes?: number) => {
      if (!activeTrip) return;
      const size = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) + " MB" : "120 KB";
      const type = name.endsWith(".pdf")
        ? "pdf"
        : name.endsWith(".png") || name.endsWith(".jpg")
          ? "image"
          : "doc";
      void applyMutation(() => tripsApi.addDocument(activeTrip.id, { name, type, size }));
    },
    [activeTrip, applyMutation],
  );

  const handleAddManualDoc = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!simulatedDocName.trim()) return;
      const name = simulatedDocName.includes(".") ? simulatedDocName : simulatedDocName + ".pdf";
      uploadDoc(name);
      setSimulatedDocName("");
    },
    [simulatedDocName, uploadDoc],
  );

  /** Téléverse un vrai fichier (image/PDF) vers l'API (limites côté serveur). */
  const handleUploadFile = useCallback(
    (file: File) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.uploadFile(activeTrip.id, file));
    },
    [activeTrip, applyMutation],
  );

  const handleAddPhoto = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!activeTrip) return;
      const fallbacks = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80",
      ];
      const url = photoUrlInput.trim() || fallbacks[Math.floor(Math.random() * fallbacks.length)];
      const caption = photoCaptionInput.trim() || "Un magnifique spot repéré pour le séjour !";
      setPhotoUrlInput("");
      setPhotoCaptionInput("");
      void applyMutation(() => tripsApi.addPhoto(activeTrip.id, { url, caption }));
    },
    [activeTrip, photoUrlInput, photoCaptionInput, applyMutation],
  );

  const handleDeleteDoc = useCallback(
    (docId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.deleteDocument(activeTrip.id, docId));
    },
    [activeTrip, applyMutation],
  );

  const handleDeletePhoto = useCallback(
    (photoId: string) => {
      if (!activeTrip) return;
      void applyMutation(() => tripsApi.deletePhoto(activeTrip.id, photoId));
    },
    [activeTrip, applyMutation],
  );

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && activeTrip) {
        void applyMutation(() => tripsApi.uploadFile(activeTrip.id, file));
      }
    },
    [activeTrip, applyMutation],
  );

  // ----------------------------------------------------------------- Dérivés

  const currentMember: Member | null = useMemo(
    () =>
      currentUser
        ? { id: currentUser.id, name: currentUser.displayName, avatar: currentUser.avatar ?? "" }
        : null,
    [currentUser],
  );

  const members = activeTrip?.members ?? [];

  const budgetBreakdown = useMemo(
    () => (activeTrip ? computeBudgetBreakdown(activeTrip) : EMPTY_BUDGET),
    [activeTrip],
  );

  return {
    // auth
    currentUser,
    authStatus,
    authError,
    handleSignup,
    handleLogin,
    handleLogout,
    handleUpdateProfile,
    handleExportData,
    handleDeleteAccount,
    // données
    trips,
    activeTrip,
    selectedTripId,
    isLoadingTrip,
    mutationError,
    currentMember,
    currentMemberId: currentUser?.id ?? "",
    members,
    budgetBreakdown,
    // nav
    activePage,
    setActivePage,
    activeTab,
    setActiveTab,
    // formulaires
    newTripName,
    setNewTripName,
    newTripDestination,
    setNewTripDestination,
    newTripDays,
    setNewTripDays,
    newTripBudget,
    setNewTripBudget,
    newDestName,
    setNewDestName,
    chatText,
    setChatText,
    activityFilter,
    setActivityFilter,
    dragActive,
    simulatedDocName,
    setSimulatedDocName,
    photoUrlInput,
    setPhotoUrlInput,
    photoCaptionInput,
    setPhotoCaptionInput,
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
    isBudgetDropdownOpen,
    setIsBudgetDropdownOpen,
    joinTripIdInput,
    setJoinTripIdInput,
    isGenerating,
    generationError,
    // voyages
    handleSelectTrip,
    handleCreateTrip,
    handleDeleteTrip,
    handleJoinTrip,
    handleUpdateTransportValue,
    handlePatchTrip,
    // contenu
    handleAddDestination,
    handleVoteDestination,
    handleChooseDestination,
    handleDeleteDestinationProposal,
    handleToggleActivityVote,
    handleScheduleActivity,
    handleAutoPlanFromVotes,
    handleGenerateItinerary,
    handleFetchMoreActivities,
    handleSendChat,
    handleAddManualEvent,
    handleDeleteEvent,
    handleUpdateEvent,
    handleAddAvailability,
    handleDeleteAvailability,
    handleAddManualDoc,
    handleUploadFile,
    handleAddPhoto,
    handleDeleteDoc,
    handleDeletePhoto,
    handleDrag,
    handleDrop,
  };
}

function toActivityInput(a: ActivityProposal): ActivityInput {
  return {
    name: a.name,
    description: a.description,
    cost: a.cost,
    category: a.category,
    proposedBy: a.proposedBy,
    source: a.source,
    rating: a.rating,
    reviewsCount: a.reviewsCount,
    duration: a.duration,
    bookingUrl: a.bookingUrl,
  };
}

export type TripStore = ReturnType<typeof useTripController>;

/** Type d'une dispatch d'état (réexporté pour les composants). */
export type SetState<T> = Dispatch<SetStateAction<T>>;

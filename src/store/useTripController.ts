import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
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
import { useActiveTripContent } from "./useActiveTripContent";

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
  // Page courante de suggestions (pagination « Voir d'autres idées »).
  const suggestionPageRef = useRef(0);

  // --- Navigation ---
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");

  // --- Formulaires ---
  const [newTripName, setNewTripName] = useState("");
  const [newTripDestination, setNewTripDestination] = useState("");
  const [newTripDays, setNewTripDays] = useState(4);
  const [newTripBudget, setNewTripBudget] = useState<BudgetType>("Modéré");
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
          setMutationError(
            err instanceof ApiError ? err.message : "Chargement impossible.",
          );
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
        setMutationError(
          err instanceof ApiError ? err.message : "Action impossible.",
        );
      }
    },
    [],
  );

  // Contenu collaboratif du voyage actif (votes, planning, chat, médias, drag-and-
  // drop) : hook dédié, ne dépendant que du voyage actif et de `applyMutation`.
  const content = useActiveTripContent({ activeTrip, applyMutation });

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
        setAuthError(
          err instanceof ApiError ? err.message : "Inscription impossible.",
        );
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
        setAuthError(
          err instanceof ApiError ? err.message : "Connexion impossible.",
        );
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
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "co-tripper-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMutationError(
        err instanceof ApiError ? err.message : "Export impossible.",
      );
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await authApi.deleteAccount();
    } catch (err) {
      setMutationError(
        err instanceof ApiError ? err.message : "Suppression impossible.",
      );
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
        setMutationError(
          err instanceof ApiError ? err.message : "Mise à jour impossible.",
        );
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
        setMutationError(
          err instanceof ApiError ? err.message : "Création impossible.",
        );
      }
    },
    [
      newTripName,
      newTripDestination,
      newTripDays,
      newTripBudget,
      refreshTripsList,
      subscribeToTrip,
    ],
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
        setMutationError(
          err instanceof ApiError ? err.message : "Suppression impossible.",
        );
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
        setMutationError(
          err instanceof ApiError ? err.message : "Voyage introuvable.",
        );
      }
    },
    [refreshTripsList, subscribeToTrip],
  );

  const handleUpdateTransportValue = useCallback(
    (value: number) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.patch(activeTrip.id, { externalTransportCost: value }),
      );
    },
    [activeTrip, applyMutation],
  );

  const handlePatchTrip = useCallback(
    (fields: Record<string, unknown>) => {
      if (!activeTrip) return;
      // Changement RÉEL de destination → les suggestions de l'ancienne ville n'ont
      // plus aucun sens (on resterait sur des lieux de Moselle pour un voyage en
      // Ardèche). On les purge dans la foulée ; le programme DÉJÀ PLANIFIÉ, lui,
      // reste intact (clearActivities ne touche pas l'itinéraire).
      const nextDest = fields.selectedDestination;
      const destChanged =
        typeof nextDest === "string" &&
        nextDest.trim() !== (activeTrip.selectedDestination ?? "").trim();
      void applyMutation(async () => {
        const patched = await tripsApi.patch(activeTrip.id, fields);
        return destChanged
          ? await tripsApi.clearActivities(activeTrip.id)
          : patched;
      });
    },
    [activeTrip, applyMutation],
  );

  // ----------------------------------------------------------------- Contenu

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
      setGenerationError(
        "Veuillez voter d'abord pour une destination gagnante.",
      );
      return;
    }
    setIsGenerating(true);
    setGenerationError("");

    const existingNames = new Set(
      activeTrip.activities.map((a) => a.name.toLowerCase().trim()),
    );
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

      const fresh = incoming.filter(
        (a) => !existingNames.has(a.name.toLowerCase().trim()),
      );
      if (fresh.length > 0) await tripsApi.bulkActivities(activeTrip.id, fresh);
      if (lodging != null || transport != null) {
        await tripsApi.patch(activeTrip.id, {
          ...(lodging != null ? { averageLodgingCostPerNight: lodging } : {}),
          ...(transport != null
            ? { averageLocalTransportCostPerDay: transport }
            : {}),
        });
      }
      const hasPlanned = activeTrip.itinerary.some((d) => d.events.length > 0);
      if (!hasPlanned) {
        const empty = buildEmptyItinerary(
          activeTrip.targetDays,
          activeTrip.selectedDestination,
        ).map((d) => ({ day: d.day, title: d.title, events: [] }));
        await tripsApi.putItinerary(activeTrip.id, empty);
      }
      suggestionPageRef.current = 0; // page 0 vient d'être chargée ; « plus » ira en page 1
      await openTrip(activeTrip.id);
    } catch (err) {
      setGenerationError(
        err instanceof ApiError ? err.message : "Génération impossible.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [activeTrip, openTrip]);

  /**
   * « Voir d'autres idées » : va chercher la PAGE SUIVANTE de la liste profonde
   * (déjà classée du plus au moins pertinent) et l'ajoute au pool SANS supprimer
   * les anciennes (dédupliqué par nom). Si une page ne contient que du déjà-vu
   * (ex. après un rechargement), on avance jusqu'à trouver du neuf ou épuiser le
   * catalogue. Renvoie le nombre de nouveautés ajoutées (0 = plus rien à proposer).
   */
  const handleMoreSuggestions = useCallback(async (): Promise<number> => {
    if (!activeTrip || !activeTrip.selectedDestination) return 0;
    setIsGenerating(true);
    setGenerationError("");
    try {
      const existingNames = new Set(
        activeTrip.activities.map((a) => a.name.toLowerCase().trim()),
      );
      for (let tries = 0; tries < 4; tries++) {
        const nextPage = suggestionPageRef.current + 1;
        const data = (await suggestActivities({
          destination: activeTrip.selectedDestination,
          days: activeTrip.targetDays,
          budgetType: activeTrip.budgetType,
          adults: activeTrip.members.length || 6,
          page: nextPage,
        })) as { activities?: ActivityProposal[] };
        const returned = data.activities ?? [];
        suggestionPageRef.current = nextPage;
        if (returned.length === 0) return 0; // catalogue épuisé
        const fresh = returned
          .map(toActivityInput)
          .filter((a) => !existingNames.has(a.name.toLowerCase().trim()));
        if (fresh.length > 0) {
          await tripsApi.bulkActivities(activeTrip.id, fresh);
          await openTrip(activeTrip.id);
          return fresh.length;
        }
        // Page entièrement déjà connue → on tente la suivante.
      }
      return 0;
    } catch (err) {
      setGenerationError(
        err instanceof ApiError ? err.message : "Recherche impossible.",
      );
      return 0;
    } finally {
      setIsGenerating(false);
    }
  }, [activeTrip, openTrip]);

  // ----------------------------------------------------------------- Dérivés

  const currentMember: Member | null = useMemo(
    () =>
      currentUser
        ? {
            id: currentUser.id,
            name: currentUser.displayName,
            avatar: currentUser.avatar ?? "",
          }
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
    // contenu collaboratif (état de formulaire + handlers) : cf. useActiveTripContent
    ...content,
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
    // contenu — génération d'itinéraire (le reste vient de ...content ci-dessus)
    handleAutoPlanFromVotes,
    handleGenerateItinerary,
    handleMoreSuggestions,
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
    imageUrl: a.imageUrl,
  };
}

export type TripStore = ReturnType<typeof useTripController>;

/** Type d'une dispatch d'état (réexporté pour les composants). */
export type SetState<T> = Dispatch<SetStateAction<T>>;

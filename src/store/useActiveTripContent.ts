import { useCallback, useState, type DragEvent, type FormEvent } from "react";
import type { ActivityProposal, Trip } from "../types";
import { tripsApi } from "../lib/apiClient";
import type { ActivityFilter } from "./useTripController";

/**
 * Édition COLLABORATIVE du voyage actif : votes (destinations/activités),
 * planning manuel, disponibilités, chat, médias, drag-and-drop. Tous ces handlers
 * suivent le même contrat — `if (!activeTrip) return; applyMutation(() =>
 * tripsApi.X(...))` — et ne dépendent QUE du voyage actif et de `applyMutation`
 * (injectés par le contrôleur). Extrait de `useTripController` pour isoler cette
 * responsabilité ; les setters d'état de formulaire sont colocalisés ici avec les
 * handlers qui les consomment. La GÉNÉRATION d'itinéraire reste dans le contrôleur
 * (couplée à `openTrip` + au reset d'erreur au changement de voyage).
 */
interface ActiveTripContentDeps {
  activeTrip: Trip | null;
  applyMutation: (fn: () => Promise<{ trip: Trip | null }>) => Promise<void>;
}

export function useActiveTripContent({
  activeTrip,
  applyMutation,
}: ActiveTripContentDeps) {
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

  const handleAddDestination = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!activeTrip || !newDestName.trim()) return;
      const name = newDestName.trim();
      setNewDestName("");
      void applyMutation(() =>
        tripsApi.addDestination(activeTrip.id, { name }),
      );
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
      void applyMutation(() =>
        tripsApi.patch(activeTrip.id, { selectedDestination: name }),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleDeleteDestinationProposal = useCallback(
    (destId: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.deleteDestination(activeTrip.id, destId),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleToggleActivityVote = useCallback(
    (activityId: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.voteActivity(activeTrip.id, activityId),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleDeleteActivity = useCallback(
    (activityId: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.deleteActivity(activeTrip.id, activityId),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleClearActivities = useCallback(() => {
    if (!activeTrip) return;
    void applyMutation(() => tripsApi.clearActivities(activeTrip.id));
  }, [activeTrip, applyMutation]);

  const handleScheduleActivity = useCallback(
    (
      act: ActivityProposal,
      dayNum: number,
      timeStr = "10:00",
      endTime?: string,
    ) => {
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
      void applyMutation(() =>
        tripsApi.updateEvent(activeTrip.id, eventId, fields),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleAddAvailability = useCallback(
    (start: string, end: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.addAvailability(activeTrip.id, { start, end }),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleDeleteAvailability = useCallback(
    (availId: string) => {
      if (!activeTrip) return;
      void applyMutation(() =>
        tripsApi.deleteAvailability(activeTrip.id, availId),
      );
    },
    [activeTrip, applyMutation],
  );

  // --- Médias ---
  const uploadDoc = useCallback(
    (name: string, sizeBytes?: number) => {
      if (!activeTrip) return;
      const size = sizeBytes
        ? (sizeBytes / (1024 * 1024)).toFixed(1) + " MB"
        : "120 KB";
      const type = name.endsWith(".pdf")
        ? "pdf"
        : name.endsWith(".png") || name.endsWith(".jpg")
          ? "image"
          : "doc";
      void applyMutation(() =>
        tripsApi.addDocument(activeTrip.id, { name, type, size }),
      );
    },
    [activeTrip, applyMutation],
  );

  const handleAddManualDoc = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!simulatedDocName.trim()) return;
      const name = simulatedDocName.includes(".")
        ? simulatedDocName
        : simulatedDocName + ".pdf";
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
      const url =
        photoUrlInput.trim() ||
        fallbacks[Math.floor(Math.random() * fallbacks.length)];
      const caption =
        photoCaptionInput.trim() ||
        "Un magnifique spot repéré pour le séjour !";
      setPhotoUrlInput("");
      setPhotoCaptionInput("");
      void applyMutation(() =>
        tripsApi.addPhoto(activeTrip.id, { url, caption }),
      );
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

  return {
    // état de formulaire (contenu)
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
    // handlers (mutations collaboratives)
    handleAddDestination,
    handleVoteDestination,
    handleChooseDestination,
    handleDeleteDestinationProposal,
    handleToggleActivityVote,
    handleDeleteActivity,
    handleClearActivities,
    handleScheduleActivity,
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

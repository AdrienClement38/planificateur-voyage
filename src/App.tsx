import React, { useState, useMemo, lazy, Suspense } from "react";
import { Trip, Member, ProposedDestination, ActivityProposal, ChatMessage, SharedDoc, SharedPhoto, ItineraryDay, Availability } from "./types";
import { INITIAL_TRIPS, MOCK_MEMBERS } from "./data/mockTrips";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { tripsSchema, membersSchema } from "./lib/schemas";
import { uid } from "./lib/id";
import { suggestActivities } from "./lib/api";
import { computeBudgetBreakdown } from "./domain/budget";
import { findBestTravelWindow } from "./domain/availability";
import { mergeActivitiesByName, buildFallbackActivities } from "./domain/activities";
import {
  buildEmptyItinerary,
  getMockDynamicItinerary,
  buildAutoPlanItinerary,
} from "./domain/itinerary";
import { TripContext, type TripStore } from "./store/TripContext";
import LoginScreen from "./pages/LoginScreen";
import AppHeader from "./components/AppHeader";
import DashboardSidebar from "./features/DashboardSidebar";
import TripWorkspace from "./features/TripWorkspace";
import LoadingFallback from "./components/LoadingFallback";

// Pages autonomes chargées à la demande (rarement ouvertes au démarrage).
const CreateTripPage = lazy(() => import("./pages/CreateTripPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));

export default function App() {
  // Persistance localStorage + validation Zod (cf. useLocalStorage).
  const [trips, setTrips] = useLocalStorage<Trip[]>(
    "voyage_group_trips",
    INITIAL_TRIPS,
    tripsSchema,
  );

  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    return trips[0]?.id || "trip-barcelona";
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>("m1"); // Adrien by default
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Membres simulés persistés (gestion de compte).
  const [members, setMembers] = useLocalStorage<Member[]>(
    "voyage_group_members",
    MOCK_MEMBERS,
    membersSchema,
  );

  const [isLoggedIn, setIsLoggedIn] = useLocalStorage<boolean>(
    "voyage_app_logged_in",
    true,
  );
  const [activePage, setActivePage] = useState<"dashboard" | "account" | "create-trip">("dashboard");

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const handleLoginAs = (memberId: string) => {
    setCurrentMemberId(memberId);
    setIsLoggedIn(true);
    setActivePage("dashboard");
  };

  // Form states
  const [newTripName, setNewTripName] = useState("");
  const [newTripDays, setNewTripDays] = useState(4);
  const [newTripBudget, setNewTripBudget] = useState<"Économique" | "Modéré" | "Luxe">("Modéré");

  const [newDestName, setNewDestName] = useState("");
  const [chatText, setChatText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [activityFilter, setActivityFilter] = useState<"all" | "gyg" | "airbnb" | "google">("all");

  // Document upload state simulator
  const [dragActive, setDragActive] = useState(false);
  const [simulatedDocName, setSimulatedDocName] = useState("");

  // Photo upload state simulator
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [photoCaptionInput, setPhotoCaptionInput] = useState("");

  // Custom manual event addition to itinerary
  const [manualEventDay, setManualEventDay] = useState<number>(1);
  const [manualEventTime, setManualEventTime] = useState("10:00");
  const [manualEventDesc, setManualEventDesc] = useState("");
  const [manualEventCost, setManualEventCost] = useState(0);

  // Active navigation tab state
  const [activeTab, setActiveTab] = useState<"calendar" | "voting" | "itinerary" | "chat" | "media">("calendar");

  // New interactive group simulation and profile creation states
  const [isBudgetDropdownOpen, setIsBudgetDropdownOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileAvatar, setNewProfileAvatar] = useState("🧗"); // Emoji preset
  const [inviteEmailInput, setInviteEmailInput] = useState("");

  // Find the current trip
  const activeTrip = trips.find((t) => t.id === selectedTripId) || trips[0];
  const currentMember = members.find((m) => m.id === currentMemberId) || members[0];

  const handleCreateProfileAndJoin = (name: string, avatar: string) => {
    if (!name.trim()) return;
    const newMemberId = uid("m");
    
    // Choose a nice adventure SVG seed avatar if possible, or support preset emojis
    const chosenAvatarUrl = avatar.length > 2 
      ? avatar 
      : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`;

    const newMember: Member = {
      id: newMemberId,
      name: name,
      avatar: chosenAvatarUrl
    };

    // 1. Add to members list
    const updatedMembers = [...members, newMember];
    setMembers(updatedMembers);

    // 2. Add to activeTrip if not already there
    const updatedMembersList = activeTrip.members.some(m => m.id === newMemberId)
      ? activeTrip.members
      : [...activeTrip.members, newMember];

    const updatedTrip = {
      ...activeTrip,
      members: updatedMembersList
    };
    handleUpdateTrip(updatedTrip);

    // 3. Switch currentMemberId to new user
    setCurrentMemberId(newMemberId);
    
    // Clear state
    setNewProfileName("");
  };

  const handleSimulateFriendJoin = (friendName?: string) => {
    const names = ["Emma Laurent", "Maxime Petit", "Léa Dubois", "Antoine Moreau", "Chloé Girard", "Lucas Roux"];
    const avatars = ["👩‍🎨", "👨‍💻", "👩‍🚀", "👨‍🎨", "👩‍⚕️", "👨‍🌾"];
    
    const chosenName = friendName || names[Math.floor(Math.random() * names.length)];
    const chosenAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(chosenName)}`;
    
    const newFriendId = uid("m-sim");
    const newFriend: Member = {
      id: newFriendId,
      name: chosenName,
      avatar: chosenAvatarUrl
    };

    // 1. Add to members list
    const updatedMembers = [...members, newFriend];
    setMembers(updatedMembers);

    // 2. Add to active trip and simulate date overlap
    const startOffset = Math.floor(Math.random() * 5); // 0-4
    const simulatedStart = `2026-07-${20 + startOffset}`;
    const simulatedEnd = `2026-07-${26 + startOffset}`;
    
    const newAvail: Availability = {
      id: uid("avail-sim"),
      memberId: newFriendId,
      start: simulatedStart,
      end: simulatedEnd
    };

    const updatedTrip = {
      ...activeTrip,
      members: [...activeTrip.members, newFriend],
      availabilities: [...activeTrip.availabilities, newAvail]
    };
    setTrips(trips.map((t) => (t.id === activeTrip.id ? updatedTrip : t)));

    // Send a message from this simulated friend in the discussion group
    const welcomeMsg: ChatMessage = {
      id: uid("wel-sim"),
      senderId: newFriendId,
      senderName: chosenName,
      senderAvatar: chosenAvatarUrl,
      text: `Salut l'équipe ! Je viens de rejoindre le projet de voyage "${activeTrip.name}". J'ai renseigné mes disponibilités de juillet, hâte de voter pour nos futures sorties ! 🛶✨`,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    };
    
    setTimeout(() => {
      const liveTrip = trips.find((t) => t.id === selectedTripId) || activeTrip;
      const updatedTripWithMsg = {
        ...updatedTrip,
        messages: [...liveTrip.messages, welcomeMsg]
      };
      setTrips(trips.map((t) => (t.id === activeTrip.id ? updatedTripWithMsg : t)));
    }, 400);

    return chosenName;
  };

  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmailInput.trim()) return;

    const email = inviteEmailInput.trim();
    setInviteEmailInput("");
    alert(`✉️ Invitation par e-mail transmise avec succès à : ${email} ! Un aperçu de la planification a été envoyé.`);

    // Simulate entry of this friend after 1.5 seconds!
    setTimeout(() => {
      const parts = email.split("@")[0].split(".");
      const guessedName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      const nameJoined = handleSimulateFriendJoin(guessedName || "Ami par Email");
      alert(`🎉 Félicitations ! ${nameJoined} a cliqué sur votre invitation d'email et a rejoint le groupe de voyage !`);
    }, 1500);
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
  };

  // Switch Active Trip safely
  const handleSelectTrip = (id: string) => {
    setSelectedTripId(id);
    setGenerationError("");
  };

  // Creator for new collective travels
  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    const newTrip: Trip = {
      id: uid("trip"),
      name: newTripName,
      description: "Nouveau projet de voyage collectif créé en mode résilient.",
      selectedDestination: "",
      targetDays: newTripDays,
      budgetType: newTripBudget,
      members: members,
      availabilities: [],
      destinations: [],
      activities: [],
      itinerary: [],
      averageLodgingCostPerNight: newTripBudget === "Économique" ? 35 : newTripBudget === "Luxe" ? 175 : 70,
      averageLocalTransportCostPerDay: newTripBudget === "Économique" ? 8 : newTripBudget === "Luxe" ? 40 : 15,
      externalTransportCost: 150,
      messages: [
        {
          id: "m-welcome",
          senderId: "system",
          senderName: "Co-Pilote",
          senderAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=80&h=80&q=80",
          text: `Bienvenue dans votre projet de voyage en groupe "${newTripName}" ! Commencez par définir vos dates libres ou à voter pour les destinations de rêve.`,
          timestamp: "À l'instant",
        },
      ],
      documents: [],
      photos: [],
    };

    setTrips([newTrip, ...trips]);
    setSelectedTripId(newTrip.id);
    setNewTripName("");
    setActivePage("dashboard");
  };

  // Add customized destination for voting
  const handleAddDestination = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestName.trim()) return;

    // Check if trip already represents this town
    if (activeTrip.destinations.some((d) => d.name.toLowerCase() === newDestName.toLowerCase())) {
      alert("Cette destination est déjà proposée !");
      return;
    }

    const proposed: ProposedDestination = {
      id: uid("dest"),
      name: newDestName,
      proposedBy: currentMember.name,
      votes: [currentMember.id], // initial self-vote
    };

    const updatedDestinations = [...activeTrip.destinations, proposed];
    
    // Auto-select destination if none wins yet
    const winningDest = activeTrip.selectedDestination || proposed.name;

    handleUpdateTrip({
      ...activeTrip,
      destinations: updatedDestinations,
      selectedDestination: winningDest,
    });

    setNewDestName("");
  };

  // Toggle single user vote
  const handleVoteDestination = (destId: string) => {
    const updatedDestinations = activeTrip.destinations.map((d) => {
      if (d.id === destId) {
        const voted = d.votes.includes(currentMemberId);
        const nextVotes = voted
          ? d.votes.filter((uid) => uid !== currentMemberId)
          : [...d.votes, currentMemberId];
        return { ...d, votes: nextVotes };
      }
      return d;
    });

    // Find destination with highest votes
    let topDest = activeTrip.selectedDestination;
    let maxVotes = -1;
    updatedDestinations.forEach((d) => {
      if (d.votes.length > maxVotes) {
        maxVotes = d.votes.length;
        topDest = d.name;
      }
    });

    handleUpdateTrip({
      ...activeTrip,
      destinations: updatedDestinations,
      selectedDestination: topDest,
    });
  };

  // Fetch suggestions from multiple high-fidelity platforms and merge them into the trip history
  const handleGenerateItinerary = async () => {
    if (!activeTrip.selectedDestination) {
      setGenerationError("Veuillez proposer et voter d'abord pour sélectionner la destination gagnante.");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");

    // Compute current group size
    const adults = activeTrip.members ? activeTrip.members.length : 6;
    
    // Find ideal travel window for Airbnb check-in and check-out parameters
    const { checkin, checkout } = findBestTravelWindow(
      activeTrip.availabilities,
      activeTrip.targetDays,
    );

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
        itinerary?: ItineraryDay[];
        averageLodgingCostPerNight?: number;
        averageLocalTransportCostPerDay?: number;
      };
      
      const mergedActivities = mergeActivitiesByName(
        activeTrip.activities || [],
        data.activities || [],
      );

      // Do not overwrite itinerary events if the group has already scheduled anything
      const hasPlannedEvents = activeTrip.itinerary && activeTrip.itinerary.some(day => day.events && day.events.length > 0);
      const finalItinerary = hasPlannedEvents ? activeTrip.itinerary : data.itinerary;

      handleUpdateTrip({
        ...activeTrip,
        activities: mergedActivities,
        itinerary: finalItinerary,
        averageLodgingCostPerNight: data.averageLodgingCostPerNight,
        averageLocalTransportCostPerDay: data.averageLocalTransportCostPerDay,
      });
    } catch (err: any) {
      console.warn("[Backend Offline Fallback] Loading local offline curated activities...", err);
      // Resilience fallback simulating GetYourGuide and Airbnb
      const mockResult = getMockDynamicItinerary(
        activeTrip.selectedDestination,
        activeTrip.targetDays,
        activeTrip.budgetType
      );
      
      const fallbackActivities = buildFallbackActivities(mockResult.activities, {
        destination: activeTrip.selectedDestination,
        adults,
        checkin,
        checkout,
        memberId: currentMemberId,
      });
      const mergedActivities = mergeActivitiesByName(
        activeTrip.activities || [],
        fallbackActivities,
      );

      const hasPlannedEvents = activeTrip.itinerary && activeTrip.itinerary.some(day => day.events && day.events.length > 0);
      const emptyDays = buildEmptyItinerary(
        activeTrip.targetDays,
        activeTrip.selectedDestination,
      );
      const finalItinerary = hasPlannedEvents ? activeTrip.itinerary : emptyDays;

      handleUpdateTrip({
        ...activeTrip,
        activities: mergedActivities,
        itinerary: finalItinerary,
        averageLodgingCostPerNight: mockResult.averageLodgingCostPerNight,
        averageLocalTransportCostPerDay: mockResult.averageLocalTransportCostPerDay,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle user's vote on a suggested or created activity
  const handleToggleActivityVote = (activityId: string) => {
    const updatedActivities = activeTrip.activities.map((act) => {
      if (act.id === activityId) {
        const nextVotes = act.votes.includes(currentMember.id)
          ? act.votes.filter(id => id !== currentMember.id)
          : [...act.votes, currentMember.id];
        return { ...act, votes: nextVotes };
      }
      return act;
    });

    handleUpdateTrip({
      ...activeTrip,
      activities: updatedActivities,
    });
  };

  // Schedule/plan a custom activity or selected suggestion to a specific day of the itinerary
  const handleScheduleActivity = (act: ActivityProposal, dayNum: number, timeStr = "10:00") => {
    const emptyItinerary = activeTrip.itinerary && activeTrip.itinerary.length > 0
      ? [...activeTrip.itinerary]
      : buildEmptyItinerary(activeTrip.targetDays, activeTrip.selectedDestination || "la ville");

    const newEv = {
      id: uid("ev-sched"),
      time: timeStr,
      description: `${act.name}${act.source ? ` [${act.source}]` : ""}`,
      cost: act.cost
    };

    const updatedItinerary = emptyItinerary.map((day) => {
      if (day.day === dayNum) {
        const updatedEvents = [...day.events, newEv].sort((a, b) => a.time.localeCompare(b.time));
        return {
          ...day,
          events: updatedEvents
        };
      }
      return day;
    });

    handleUpdateTrip({
      ...activeTrip,
      itinerary: updatedItinerary
    });
  };

  // Auto Plan itinerary based on voted activities
  const handleAutoPlanFromVotes = () => {
    setIsGenerating(true);
    const updatedItinerary = buildAutoPlanItinerary(activeTrip);

    setTimeout(() => {
      handleUpdateTrip({
        ...activeTrip,
        itinerary: updatedItinerary
      });
      setIsGenerating(false);
    }, 450);
  };

  // Push new chat message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    const newMsg: ChatMessage = {
      id: uid("msg"),
      senderId: currentMember.id,
      senderName: currentMember.name,
      senderAvatar: currentMember.avatar,
      text: chatText,
      timestamp: "Aujourd'hui, " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };

    handleUpdateTrip({
      ...activeTrip,
      messages: [...activeTrip.messages, newMsg],
    });

    setChatText("");
  };

  // Drag and Drop simulation functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      uploadNewDoc(file.name, file.size);
    }
  };

  const uploadNewDoc = (name: string, sizeBytes?: number) => {
    const formattedSize = sizeBytes 
      ? (sizeBytes / (1024 * 1024)).toFixed(1) + " MB" 
      : "120 KB";

    const newDoc: SharedDoc = {
      id: uid("doc"),
      name: name,
      type: name.endsWith(".pdf") ? "pdf" : name.endsWith(".png") || name.endsWith(".jpg") ? "image" : "doc",
      uploadedBy: currentMember.name,
      size: formattedSize,
      date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    };

    handleUpdateTrip({
      ...activeTrip,
      documents: [newDoc, ...activeTrip.documents],
    });
  };

  const handleAddManualDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedDocName.trim()) return;
    const name = simulatedDocName.includes(".") ? simulatedDocName : simulatedDocName + ".pdf";
    uploadNewDoc(name);
    setSimulatedDocName("");
  };

  // Adding simulation photos
  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackUrls = [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=600&q=80"
    ];
    const url = photoUrlInput.trim() || fallbackUrls[Math.floor(Math.random() * fallbackUrls.length)];
    const caption = photoCaptionInput.trim() || "Un magnifique spot repéré pour le séjour !";

    const newPhoto: SharedPhoto = {
      id: uid("photo"),
      url: url,
      caption: caption,
      uploadedBy: currentMember.name,
      date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    };

    handleUpdateTrip({
      ...activeTrip,
      photos: [newPhoto, ...activeTrip.photos],
    });

    setPhotoUrlInput("");
    setPhotoCaptionInput("");
  };

  // Add custom manual event in itinerary
  const handleAddManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEventDesc.trim()) return;

    const newEvent = {
      id: uid("ev-manual"),
      time: manualEventTime,
      description: manualEventDesc,
      cost: Number(manualEventCost) || 0,
    };

    const updatedItinerary = activeTrip.itinerary.map((day) => {
      if (day.day === Number(manualEventDay)) {
        return {
          ...day,
          events: [...day.events, newEvent].sort((a, b) => a.time.localeCompare(b.time)),
        };
      }
      return day;
    });

    // If day does not exist in itinerary array, create it safely
    const dayExists = activeTrip.itinerary.some(d => d.day === Number(manualEventDay));
    if (!dayExists) {
      updatedItinerary.push({
        day: Number(manualEventDay),
        title: `Jour ${manualEventDay} : Planning complémentaire`,
        events: [newEvent]
      });
      updatedItinerary.sort((a, b) => a.day - b.day);
    }

    handleUpdateTrip({
      ...activeTrip,
      itinerary: updatedItinerary,
    });

    setManualEventDesc("");
    setManualEventCost(0);
  };

  // Remove specific itinerary event
  const handleDeleteEvent = (dayNum: number, eventId: string) => {
    const updated = activeTrip.itinerary.map((day) => {
      if (day.day === dayNum) {
        return {
          ...day,
          events: day.events.filter(e => e.id !== eventId)
        };
      }
      return day;
    });
    handleUpdateTrip({
      ...activeTrip,
      itinerary: updated
    });
  };

  // Delete uploaded doc
  const handleDeleteDoc = (docId: string) => {
    handleUpdateTrip({
      ...activeTrip,
      documents: activeTrip.documents.filter(d => d.id !== docId)
    });
  };

  // Delete uploaded photo
  const handleDeletePhoto = (photoId: string) => {
    handleUpdateTrip({
      ...activeTrip,
      photos: activeTrip.photos.filter(p => p.id !== photoId)
    });
  };

  // Delete destination proposal
  const handleDeleteDestinationProposal = (destId: string) => {
    const updatedDests = activeTrip.destinations.filter(d => d.id !== destId);
    let topDest = "";
    if (updatedDests.length > 0) {
      // recalculate winning
      let maxVotes = -1;
      updatedDests.forEach((d) => {
        if (d.votes.length > maxVotes) {
          maxVotes = d.votes.length;
          topDest = d.name;
        }
      });
    }
    handleUpdateTrip({
      ...activeTrip,
      destinations: updatedDests,
      selectedDestination: topDest
    });
  };

  // Change individual transport cost or other numbers directly
  const handleUpdateTransportValue = (value: number) => {
    handleUpdateTrip({
      ...activeTrip,
      externalTransportCost: value
    });
  };

  // Décomposition du budget individuel (logique pure extraite dans domain/budget).
  // Mémoïsée : recalculée uniquement quand le voyage actif change.
  const budgetBreakdown = useMemo(
    () => computeBudgetBreakdown(activeTrip),
    [activeTrip],
  );

  const store: TripStore = {
    trips,
    members,
    setMembers,
    activeTrip,
    selectedTripId,
    currentMember,
    currentMemberId,
    setCurrentMemberId,
    isOffline,
    setIsOffline,
    activePage,
    setActivePage,
    activeTab,
    setActiveTab,
    budgetBreakdown,
    newTripName,
    setNewTripName,
    newTripDays,
    setNewTripDays,
    newTripBudget,
    setNewTripBudget,
    newDestName,
    setNewDestName,
    chatText,
    setChatText,
    isGenerating,
    generationError,
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
    manualEventDesc,
    setManualEventDesc,
    manualEventCost,
    setManualEventCost,
    isBudgetDropdownOpen,
    setIsBudgetDropdownOpen,
    newProfileName,
    setNewProfileName,
    newProfileAvatar,
    setNewProfileAvatar,
    inviteEmailInput,
    setInviteEmailInput,
    handleLogout,
    handleLoginAs,
    handleCreateProfileAndJoin,
    handleSimulateFriendJoin,
    handleSendEmailInvite,
    handleUpdateTrip,
    handleSelectTrip,
    handleCreateTrip,
    handleAddDestination,
    handleVoteDestination,
    handleGenerateItinerary,
    handleToggleActivityVote,
    handleScheduleActivity,
    handleAutoPlanFromVotes,
    handleSendChat,
    handleDrag,
    handleDrop,
    handleAddManualDoc,
    handleAddPhoto,
    handleAddManualEvent,
    handleDeleteEvent,
    handleDeleteDoc,
    handleDeletePhoto,
    handleDeleteDestinationProposal,
    handleUpdateTransportValue,
  };

  if (!isLoggedIn) {
    return (
      <TripContext.Provider value={store}>
        <LoginScreen />
      </TripContext.Provider>
    );
  }

  return (
    <TripContext.Provider value={store}>
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-6 font-sans antialiased">
      <div className="max-w-[1440px] mx-auto space-y-4">
        
        <AppHeader />

        {/* MAIN CONTROLS: CURRENT DETAILED DISPATCH AND SEAMLESS BENTO GRID */}
        {activePage === "dashboard" && (
          <div id="bento-grid-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* COLUMN LEFT: GROUP INFO, SIMULATIONS & PROFILING (4 COLS) */}
            <DashboardSidebar />

            {/* COLUMN MIDDLE/RIGHT: INTERACTIVE BENTO BLOCKS (8 COLS) */}
            <TripWorkspace />
        </div>
      )}

        {/* PAGES AUTONOMES CHARGÉES À LA DEMANDE */}
        {(activePage === "create-trip" || activePage === "account") && (
          <Suspense fallback={<LoadingFallback />}>
            {activePage === "create-trip" && <CreateTripPage />}
            {activePage === "account" && <AccountPage />}
          </Suspense>
        )}

        {/* BOTTOM METADATA & DEPLOYMENT INFO */}
        <footer className="pt-4 pb-12 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-3 border-t border-slate-200">
          <div>
            <p className="font-medium text-slate-500">
              Co-Tripper Planificateur de Voyage en Groupe • Bento Edition
            </p>
            <p className="text-slate-400 mt-0.5 font-mono">
              Local Storage cache: Actif & Synchronisé • Node Port 3000
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live Preview Safe
            </span>
            <span className="text-slate-300">|</span>
            <span className="italic">L'aventure commence ici ! 🌄</span>
          </div>
        </footer>

      </div>
    </div>
    </TripContext.Provider>
  );
}

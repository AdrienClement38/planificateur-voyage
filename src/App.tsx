import React, { useState } from "react";
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
import CreateTripPage from "./pages/CreateTripPage";
import AccountPage from "./pages/AccountPage";
import VotingTab from "./features/VotingTab";
import ChatTab from "./features/ChatTab";
import MediaTab from "./features/MediaTab";
import ItineraryTab from "./features/ItineraryTab";
import OfflineIndicator from "./components/OfflineIndicator";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import { 
  Plus, 
  MapPin, 
  ThumbsUp, 
  Users, 
  MessageSquare, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  DollarSign, 
  ArrowRight, 
  Download, 
  Trash2, 
  Check, 
  Send, 
  AlertCircle,
  Clock,
  Briefcase,
  Plane,
  Home,
  ExternalLink,
  ChevronRight,
  Info,
  LogOut,
  User,
  Settings,
  ChevronDown
} from "lucide-react";

const LOCAL_RECOMMENDATIONS: Record<string, {name: string, description: string, cost: number, category: string}[]> = {
  "barcelone": [
    { name: "Visite guidée du Parc Güell 🦎", description: "Le chef-d'œuvre coloré de Gaudi avec une vue panoramique imprenable sur la Méditerranée.", cost: 10, category: "Visite" },
    { name: "Coucher de soleil aux Bunkers del Carmel 🌅", description: "Le plus beau point de vue à 360° sur Barcelone, idéal pour un pique-nique crépusculaire.", cost: 0, category: "Nature" },
    { name: "Dégustation culinaire au Marché de Santa Caterina 🧀", description: "Moins touristique que la Boqueria, plein d'étals bios et de tapas authentiques.", cost: 18, category: "Gastronomie" },
    { name: "Spectacle de Flamenco traditionnel au Born 💃", description: "Immersion vibrante dans l'art andalou avec boisson fraîche incluse.", cost: 30, category: "Loisir" }
  ],
  "rome": [
    { name: "Visite coupe-file du Colisée et Forum Romain 🏛️", description: "Plongez dans l'arène impériale et marchez sur les traces des gladiateurs de l'empire.", cost: 24, category: "Culture" },
    { name: "Atelier de fabrication de pâtes fraîches & Gelato 🍝", description: "Apprenez les secrets de fabrication d'un chef italien dans le quartier bohème de Trastevere.", cost: 42, category: "Gastronomie" },
    { name: "Balade nocturne des fontaines romantiques ⛲", description: "Découvrez la Fontaine de Trevi, la Piazza Navona et le Panthéon éclairés majestueusement de nuit.", cost: 0, category: "Visite" },
    { name: "Pique-nique champêtre à la Villa Borghese 🌳", description: "Louez des barques sur le lac artificiel et dégustez du fromage Pecorino sous les pins parasols.", cost: 10, category: "Nature" }
  ],
  "paris": [
    { name: "Ascension nocturne de l'Arc de Triomphe 🗼", description: "Le meilleur belvédère parisien pour admirer l'avenue des Champs-Élysées et la Tour Eiffel s'illuminer.", cost: 13, category: "Visite" },
    { name: "Flânerie gourmande et street-art à Belleville 🎨", description: "Quartier cosmopolite riche en boulangeries artisanales et galeries d'art expressves en plein air.", cost: 0, category: "Gastronomie" },
    { name: "Bateau-Mouche romantique sur la Seine ⛵", description: "Un moment féerique au fil de l'eau pour admirer les ponts et monuments illuminés.", cost: 15, category: "Loisir" },
    { name: "Exploration des catacombes historiques de la Cité 💀", description: "Galères souterraines fascinantes abritant l'histoire mystique de Paris.", cost: 29, category: "Culture" }
  ],
  "lisbonne": [
    { name: "Dégustation des Pasteis de Belém chaudes 🧁", description: "La recette culinaire ultra-secrète de 1837 dans la boutique historique aux azulejos de faïence.", cost: 5, category: "Gastronomie" },
    { name: "Balade guidée en Tramway historique 28 🚃", description: "Sillonnez les collines escarpées de l'Alfama à bord d'un wagon en bois d'époque.", cost: 3, category: "Visite" },
    { name: "Coucher de soleil acoustique au Miradouro da Senhora do Monte 🌅", description: "Le point de vue imprenable le plus romantique avec concerts à la guitare sous le ciel étoilé.", cost: 0, category: "Loisir" },
    { name: "Excursion magique vers les châteaux de Sintra 🏰", description: "Explorez le Palais national de Pena, son architecture féerique fleurie et ses jardins exotiques.", cost: 20, category: "Culture" }
  ],
  "tokyo": [
    { name: "Coucher de soleil vertigineux au Shibuya Sky 🏙️", description: "Terrasse ouverte au 47ème étage offrant une vue sensationnelle sur le carrefour mythique et le Mont Fuji.", cost: 18, category: "Visite" },
    { name: "Dîner authentique d'Okonomiyaki à Shimokitazawa 🥢", description: "Galettes japonaises traditionnelles savoureuses cuites sur plaques chauffantes devant vous.", cost: 22, category: "Gastronomie" },
    { name: "Visite interactive sensorielle teamLab Planets 🔮", description: "Marcher pieds nus dans l'eau et explorer une œuvre d'art numérique de lumières infinies.", cost: 26, category: "Culture" },
    { name: "Soirée rétro ludique au Golden Gai de Shinjuku 🍺", description: "Plus de 200 micro-bars en bois blottis dans d'étroites ruelles d'après-guerre.", cost: 20, category: "Loisir" }
  ]
};

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

  // Add one of the offline curated recommendations to a specific day of the itinerary
  const handleAddRecommendationToItinerary = (rec: {name: string, description: string, cost: number, category: string}, chosenDay: number) => {
    const emptyItinerary: ItineraryDay[] = activeTrip.itinerary && activeTrip.itinerary.length > 0
      ? [...activeTrip.itinerary]
      : buildEmptyItinerary(activeTrip.targetDays, activeTrip.selectedDestination || "votre destination");

    const newEv = {
      id: uid("ev-rec"),
      time: "11:30",
      description: `${rec.name} — ${rec.description}`,
      cost: rec.cost
    };

    const updatedItinerary = emptyItinerary.map((day) => {
      if (day.day === chosenDay) {
        return {
          ...day,
          events: [...day.events, newEv]
        };
      }
      return day;
    });

    const isAlreadyProposed = activeTrip.activities.some(act => act.name === rec.name);
    const updatedActivities = isAlreadyProposed 
      ? activeTrip.activities 
      : [
          ...activeTrip.activities,
          {
            id: uid("act-rec"),
            name: rec.name,
            description: rec.description,
            cost: rec.cost,
            category: rec.category,
            proposedBy: currentMember.name,
            votes: [currentMember.id]
          }
        ];

    handleUpdateTrip({
      ...activeTrip,
      activities: updatedActivities,
      itinerary: updatedItinerary
    });
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
  const budgetBreakdown = computeBudgetBreakdown(activeTrip);

  const store: TripStore = {
    trips,
    members,
    setMembers,
    activeTrip,
    currentMember,
    currentMemberId,
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
    handleAddRecommendationToItinerary,
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
        
        {/* NETWORK & OFFLINE BANNER AND RESILIENT ALERT */}
        {isOffline && (
          <div className="bg-amber-500 text-white px-4 py-3 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-bounce">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">
                <strong>Mode voyageur (Hors Ligne d'altitude) actif.</strong> Toutes vos modifications, votes, photos et documents sont instantanément stockés de manière sécurisée dans votre navigateur (LocalStorage) !
              </span>
            </div>
            <button
              onClick={() => setIsOffline(false)}
              className="bg-white/20 hover:bg-white/35 text-white text-[10.5px] font-bold py-1 px-3 rounded-lg shrink-0 transition"
            >
              Rebrancher
            </button>
          </div>
        )}

        {/* TOP LEVEL NAVIGATION & SPACIOUS BRANDING HEADER */}
        <header className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row justify-between lg:items-center gap-4 relative z-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xs shrink-0 select-none">
              🛶
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                <span className="text-xl sm:text-2xl font-black font-display tracking-widest text-slate-950">
                  CO-TRIPPER
                </span>
                <span className="bg-indigo-50 text-indigo-700 text-[10.5px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100/50 self-start sm:self-auto">
                  🧭 Planificateur de Voyage Coordonné
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Sillonnez le monde ensemble • Gestion des dates, des budgets et du programme collectif
              </p>
            </div>
          </div>

          {/* PERSISTENT HEADER NAV LINKS */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            <button
              onClick={() => setActivePage("dashboard")}
              className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                activePage === "dashboard"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              🗺️ Tableau de Bord
            </button>
            
            <button
              onClick={() => setActivePage("create-trip")}
              className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                activePage === "create-trip"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              ➕ Initier un Voyage
            </button>

            <button
              onClick={() => setActivePage("account")}
              className={`flex items-center gap-2 px-3 py-1.8 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                activePage === "account"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              👤 Mon Compte ({currentMember.name})
            </button>

            <div className="h-6 w-[1.5px] bg-slate-200 hidden sm:block mx-1"></div>

            {/* INTEGRATED "BUDGET PAR PARTICIPANT" DROPDOWN PILL */}
            <div className="relative">
              <button
                onClick={() => setIsBudgetDropdownOpen(!isBudgetDropdownOpen)}
                className={`flex items-center gap-2 px-3.5 py-1.8 rounded-xl text-xs font-extrabold transition duration-200 cursor-pointer border ${
                  isBudgetDropdownOpen 
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs" 
                    : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800"
                }`}
                title="Consulter le budget détaillé estimé par voyageur"
              >
                <span>💰 Budget: <strong className="font-black">{budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€</strong> / pers</span>
                <ChevronDown className={`w-3 h-3 transition duration-250 ${isBudgetDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isBudgetDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl z-55 text-white text-left text-xs space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-extrabold text-[10.5px] uppercase text-emerald-400 tracking-wider">💰 Budget par participant estimé</span>
                    <button 
                      onClick={() => setIsBudgetDropdownOpen(false)} 
                      className="text-slate-400 hover:text-white transition text-sm font-bold w-5 h-5 flex items-center justify-center bg-slate-800 rounded-full cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-950/80 to-slate-850 p-3.5 rounded-xl border border-emerald-900/30 text-center space-y-1">
                    <span className="block text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Moyenne collective individuelle</span>
                    <span className="text-3xl font-black text-white font-display tracking-tight">
                      {budgetBreakdown.totalIndividual.toLocaleString("fr-FR")}€
                    </span>
                    <span className="block text-[10px] text-emerald-300">
                      Calculé sur {activeTrip.targetDays} jours de séjour ({activeTrip.budgetType})
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1.5 font-medium text-slate-300">
                    <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-1.5">🏠 Hébergement ({activeTrip.averageLodgingCostPerNight}€/nuit)</span>
                      <span className="font-bold text-white font-mono">{budgetBreakdown.totalLodging}€</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-1.5">🚌 Transport Local ({activeTrip.averageLocalTransportCostPerDay}€/jour)</span>
                      <span className="font-bold text-white font-mono">{budgetBreakdown.totalLocalTransport}€</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-b border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-1.5">✨ Activités votées au programme</span>
                      <span className="font-bold text-white font-mono">{budgetBreakdown.activitiesCost}€</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="flex items-center gap-1 text-slate-400 font-bold uppercase tracking-wider text-[9px]">✈️ Transport Principal A/R :</span>
                        <span className="font-extrabold text-emerald-450 font-mono text-sm">{budgetBreakdown.flightCost}€</span>
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
                      <span className="block text-[9px] text-slate-400 text-right italic font-medium">Glissez pour modifier en direct</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <OfflineIndicator isOffline={isOffline} setIsOffline={setIsOffline} />

            <button
              onClick={handleLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer ml-auto"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </header>

        {/* MAIN CONTROLS: CURRENT DETAILED DISPATCH AND SEAMLESS BENTO GRID */}
        {activePage === "dashboard" && (
          <div id="bento-grid-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* COLUMN LEFT: GROUP INFO, SIMULATIONS & PROFILING (4 COLS) */}
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

            {/* COLUMN MIDDLE/RIGHT: INTERACTIVE BENTO BLOCKS (8 COLS) */}
            <div className="lg:col-span-8 space-y-5">

              {/* CHOSEN ADVENTURE COMPACT HEADER BANNER */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full blur-2xl pointer-events-none translate-x-12 -translate-y-12"></div>
                
                <div className="relative z-10 space-y-1.5">
                  <span className="text-[9.5px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
                    📂 Voyage Sélectionné
                  </span>
                  <h2 className="text-xl font-bold font-display text-slate-800 tracking-tight pt-1.5">
                    {activeTrip.name}
                  </h2>
                  <p className="text-xs text-slate-500 italic max-w-xl">
                    "{activeTrip.description}"
                  </p>
                </div>

                <div className="relative z-10 shrink-0 flex items-center gap-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shrink-0 min-w-[70px]">
                    <span className="block text-[8px] uppercase font-bold text-slate-400">DURÉE</span>
                    <span className="text-xs font-black text-slate-700">{activeTrip.targetDays} jours</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shrink-0 min-w-[75px]">
                    <span className="block text-[8px] uppercase font-bold text-slate-400">SERVICES</span>
                    <span className="text-xs font-black text-indigo-600">{activeTrip.budgetType}</span>
                  </div>
                </div>
              </div>
            
            {/* NAVIGATION TABS BAR AT THE TOP OF THE COLUMN */}
            <div className="bg-white rounded-2xl p-1.5 border border-slate-200/80 shadow-xs flex flex-wrap gap-1">
              <button
                onClick={() => setActiveTab("calendar")}
                className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
                  activeTab === "calendar"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>Disponibilités</span>
              </button>

              <button
                onClick={() => setActiveTab("voting")}
                className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
                  activeTab === "voting"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Destinations</span>
                {activeTrip.destinations.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === "voting" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {activeTrip.destinations.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("itinerary")}
                className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
                  activeTab === "itinerary"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Programme & Suggestions</span>
              </button>

              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
                  activeTab === "chat"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Messagerie</span>
                {activeTrip.messages.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === "chat" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {activeTrip.messages.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("media")}
                className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer ${
                  activeTab === "media"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Partages ({activeTrip.documents.length + activeTrip.photos.length})</span>
              </button>
            </div>

            {/* TAB CONTAINER: REACTIVE MOUNTING OF INDIVIDUAL COMPONENTS */}

            {/* 1. CALENDAR TAB */}
            {activeTab === "calendar" && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs relative animate-fadeIn">
                <AvailabilityCalendar 
                  trip={activeTrip} 
                  currentMember={currentMember} 
                  isOffline={isOffline} 
                  onUpdateTrip={handleUpdateTrip}
                />
              </div>
            )}

            {/* 2. DESTINATION VOTING TAB */}
            {activeTab === "voting" && <VotingTab />}

            {/* 3. INTEGRATED DISCUSSION AND MESSAGING BOARD TAB */}
            {activeTab === "chat" && <ChatTab />}

            {/* 4. SHARED PHOTO GALLERY & DOCUMENTS SANDBOX TAB */}
            {activeTab === "media" && <MediaTab />}

            {/* 5. DYNAMIC MULTI-SOURCE ACTIVITY SUGGESTIONS & PROGRAM TAB */}
            {activeTab === "itinerary" && <ItineraryTab />}

          </div>
        </div>
      )}

        {/* STANDALONE CREATE TRIP INTERACTIVE PAGE */}
        {activePage === "create-trip" && <CreateTripPage />}

        {/* STANDALONE MON COMPTE & GROUPE INTERACTIVE PAGE */}
        {activePage === "account" && <AccountPage />}

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

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
import AppHeader from "./components/AppHeader";
import DashboardSidebar from "./features/DashboardSidebar";
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
        
        <AppHeader />

        {/* MAIN CONTROLS: CURRENT DETAILED DISPATCH AND SEAMLESS BENTO GRID */}
        {activePage === "dashboard" && (
          <div id="bento-grid-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* COLUMN LEFT: GROUP INFO, SIMULATIONS & PROFILING (4 COLS) */}
            <DashboardSidebar />

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

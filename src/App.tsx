import React, { useState } from "react";
import { Trip, Member, ProposedDestination, ActivityProposal, ChatMessage, SharedDoc, SharedPhoto, ItineraryDay, Availability } from "./types";
import { INITIAL_TRIPS, MOCK_MEMBERS } from "./data/mockTrips";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { tripsSchema, membersSchema } from "./lib/schemas";
import { uid } from "./lib/id";
import { suggestActivities } from "./lib/api";
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
    let checkin = "2026-07-20";
    let checkout = "2026-07-26";
    
    if (activeTrip.availabilities && activeTrip.availabilities.length > 0) {
      const dayCounts: { [dateStr: string]: string[] } = {};
      activeTrip.availabilities.forEach((avail) => {
        const start = new Date(avail.start);
        const end = new Date(avail.end);
        const current = new Date(start);
        let count = 0;
        while (current <= end && count < 60) {
          const dateStr = current.toISOString().split("T")[0];
          if (!dayCounts[dateStr]) dayCounts[dateStr] = [];
          if (!dayCounts[dateStr].includes(avail.memberId)) {
            dayCounts[dateStr].push(avail.memberId);
          }
          current.setDate(current.getDate() + 1);
          count++;
        }
      });
      const activeDates = Object.keys(dayCounts).sort();
      if (activeDates.length > 0) {
        const neededDays = activeTrip.targetDays || 4;
        let bestScore = 0;
        let bestRange: string[] = [];
        for (let i = 0; i <= activeDates.length - neededDays; i++) {
          const candidateStartDate = new Date(activeDates[i]);
          const candidateRange: string[] = [];
          let currentMembersIntersection: string[] | null = null;
          let membersUnion = new Set<string>();
          for (let offset = 0; offset < neededDays; offset++) {
            const d = new Date(candidateStartDate);
            d.setDate(d.getDate() + offset);
            const dStr = d.toISOString().split("T")[0];
            candidateRange.push(dStr);
            const dayMembers = dayCounts[dStr] || [];
            dayMembers.forEach(m => membersUnion.add(m));
            if (currentMembersIntersection === null) {
              currentMembersIntersection = [...dayMembers];
            } else {
              currentMembersIntersection = currentMembersIntersection.filter(m => dayMembers.includes(m));
            }
          }
          const countIntersect = currentMembersIntersection ? currentMembersIntersection.length : 0;
          const score = countIntersect * 1000 + membersUnion.size;
          if (score > bestScore) {
            bestScore = score;
            bestRange = candidateRange;
          }
        }
        if (bestRange.length > 0) {
          checkin = bestRange[0];
          checkout = bestRange[bestRange.length - 1];
        } else {
          checkin = activeTrip.availabilities[0].start;
          checkout = activeTrip.availabilities[0].end;
        }
      }
    }

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
      
      const existingActivities = activeTrip.activities || [];
      const incomingActivities = data.activities || [];
      
      // Merge with name-based deduplication
      const mergedActivities = [...existingActivities];
      incomingActivities.forEach((incoming: any) => {
        const isDuplicate = existingActivities.some(
          (existing) => existing.name.toLowerCase().trim() === incoming.name.toLowerCase().trim()
        );
        if (!isDuplicate) {
          mergedActivities.push(incoming);
        }
      });

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
      
      const existingActivities = activeTrip.activities || [];
      const incomingActivities = mockResult.activities.map((a, i) => {
        const isBarce = activeTrip.selectedDestination.toLowerCase().includes("barcelon");
        let sourceVal: "GetYourGuide" | "Airbnb Expériences" | "Google Activités";
        let proposedByVal = "";
        let itemUrl = "";
        
        const cleanName = a.name.replace(/[^\w\sÀ-ÿ]/gi, '').trim();

        if (i % 3 === 0) {
          sourceVal = "GetYourGuide";
          proposedByVal = "GetYourGuide 🎫";
          itemUrl = isBarce && cleanName.toLowerCase().includes("sagrada")
            ? "https://www.getyourguide.fr/sagrada-familia-l2699/"
            : `https://www.getyourguide.fr/s/?q=${encodeURIComponent(activeTrip.selectedDestination + " " + cleanName)}`;
        } else if (i % 3 === 1) {
          sourceVal = "Airbnb Expériences";
          proposedByVal = "Airbnb Expériences 🏠";
          itemUrl = isBarce && cleanName.toLowerCase().includes("sagrada")
            ? `https://www.airbnb.fr/experiences/4527793?adults=${adults}&checkin=${checkin}&checkout=${checkout}&location=Barcelone%2C%20Espagne&currentTab=experience_tab&federatedSearchId=cdeb7f58-95c2-44dc-b657-1c2ca55ff964&sectionId=51d71af4-1887-4b5b-bda5-e5a52e26d961`
            : `https://www.airbnb.fr/s/${encodeURIComponent(activeTrip.selectedDestination)}/experiences?query=${encodeURIComponent(cleanName)}&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`;
        } else {
          sourceVal = "Google Activités";
          proposedByVal = "Google Activités ✈️";
          const query = `Activités à découvrir à ${activeTrip.selectedDestination} ${cleanName}`;
          itemUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&sa=X&sqi=2&bih=695&biw=1536&dpr=1.25#ttdcs=EAE`;
        }

        return {
          id: uid(`act-gen-fallback-${i}`),
          name: a.name,
          description: a.description,
          cost: a.cost,
          category: a.category,
          votes: [currentMemberId],
          source: sourceVal,
          proposedBy: proposedByVal,
          bookingUrl: itemUrl
        };
      });

      const mergedActivities = [...existingActivities];
      incomingActivities.forEach((incoming: any) => {
        const isDuplicate = existingActivities.some(
          (existing) => existing.name.toLowerCase().trim() === incoming.name.toLowerCase().trim()
        );
        if (!isDuplicate) {
          mergedActivities.push(incoming);
        }
      });

      const hasPlannedEvents = activeTrip.itinerary && activeTrip.itinerary.some(day => day.events && day.events.length > 0);
      const emptyDays = Array.from({ length: activeTrip.targetDays }).map((_, idx) => ({
        day: idx + 1,
        title: `Jour ${idx + 1} : Exploration de ${activeTrip.selectedDestination}`,
        events: []
      }));
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
      : Array.from({ length: activeTrip.targetDays }).map((_, idx) => ({
          day: idx + 1,
          title: `Jour ${idx + 1} : Exploration de ${activeTrip.selectedDestination || "la ville"}`,
          events: []
        }));

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
    // Sort activities by votes descending
    const sorted = [...activeTrip.activities].sort((a, b) => b.votes.length - a.votes.length);

    const mealCostBreakfast = activeTrip.budgetType === "Économique" ? 5 : activeTrip.budgetType === "Luxe" ? 22 : 11;
    const mealCostLunch = activeTrip.budgetType === "Économique" ? 9 : activeTrip.budgetType === "Luxe" ? 40 : 18;
    const mealCostDinner = activeTrip.budgetType === "Économique" ? 14 : activeTrip.budgetType === "Luxe" ? 65 : 28;

    const updatedItinerary = Array.from({ length: activeTrip.targetDays }).map((_, idx) => {
      const d = idx + 1;
      const dayEvents = [
        {
          id: `ev-auto-${d}-breakfast`,
          time: "08:30",
          description: "☕ Petit-déjeuner convivial en groupe près de l'hébergement",
          cost: mealCostBreakfast
        }
      ];

      // Grab first activity for morning
      if (sorted.length > 0) {
        const morningAct = sorted[(idx * 2) % sorted.length];
        dayEvents.push({
          id: `ev-auto-${d}-morning-${morningAct.id}`,
          time: "10:00",
          description: `${morningAct.name} — ${morningAct.description}`,
          cost: morningAct.cost
        });
      }

      dayEvents.push({
        id: `ev-auto-${d}-lunch`,
        time: "13:00",
        description: "🍽️ Pause déjeuner saine - Dégustation locale",
        cost: mealCostLunch
      });

      // Grab second activity for afternoon
      if (sorted.length > 1) {
        const afternoonAct = sorted[(idx * 2 + 1) % sorted.length];
        dayEvents.push({
          id: `ev-auto-${d}-afternoon-${afternoonAct.id}`,
          time: "15:00",
          description: `${afternoonAct.name} — ${afternoonAct.description}`,
          cost: afternoonAct.cost
        });
      }

      dayEvents.push({
        id: `ev-auto-${d}-dinner`,
        time: "19:30",
        description: "🍷 Dîner de clôture de l'étape et repos bien mérité",
        cost: mealCostDinner
      });

      return {
        day: d,
        title: `Jour ${d} : Sélection de l'équipe à ${activeTrip.selectedDestination}`,
        events: dayEvents.sort((a, b) => a.time.localeCompare(b.time))
      };
    });

    setTimeout(() => {
      handleUpdateTrip({
        ...activeTrip,
        itinerary: updatedItinerary
      });
      setIsGenerating(false);
    }, 450);
  };

  // Intelligent Curated Travel Recipes without external paid keys
  function getMockDynamicItinerary(destination: string, days: number, budgetType: string) {
    const lowercaseDest = destination.toLowerCase();
    
    let activityThemes = [
      { name: `Visite guidée historique de ${destination}`, description: "Découverte historique des monuments incontournables et trésors cachés.", cost: 20, category: "Visite" },
      { name: "Expérience culinaire en groupe", description: "Bistrot typique, dégustation de spécialités et de planches à partager.", cost: 30, category: "Gastronomie" },
      { name: "Balade nature et panorama d'exception", description: "Randonnée douce ou marche à pied vers les meilleurs panoramas.", cost: 0, category: "Nature" },
      { name: "Jeu de piste ou escape game urbain", description: "Une activité connectée amusante pour renforcer la cohésion d'équipe.", cost: 15, category: "Loisir" },
      { name: "Flânerie libre dans le quartier branché", description: "Boutiques conceptuelles, artisans d'art et café de spécialité.", cost: 10, category: "Shopping" }
    ];

    let lodgingCost = budgetType === "Économique" ? 35 : budgetType === "Luxe" ? 180 : 75;
    let transportCost = budgetType === "Économique" ? 8 : budgetType === "Luxe" ? 35 : 14;

    if (lowercaseDest.includes("rome") || lowercaseDest.includes("italie")) {
      activityThemes = [
        { name: "Visite coupe-file du Colisée de Rome", description: "Immersion unique dans l'histoire de l'arène impériale antique.", cost: 24, category: "Culture" },
        { name: "Dégustation culinaire guidée à Trastevere", description: "Parcours gourmand dans le quartier bohème : pizza rouge, pâtes Cacio e Pepe et glaces artisanales.", cost: 35, category: "Gastronomie" },
        { name: "Pique-nique champêtre à la Villa Borghese", description: "Un immense parc arboré idéal pour se détendre en barque.", cost: 10, category: "Nature" },
        { name: "Soirée Piazza & Fontaines éclairées", description: "Découverte de la Fontaine de Trevi et du Panthéon de nuit.", cost: 0, category: "Visite" },
        { name: "Visite des Musées du Vatican", description: "Admirez la somptueuse Chapelle Sixtine de Michel-Ange.", cost: 22, category: "Culture" }
      ];
      lodgingCost = budgetType === "Économique" ? 40 : budgetType === "Luxe" ? 220 : 85;
    } else if (lowercaseDest.includes("paris") || lowercaseDest.includes("france")) {
      activityThemes = [
        { name: "Billets d'ascension de la mythique Tour Eiffel", description: "Prendre de la hauteur et observer toute la capitale au crépuscule.", cost: 28, category: "Culture" },
        { name: "Croisière conviviale au fil de la Seine", description: "Au départ du Pont Neuf, une découverte fluide des monuments historiques.", cost: 15, category: "Visite" },
        { name: "Bistro parisien et dégustation de vins", description: "Soirée gourmande dans un établissement typique du Marais.", cost: 35, category: "Gastronomie" },
        { name: "Balade bohème à Montmartre", description: "Flânerie sur les marches de la Basilique du Sacré-Cœur.", cost: 0, category: "Visite" },
        { name: "Visite nocturne du Musée du Louvre", description: "Découvrir la Joconde et la Vénus de Milo dans une ambiance feutrée.", cost: 17, category: "Culture" }
      ];
      lodgingCost = budgetType === "Économique" ? 45 : budgetType === "Luxe" ? 240 : 95;
    } else if (lowercaseDest.includes("barcelone") || lowercaseDest.includes("espagne")) {
      activityThemes = [
        { name: "Entrées pour la basilique de la Sagrada Família", description: "L'insolite chef-d'œuvre inachevé de l'architecte Antoni Gaudí.", cost: 26, category: "Culture" },
        { name: "Tapas festives au cœur du quartier El Born", description: "Poulpes, croquetas fondantes, charcuteries et patatas bravas épicées.", cost: 25, category: "Gastronomie" },
        { name: "Journée Beach Volley et plage à Barceloneta", description: "Tournois amicaux sur la plage suivis d'un bain rafraîchissant.", cost: 0, category: "Nature" },
        { name: "Coucher de soleil magique aux Bunkers del Carmel", description: "La plus spectaculaire vue à 360 degrés sur la cité catalane.", cost: 0, category: "Visite" },
        { name: "Parcours architectural moderniste du Passeig de Gràcia", description: "Contempler la Casa Batlló et la Pedrera illuminées.", cost: 12, category: "Culture" }
      ];
      lodgingCost = budgetType === "Économique" ? 30 : budgetType === "Luxe" ? 190 : 65;
    } else if (lowercaseDest.includes("tokyo") || lowercaseDest.includes("japon")) {
      activityThemes = [
        { name: "Ascension au Shibuya Sky Observatory", description: "Vue vertigineuse au dessus du carrefour le plus fréquenté au monde.", cost: 18, category: "Visite" },
        { name: "Dîner Izakaya traditionnel en groupe", description: "Brochettes Yakitori, gyozas et boissons régionales dans une ruelle rétro.", cost: 30, category: "Gastronomie" },
        { name: "Visite de l'exposition immersive teamLab Planets", description: "Un chef-d'œuvre technologique d'installations numériques d'art.", cost: 26, category: "Culture" },
        { name: "Salles de Karaoké privatives à Shinjuku", description: "Chanter vos hymnes de groupe préférés dans un salon futuriste équipé.", cost: 15, category: "Loisir" },
        { name: "Tour historique du temple bouddhiste Senso-ji", description: "Explorer le vieux quartier d'Asakusa et ses boutiques d'artisanat.", cost: 0, category: "Culture" }
      ];
      lodgingCost = budgetType === "Économique" ? 35 : budgetType === "Luxe" ? 250 : 80;
    }

    const costMultiplier = budgetType === "Économique" ? 0.6 : budgetType === "Luxe" ? 2.2 : 1.0;
    const adjustedActivities = activityThemes.map(act => ({
      ...act,
      cost: Math.round(act.cost * costMultiplier)
    }));

    const itinerary: ItineraryDay[] = [];
    for (let d = 1; d <= days; d++) {
      const act1 = adjustedActivities[(d * 2 - 2) % adjustedActivities.length];
      const act2 = adjustedActivities[(d * 2 - 1) % adjustedActivities.length];

      itinerary.push({
        day: d,
        title: `Jour ${d} : Découverte majeure de ${destination}`,
        events: [
          { id: `gen-ev-${d}-1`, time: "09:00", description: `Petit-déjeuner gourmand local`, cost: budgetType === "Économique" ? 6 : budgetType === "Luxe" ? 22 : 11 },
          { id: `gen-ev-${d}-2`, time: "10:30", description: `${act1.name} - ${act1.description}`, cost: act1.cost },
          { id: `gen-ev-${d}-3`, time: "13:00", description: "Déjeuner convivial de spécialités locales", cost: budgetType === "Économique" ? 9 : budgetType === "Luxe" ? 38 : 18 },
          { id: `gen-ev-${d}-4`, time: "15:00", description: `${act2.name} - ${act2.description}`, cost: act2.cost },
          { id: `gen-ev-${d}-5`, time: "19:30", description: "Dîner festif et débriefing du groupe", cost: budgetType === "Économique" ? 14 : budgetType === "Luxe" ? 65 : 25 }
        ]
      });
    }

    return {
      activities: adjustedActivities,
      itinerary,
      averageLodgingCostPerNight: lodgingCost,
      averageLocalTransportCostPerDay: transportCost
    };
  }

  // Add one of the offline curated recommendations to a specific day of the itinerary
  const handleAddRecommendationToItinerary = (rec: {name: string, description: string, cost: number, category: string}, chosenDay: number) => {
    const emptyItinerary: ItineraryDay[] = activeTrip.itinerary && activeTrip.itinerary.length > 0 
      ? [...activeTrip.itinerary]
      : Array.from({ length: activeTrip.targetDays }).map((_, idx) => ({
          day: idx + 1,
          title: `Jour ${idx + 1} : Exploration de ${activeTrip.selectedDestination || "votre destination"}`,
          events: []
        }));

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

  // Calculation of collective budget breakdown of currently built itinerary and average numbers
  const computeBudgetBreakdown = () => {
    let activitiesCost = 0;
    
    // Sum events on itinerary
    activeTrip.itinerary.forEach((day) => {
      day.events.forEach((ev) => {
        activitiesCost += ev.cost;
      });
    });

    // Safe estimate lodging of days
    const totalNights = Math.max(activeTrip.targetDays - 1, 1);
    const totalLodging = totalNights * activeTrip.averageLodgingCostPerNight;

    // Safe estimate local routes
    const totalLocalTransport = activeTrip.targetDays * activeTrip.averageLocalTransportCostPerDay;

    // Individual flight/transport to destination
    const flightCost = activeTrip.externalTransportCost || 0;

    const totalIndividual = activitiesCost + totalLodging + totalLocalTransport + flightCost;

    return {
      activitiesCost,
      totalLodging,
      totalLocalTransport,
      flightCost,
      totalIndividual,
    };
  };

  const budgetBreakdown = computeBudgetBreakdown();

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-black">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl pointer-events-none -translate-y-6 translate-x-6"></div>
          
          <div className="text-center space-y-2">
            <span className="text-4xl">🛶</span>
            <h1 className="text-2xl font-black font-display text-slate-950 tracking-wide uppercase">
              CO-TRIPPER
            </h1>
            <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">
              Le Workspace des Voyageurs Connectés
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Sélectionnez votre identité pour rejoindre instantanément votre projet et voter en groupe.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
              Rejoindre l'espace de planification :
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleLoginAs(member.id)}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-2xs hover:shadow-xs transition duration-200 cursor-pointer text-left focus:ring-2 focus:ring-indigo-500/20"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                    />
                    <div>
                      <p className="font-bold text-slate-950">{member.name}</p>
                      <p className="text-[10px] text-slate-400 font-normal">Membre Co-Tripper officiel</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-450" />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <p className="text-[10px] text-slate-400">
              Co-Tripper stocke localement toutes vos modifications en mode résilient.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
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
            {activeTab === "voting" && (
              <div id="bento-card-voting" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                        Vote de la Destination Gagnante
                      </h3>
                      <p className="text-xs text-slate-400">
                        Proposez des destinations et votez. L'algorithme retient la destination avec le plus de votes pour bâtir l'itinéraire.
                      </p>
                    </div>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10.5px]">
                    {activeTrip.destinations.length} propositions
                  </span>
                </div>

                {activeTrip.selectedDestination && (
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 p-4 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🏆</span>
                      <div>
                        <p className="text-[10px] text-indigo-500 uppercase font-extrabold tracking-wider">VOTE MAJORITAIRE actuel</p>
                        <h4 className="text-sm font-bold text-indigo-950">Départ choisi pour : {activeTrip.selectedDestination}</h4>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("itinerary")}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-1.5 px-3 rounded-xl transition duration-200 flex items-center gap-1 cursor-pointer whitespace-nowrap self-end sm:self-auto"
                    >
                      Créer le programme à {activeTrip.selectedDestination}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Proposals list with matching indicators */}
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {activeTrip.destinations.length === 0 ? (
                    <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                      Aucune destination n'a encore été votée ou proposée. Renseignez-en une ci-dessous !
                    </div>
                  ) : (
                    activeTrip.destinations.map((dest) => {
                      const totalVotes = dest.votes.length;
                      const ratio = Math.min((totalVotes / Math.max(activeTrip.members.length, 1)) * 100, 100);
                      const isVotedByCurrent = dest.votes.includes(currentMember.id);
                      const isWinning = activeTrip.selectedDestination === dest.name;

                      return (
                        <div
                          key={dest.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isWinning
                              ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/5"
                              : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 text-sm">{dest.name}</span>
                                {isWinning && (
                                  <span className="bg-indigo-600 text-white font-bold text-[8.5px] uppercase px-1.5 py-0.5 rounded">
                                    ÉLU 👑
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Suggéré par <strong className="text-slate-600 font-semibold">{dest.proposedBy}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Vote button toggler */}
                              <button
                                onClick={() => handleVoteDestination(dest.id)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition select-none ${
                                  isVotedByCurrent
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                    : "bg-slate-200/80 hover:bg-slate-300 text-slate-700"
                                }`}
                                title={isVotedByCurrent ? "Retirer mon vote" : "Voter pour cette ville"}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span>{totalVotes}</span>
                              </button>

                              <button
                                onClick={() => handleDeleteDestinationProposal(dest.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 cursor-pointer transition"
                                title="Supprimer cette suggestion"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Gauge indicator */}
                          <div className="mt-3">
                            <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1 font-semibold">
                              <span>Adhésion collective</span>
                              <span>{Math.round(ratio)}% ({totalVotes}/{activeTrip.members.length} membres)</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${ratio}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Form to append destination */}
                <form onSubmit={handleAddDestination} className="pt-2 flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Saisir une nouvelle suggestion de ville (ex : Chamonix, Florence...)"
                    value={newDestName}
                    onChange={(e) => setNewDestName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-300 cursor-pointer flex items-center shrink-0"
                  >
                    Proposer
                  </button>
                </form>
              </div>
            )}

            {/* 3. INTEGRATED DISCUSSION AND MESSAGING BOARD TAB */}
            {activeTab === "chat" && (
              <div id="bento-card-chat" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-6 h-[500px] animate-fadeIn">
                {/* Simulated Members List Panel */}
                <div className="hidden md:flex flex-col border-r border-slate-100 pr-4 space-y-4 h-full overflow-hidden">
                  <div className="pb-2 border-b border-slate-100">
                    <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Groupe de planners ({MOCK_MEMBERS.length})
                    </h4>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">En Ligne & Synchronisés</p>
                  </div>
                  <div className="space-y-2 flex-grow overflow-y-auto">
                    {MOCK_MEMBERS.map((m) => {
                      const isSimulatedConnected = m.id === currentMemberId;
                      return (
                        <div key={m.id} className={`flex items-center gap-2 p-1.5 rounded-xl transition ${isSimulatedConnected ? "bg-indigo-50" : ""}`}>
                          <div className="relative">
                            <img src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full"></span>
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                              {m.name}
                              {isSimulatedConnected && <span className="bg-indigo-600 text-white text-[8px] font-bold px-1 rounded-sm scale-90 shrink-0">Moi</span>}
                            </p>
                            <p className="text-[8px] text-indigo-600/60 font-mono">Disponibilité mise à jour</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main Instant Chat Component */}
                <div className="col-span-1 md:col-span-3 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                      <h3 className="font-bold text-slate-805 text-xs uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Salle de discussion instantanée
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 italic">Discussions de voyage ({activeTrip.messages.length} messages)</span>
                  </div>

                  {/* Messages Scroll Log */}
                  <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 max-h-[300px] scroll-smooth">
                    {activeTrip.messages.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6">
                        Aucun message posté. Envoyez le premier message de planification !
                      </p>
                    ) : (
                      activeTrip.messages.map((msg) => {
                        const isOwn = msg.senderId === currentMember.id;
                        const isSystem = msg.senderId === "system";

                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex gap-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-150/50 text-[11px] text-indigo-800">
                              <span className="font-bold shrink-0">🤖 Assistant :</span>
                              <p className="italic">{msg.text}</p>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id}
                            className={`flex items-start gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}
                          >
                            <img
                              src={msg.senderAvatar}
                              alt={msg.senderName}
                              className="w-7 h-7 rounded-full shrink-0 shadow-2xs object-cover"
                            />
                            <div className={`max-w-[75%] p-2.5 rounded-2xl text-xs space-y-1 ${
                              isOwn 
                                ? "bg-indigo-600 text-white rounded-tr-none" 
                                : "bg-slate-100 text-slate-800 rounded-tl-none"
                            }`}>
                              <div className="flex justify-between items-center gap-2">
                                <span className={`font-bold text-[9px] ${isOwn ? "text-indigo-200" : "text-indigo-600"}`}>
                                  {msg.senderName}
                                </span>
                                <span className="text-[9px] opacity-60 font-mono">
                                  {msg.timestamp}
                                </span>
                              </div>
                              <p className="leading-relaxed break-words">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Text entry box */}
                  <form onSubmit={handleSendChat} className="pt-2 shrink-0 border-t border-slate-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Tapez un message de groupe..."
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-700 outline-hidden font-medium"
                      />
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 4. SHARED PHOTO GALLERY & DOCUMENTS SANDBOX TAB */}
            {activeTab === "media" && (
              <div id="bento-card-sharing" className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
                
                {/* COMPONENT 4A: DOCUMENT DEPOSIT DRAG & DROP SIMULATOR */}
                <div 
                  className={`bg-white rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between space-y-4 min-h-[350px] ${
                    dragActive ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200/80"
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" /> Documents partagés
                      </h3>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded">
                        Centralisé ({activeTrip.documents.length})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      Déposez vos justificatifs, réservations d'hôtels, ou billets d'avion de groupe pour que tout le monde y accède.
                    </p>

                    {/* Document collection list */}
                    <div className="space-y-2 mt-4 max-h-[160px] overflow-y-auto pr-1">
                      {activeTrip.documents.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">
                          Aucun justificatif ou billet centralisé.
                        </p>
                      ) : (
                        activeTrip.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base text-slate-600 shrink-0">📄</span>
                              <div className="truncate">
                                <p className="font-semibold text-slate-700 truncate" title={doc.name}>
                                  {doc.name}
                                </p>
                                <span className="text-[9px] text-slate-400 block">
                                  Ajouté par {doc.uploadedBy} • {doc.size}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => alert(`Téléchargement simulé de : ${doc.name}`)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                title="Télécharger le fichier"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Upload Simulator form */}
                  <div className="pt-2 border-t border-slate-100">
                    <form onSubmit={handleAddManualDoc} className="space-y-2">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Fichier à centraliser (ex: Confirmation_Hotel.pdf)"
                          value={simulatedDocName}
                          onChange={(e) => setSimulatedDocName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full"
                        />
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] px-3.5 rounded-xl transition cursor-pointer select-none shrink-0"
                        >
                          Déposer
                        </button>
                      </div>
                      <div className="bg-dashed border border-slate-200 rounded-xl py-3 text-center text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                        Zone active de dépôt (Drag & Drop)
                      </div>
                    </form>
                  </div>
                </div>

                {/* COMPONENT 4B: PHOTO ALBUM */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 min-h-[350px]">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" /> Album d'Inspirations
                      </h3>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">
                        Photos ({activeTrip.photos.length})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      Liez des liens d'images de beaux paysages ou d'adresses d'hôtels repérés pour donner envie au groupe !
                    </p>

                    {/* Photo Album grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 max-h-[160px] overflow-y-auto pr-1">
                      {activeTrip.photos.length === 0 ? (
                        <div className="col-span-3 text-center text-xs text-slate-400 italic py-6">
                          Aucune photo de planification partagée.
                        </div>
                      ) : (
                        activeTrip.photos.map((ph) => (
                          <div key={ph.id} className="relative rounded-lg overflow-hidden group aspect-video bg-slate-100">
                            <img
                              src={ph.url}
                              alt={ph.caption}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-between p-1">
                              <button
                                onClick={() => handleDeletePhoto(ph.id)}
                                className="self-end p-0.5 bg-rose-600 text-white rounded hover:bg-rose-700"
                                title="Retirer l'image"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-[8px] text-white font-medium truncate block">
                                {ph.caption}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Photo addition form */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <form onSubmit={handleAddPhoto} className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="url"
                          placeholder="URL de l'image (ex: unsplash)"
                          value={photoUrlInput}
                          onChange={(e) => setPhotoUrlInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full font-medium"
                        />
                        <input
                          type="text"
                          placeholder="Légende (ex: Spot couché de soleil)"
                          value={photoCaptionInput}
                          onChange={(e) => setPhotoCaptionInput(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full font-medium"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-1.5 rounded-xl transition cursor-pointer"
                      >
                        Ajouter l'image à l'album
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            )}

            {/* 5. DYNAMIC MULTI-SOURCE ACTIVITY SUGGESTIONS & PROGRAM TAB */}
            {activeTab === "itinerary" && (
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
            )}

          </div>
        </div>
      )}

        {/* STANDALONE CREATE TRIP INTERACTIVE PAGE */}
        {activePage === "create-trip" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest">
                🚀 Nouveau Projet de Voyage
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                Initier une Nouvelle Aventure Collective
              </h2>
              <p className="text-xs text-slate-500">
                Créez un nouveau groupe de voyage. Vous pourrez ensuite inviter vos amis, voter pour des destinations de rêve, synchroniser vos calendriers et suivre le budget en direct.
              </p>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-5">
              <div className="space-y-1.5 font-sans">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                  Nom du Voyage Co-Tripper
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Roadtrip au Portugal 🇵🇹 ou Trek Chamonix 🥾"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                    Durée du séjour (en jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={newTripDays}
                    onChange={(e) => setNewTripDays(Number(e.target.value) || 4)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                    Style de budget
                  </label>
                  <select
                    value={newTripBudget}
                    onChange={(e) => setNewTripBudget(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold cursor-pointer"
                  >
                    <option value="Économique">Économique (Moins cher, auberges, bus)</option>
                    <option value="Modéré">Modéré (Hôtel confort, bistrots savoureux)</option>
                    <option value="Luxe">Luxe (Hôtel de standing, taxis, activités exclusives)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 text-xs text-slate-500 space-y-2">
                <p className="font-bold text-slate-700">👥 Participants associés par défaut :</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700">
                      <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePage("dashboard")}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition duration-300 text-center"
                >
                  Annuler et revenir
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl transition duration-300 shadow-sm text-center cursor-pointer"
                >
                  Lancer ce voyage collectif 🚀
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STANDALONE MON COMPTE & GROUPE INTERACTIVE PAGE */}
        {activePage === "account" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6 animate-fadeIn">
            <div className="space-y-2 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest">
                  👤 Gestion du Profil & Groupe
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-2">
                  Mon Compte Voyageur & Amis Co-Tripper
                </h2>
                <p className="text-xs text-slate-500 animate-pulse-slow">
                  Modifiez votre profil, votre avatar ou ajoutez de nouveaux amis au groupe des planificateurs.
                </p>
              </div>
              <button
                onClick={() => setActivePage("dashboard")}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2 px-3.5 rounded-xl transition duration-200 cursor-pointer"
              >
                ← Retour au Dashboard
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Profile setup card */}
              <div className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Modifier Mon Profil Actuel
                </h3>

                <div className="flex items-center gap-4">
                  <img
                    src={currentMember.avatar}
                    alt={currentMember.name}
                    className="w-16 h-16 rounded-full border-2 border-indigo-600 shadow-md object-cover"
                  />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{currentMember.name}</h4>
                    <p className="text-xs text-slate-400">ID Unique : {currentMember.id}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      NOM D'AFFICHAGE DU VOYAGEUR
                    </label>
                    <input
                      type="text"
                      value={currentMember.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        if (!nextName) return;
                        setMembers(members.map(m => m.id === currentMember.id ? { ...m, name: nextName } : m));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      AVATAR ILLUSTRE (URL IMAGE)
                    </label>
                    <input
                      type="text"
                      value={currentMember.avatar}
                      onChange={(e) => {
                        const nextAvatar = e.target.value;
                        if (!nextAvatar) return;
                        setMembers(members.map(m => m.id === currentMember.id ? { ...m, avatar: nextAvatar } : m));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-700">
                  <p className="font-bold animate-pulse">💡 Astuce :</p>
                  <p className="mt-0.5">Vous pouvez changer d'identité simulée dans la barre violette de simulation en un clic pour tester les réactions, votes et calendrier !</p>
                </div>
              </div>

              {/* Group list card */}
              <div className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Membres de Co-Tripper ({members.length})
                </h3>

                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between bg-white border border-slate-150 p-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{m.name}</p>
                          <p className="text-[10px] text-slate-400">Participant Co-Tripper</p>
                        </div>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 font-mono bg-slate-50 border px-2 py-0.5 rounded">
                        Co-planificateur
                      </span>
                    </div>
                  ))}
                </div>

                {/* Add new traveler */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const nicknameInput = form.elements.namedItem("nickname") as HTMLInputElement;
                    const nameVal = nicknameInput?.value.trim() || "";
                    if (!nameVal) return;
                    if (members.some(m => m.name.toLowerCase() === nameVal.toLowerCase())) {
                      alert("Ce nom d'ami existe déjà.");
                      return;
                    }

                    // Create traveler
                    const randomAvatars = [
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80",
                      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80",
                      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
                    ];
                    const randomAvatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];

                    const newM: Member = {
                      id: uid("m"),
                      name: nameVal,
                      avatar: randomAvatar,
                    };

                    const updatedMembers = [...members, newM];
                    setMembers(updatedMembers);
                    nicknameInput.value = "";
                  }}
                  className="space-y-2 pt-2 border-t border-slate-200"
                >
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    AJOUTER UN PARTICIPANT AU WORKSPACE
                  </label>
                  <div className="flex gap-2">
                    <input
                      name="nickname"
                      type="text"
                      required
                      placeholder="ex: Marie, Marc..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
                    >
                      Ajouter
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
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
  );
}

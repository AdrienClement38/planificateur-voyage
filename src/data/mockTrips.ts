import { Trip } from "../types";

export const MOCK_MEMBERS = [
  { id: "m1", name: "Adrien", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80" },
  { id: "m2", name: "Léa", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80" },
  { id: "m3", name: "Thomas", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80" },
  { id: "m4", name: "Chloé", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80" }
];

export const INITIAL_TRIPS: Trip[] = [
  {
    id: "trip-barcelona",
    name: "Barcelone en Mode Tapas & Plage 🇪🇸",
    description: "Notre escapade annuelle de groupe. Au programme : soleil, tapas, visites de la Sagrada Familia et farniente.",
    selectedDestination: "Barcelone, Espagne",
    targetDays: 4,
    budgetType: "Modéré",
    members: MOCK_MEMBERS,
    availabilities: [
      { id: "a1", memberId: "m1", start: "2026-07-10", end: "2026-07-20" },
      { id: "a2", memberId: "m2", start: "2026-07-12", end: "2026-07-18" },
      { id: "a3", memberId: "m3", start: "2026-07-08", end: "2026-07-16" },
      { id: "a4", memberId: "m4", start: "2026-07-11", end: "2026-07-17" }
    ],
    destinations: [
      { id: "d1", name: "Barcelone, Espagne", proposedBy: "Adrien", votes: ["m1", "m2", "m3", "m4"] },
      { id: "d2", name: "Rome, Italie", proposedBy: "Chloé", votes: ["m3", "m4"] },
      { id: "d3", name: "Lisbonne, Portugal", proposedBy: "Léa", votes: ["m2", "m1"] }
    ],
    activities: [
      {
        id: "act-1",
        name: "Dégustation de Tapas au Marché de la Boqueria",
        description: "Un parcours gourmand pour déguster jambons, croquetas et patatas bravas.",
        cost: 25,
        category: "Gastronomie",
        proposedBy: "Adrien",
        votes: ["m1", "m2", "m4"],
        source: "Airbnb Expériences",
        bookingUrl: "https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Boqueria+Tapas&adults=6&checkin=2026-07-12&checkout=2026-07-18&refinement_paths%5B%5D=%2Fexperiences"
      },
      {
        id: "act-2",
        name: "Visite Express de la Sagrada Família",
        description: "L'incontournable chef-d'œuvre de Gaudi à ne pas rater.",
        cost: 26,
        category: "Culture",
        proposedBy: "Léa",
        votes: ["m1", "m2", "m3", "m4"],
        source: "GetYourGuide",
        bookingUrl: "https://www.getyourguide.fr/sagrada-familia-l2699/"
      },
      {
        id: "act-3",
        name: "Après-midi Beach Volley & Baignade à la Barceloneta",
        description: "Un moment de détente sur la plage de sable chaud.",
        cost: 0,
        category: "Nature",
        proposedBy: "Thomas",
        votes: ["m3", "m4"],
        source: "Google Activités",
        bookingUrl: "https://www.google.com/search?q=Activit%C3%A9s+%C3%A0+d%C3%A9couvrir+%C3%A0+Barcelone+Beach+Volley+a+la+Barceloneta&sa=X&sqi=2&bih=695&biw=1536&dpr=1.25#ttdcs=EAE"
      }
    ],
    averageLodgingCostPerNight: 65,
    averageLocalTransportCostPerDay: 12,
    externalTransportCost: 120, // transport to Barcelone
    itinerary: [
      {
        day: 1,
        title: "Jour 1 : Arrivée et Premières Tapas",
        events: [
          { id: "e1", time: "14:00", description: "Atterrissage à Barcelone et transfert à l'appartement partagé", cost: 10 },
          { id: "e2", time: "17:00", description: "Flânerie libre sur Las Ramblas et quartier Gothique", cost: 0 },
          { id: "e3", time: "20:00", description: "Dîner de retrouvailles chez 'Cervecería Catalana'", cost: 30 }
        ]
      },
      {
        day: 2,
        title: "Jour 2 : Gaudi & Sagrada Familia",
        events: [
          { id: "e4", time: "10:30", description: "Visite guidée intérieure de la Sagrada Família", cost: 26 },
          { id: "e5", time: "13:30", description: "Pause déjeuner Paella au bord de mer", cost: 25 },
          { id: "e6", time: "16:00", description: "Balade reposante dans le splendide Parc Güell", cost: 10 }
        ]
      },
      {
        day: 3,
        title: "Jour 3 : Plage, Fun et Apéro Sunset",
        events: [
          { id: "e7", time: "11:00", description: "Volley-ball et surf-paddle collectif à Barceloneta", cost: 15 },
          { id: "e8", time: "14:30", description: "Dégustation au Marché de la Boqueria", cost: 25 },
          { id: "e9", time: "19:00", description: "Apéro coucher de soleil rooftop bar", cost: 20 }
        ]
      },
      {
        day: 4,
        title: "Jour 4 : Shopping final & Retour",
        events: [
          { id: "e10", time: "10:00", description: "Achat de souvenirs et vêtements locaux", cost: 15 },
          { id: "e11", time: "14:00", description: "Dernier bain de soleil et départ vers l'aéroport", cost: 10 }
        ]
      }
    ],
    messages: [
      { id: "msg1", senderId: "m1", senderName: "Adrien", senderAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80", text: "Salut l'équipe ! Prêts pour Barcelone ? J'ai mis mes disponibilités pour Juillet.", timestamp: "Hier, 14:32" },
      { id: "msg2", senderId: "m2", senderName: "Léa", senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80", text: "Grave hâte ! Mes dates correspondent à fond, on a un gros créneau en commun.", timestamp: "Hier, 15:10" },
      { id: "msg3", senderId: "m3", senderName: "Thomas", senderAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120&q=80", text: "J'ai aussi complété mon calendrier. Pour la destination j'ai voté Barcelone à 100% !", timestamp: "Hier, 16:05" }
    ],
    documents: [
      { id: "doc1", name: "Confirmation_Reservation_AirBnB.pdf", type: "pdf", uploadedBy: "Adrien", size: "1.2 MB", date: "30 Mai 2026" },
      { id: "doc2", name: "Guide_Tapas_Locaux_Barcelone.doc", type: "doc", uploadedBy: "Léa", size: "340 KB", date: "01 Juin 2026" }
    ],
    photos: [
      { id: "p1", url: "https://images.unsplash.com/photo-1583422300615-b413e27fffe2?auto=format&fit=crop&w=600&q=80", caption: "Le magnifique parc Güell qui domine la ville", uploadedBy: "Léa", date: "31 Mai 2026" },
      { id: "p2", url: "https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?auto=format&fit=crop&w=600&q=80", caption: "Sunset sur la plage de Barceloneta", uploadedBy: "Thomas", date: "01 Juin 2026" }
    ]
  },
  {
    id: "trip-iceland",
    name: "Roadtrip Cascades & Geysers 🇮🇸",
    description: "Une aventure sauvage et rafraîchissante dans le sud de l'Islande pour voir les aurores et louer un 4x4.",
    selectedDestination: "Reykjavik, Islande",
    targetDays: 7,
    budgetType: "Luxe",
    members: MOCK_MEMBERS,
    availabilities: [
      { id: "a10", memberId: "m1", start: "2026-09-01", end: "2026-09-12" },
      { id: "a11", memberId: "m2", start: "2026-09-03", end: "2026-09-10" },
      { id: "a12", memberId: "m3", start: "2026-09-02", end: "2026-09-11" }
    ],
    destinations: [
      { id: "d10", name: "Reykjavik, Islande", proposedBy: "Léa", votes: ["m1", "m2", "m3"] },
      { id: "d11", name: "Tokyo, Japon", proposedBy: "Thomas", votes: ["m3", "m4"] }
    ],
    activities: [
      {
        id: "act-10",
        name: "Baignade au Blue Lagoon thermal",
        description: "Moment de détente absolue dans les eaux sulfureuses bleu azur.",
        cost: 85,
        category: "Loisir",
        proposedBy: "Chloé",
        votes: ["m1", "m2", "m3", "m4"],
        source: "GetYourGuide",
        bookingUrl: "https://www.getyourguide.fr/s/?q=Blue+Lagoon+Reykjavik"
      },
      {
        id: "act-11",
        name: "Randonnée sur le glacier Sólheimajökull",
        description: "Une marche encadrée de 3h équipés de crampons et piolets.",
        cost: 95,
        category: "Nature",
        proposedBy: "Thomas",
        votes: ["m1", "m3"],
        source: "Airbnb Expériences",
        bookingUrl: "https://www.airbnb.fr/s/Reykjavik%2C%20Islande/experiences?query=Glacier+Solheimajokull&adults=6&refinement_paths%5B%5D=%2Fexperiences"
      }
    ],
    averageLodgingCostPerNight: 140,
    averageLocalTransportCostPerDay: 45, // Location du gros SUV 4x4
    externalTransportCost: 450,
    itinerary: [
      {
        day: 1,
        title: "Jour 1 : Arrivée et lagon bleu",
        events: [
          { id: "e20", time: "15:00", description: "Atterrissage à Keflavík, récupération du SUV 4x4", cost: 0 },
          { id: "e21", time: "16:30", description: "Immersion relaxante magique dans les eaux du Blue Lagoon", cost: 85 },
          { id: "e22", time: "20:00", description: "Dîner de gastronomie nordique à Reykjavik", cost: 65 }
        ]
      }
    ],
    messages: [
      { id: "msg10", senderId: "m2", senderName: "Léa", senderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80", text: "L'Islande s'annonce complètement épique !", timestamp: "Il y a 3 jours" }
    ],
    documents: [],
    photos: []
  }
];

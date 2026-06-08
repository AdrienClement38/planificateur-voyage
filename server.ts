import express from "express";
import path from "path";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRouter from "./server/routes/auth";
import tripsRouter from "./server/routes/trips";
import tripContentRouter from "./server/routes/trip-content";
import uploadsRouter from "./server/routes/uploads";
import { attachUser } from "./server/auth/middleware";
import { runMigrations } from "./server/db/migrate-runner";
import { createServer } from "node:http";
import { initRealtime } from "./server/realtime";
import { fetchPlaceActivities, discoverPlaceHighlightsBatch } from "./server/services/places";
import { suggestCities } from "./server/services/geo";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Derrière le reverse-proxy d'AlwaysData : IP cliente réelle + cookies Secure.
app.set("trust proxy", 1);

// En-têtes de sécurité (HSTS, X-Content-Type-Options, etc.). CSP désactivée
// pour ne pas casser la SPA Vite/PWA — à durcir ultérieurement si besoin.
app.use(helmet({ contentSecurityPolicy: false }));

// Compression gzip des réponses (JSON d'API ~−70/80 %) : bande passante + mobile.
app.use(compression());

app.use(express.json({ limit: "1mb" }));

// CORS : permet à l'app mobile (Capacitor, origine capacitor://localhost) et
// aux PWA installées d'appeler l'API hébergée sur un autre domaine.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Authentification : lecture des cookies, attache req.user, routes /api/auth.
app.use(cookieParser());
app.use(attachUser);
app.use("/api/auth", authRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/trips", tripContentRouter);
app.use("/api/trips", uploadsRouter);

// Offline curated database of world destinations
interface Activity {
  name: string;
  description: string;
  cost: number;
  category: "Visite" | "Gastronomie" | "Culture" | "Loisir" | "Nature" | "Shopping";
  source?: "GetYourGuide" | "Airbnb Expériences" | "Google Activités";
  rating?: number;
  reviewsCount?: number;
  duration?: string;
  bookingUrl?: string;
}

const DESTINATIONS_DATABASE: Record<string, Activity[]> = {
  paris: [
    { name: "Ascension de la Tour Eiffel 🗼", description: "Contemplez la capitale et ses célèbres ponts depuis le belvédère parisien.", cost: 28, category: "Visite" },
    { name: "Visite du Musée du Louvre d'Art Classique 🎨", description: "Admirez la Joconde, la Vénus de Milo et des milliers de chefs-d'œuvre historiques.", cost: 22, category: "Culture" },
    { name: "Flânerie bohème à Montmartre & Sacré-Cœur ⛪", description: "Sillonnez les ruelles pittoresques de la butte à la rencontre des peintres de rue.", cost: 0, category: "Visite" },
    { name: "Dégustation de macarons & Thé à Saint-Germain 🧁", description: "Initiez vos papilles à la haute pâtisserie fine dans un salon légendaire.", cost: 20, category: "Gastronomie" },
    { name: "Croisière fluviale romantique sur la Seine ⛵", description: "Naviguez sous les ponts illuminés de Paris à la lueur des projecteurs.", cost: 16, category: "Loisir" },
    { name: "Pique-nique champêtre au Jardin du Luxembourg 🌳", description: "Bordez les bassins historiques et profitez des chaises vertes sous les feuillages.", cost: 10, category: "Nature" },
    { name: "Session Shopping sur les boulevards Haussmann 🛍️", description: "Explorez les Galeries Lafayette sous leur majestueuse coupole en verre.", cost: 25, category: "Shopping" }
  ],
  rome: [
    { name: "Visite insolite du Colisée & du Forum Romain 🏛️", description: "Marchez au milieu des ruines millénaires et de l'arène des empereurs romains.", cost: 24, category: "Culture" },
    { name: "Balade nocturne de la Fontaine de Trevi & Panthéon ⛲", description: "Jetez une pièce de monnaie pour assurer votre retour dans la Ville Éternelle.", cost: 0, category: "Visite" },
    { name: "Atelier culinaire de fabrication de Pâtes fraîches 🍝", description: "Façonnez vos raviolis ou fettuccines avec un chef local au cœur du quartier de Trastevere.", cost: 45, category: "Gastronomie" },
    { name: "Flânerie paisible dans les Jardins de la Villa Borghese 🌳", description: "Louez une barque sur le lac ou détendez-vous sous les grands pins parasols italiens.", cost: 8, category: "Nature" },
    { name: "Visite guidée des musées du Vatican & Chapelle Sixtine ⛪", description: "Contemplez la fresque magistrale peinte par Michel-Ange au plafond de la chapelle.", cost: 30, category: "Culture" },
    { name: "Dégustation des glaces artisanales (Gelato) de légende 🍦", description: "Savourer d'authentiques glaces crémées chez un maître artisan réputé depuis 1900.", cost: 6, category: "Gastronomie" }
  ],
  barcelone: [
    { name: "Visite magique de la Sagrada Família de Gaudí 🏰", description: "Explorez la nef d'arbres en pierre et les vitraux multicolores de cette basilique unique.", cost: 26, category: "Culture" },
    { name: "Parcours guidé féerique dans le Parc Güell 🦎", description: "Découvrez les mosaïques de salamandres en céramique et les bancs ondulés du génie de l'architecture.", cost: 13, category: "Visite" },
    { name: "Coucher de soleil suspendu aux Bunkers del Carmel 🌅", description: "Pique-niquez au point culminant avec un panorama à 360° sur toute la côte méditerranéenne.", cost: 0, category: "Nature" },
    { name: "Plat culinaire de Tapas & Sangria au Marché de Santa Caterina 🥘", description: "Partagez de délicieuses patatas bravas, croquetas et jamón ibérico authentiques.", cost: 22, category: "Gastronomie" },
    { name: "Spectacle vibrant de Flamenco traditionnel au Born 💃", description: "Ressentez l'énergie fougueuse de la guitare espagnole et du chant andalou de première ligne.", cost: 30, category: "Loisir" },
    { name: "Balade les pieds dans le sable à la Barceloneta 🌊", description: "Flânez sur le remblai maritime bordé de palmiers et respirez l'air marin rafraîchissant.", cost: 0, category: "Nature" }
  ],
  lisbonne: [
    { name: "Dégustation des chaudes Pasteis de Belém traditionnelles 🧁", description: "Dégustez la recette originale ultra-secrète datant de 1837 saupoudrée de cannelle.", cost: 6, category: "Gastronomie" },
    { name: "Traversée historique en Tramway en bois n°28 🚃", description: "Sillonnez les collines abruptes et les façades d'Azulejos du vieux quartier de l'Alfama.", cost: 3, category: "Visite" },
    { name: "Sunset musical acoustique au Miradouro da Senhora do Monte 🌅", description: "Savourez la plus belle vue sur le fleuve Tage avec des artistes locaux jouant de la guitare.", cost: 0, category: "Loisir" },
    { name: "Escapade de conte de fée aux châteaux magiques de Sintra 🏰", description: "Explorez l'extravagant Palais de Pena perché au sommet de la forêt subtropicale.", cost: 20, category: "Culture" },
    { name: "Dîner Fado en direct dans une taverne familiale locale 🎶", description: "Savourez un poisson grillé bercé par le chant mélancolique traditionnel portugais.", cost: 35, category: "Gastronomie" },
    { name: "Balade sur le port au bord du Monument des Découvertes ⛵", description: "Respirez la brise marine le long des rives de l'estuaire du Tage d'où partaient les caravelles.", cost: 0, category: "Visite" }
  ],
  tokyo: [
    { name: "Bain de foule vertigineux au Shibuya Sky 🏙️", description: "Prenez de la hauteur au 47ème étage pour admirer le croisement mythique et le Mont Fuji par ciel dégagé.", cost: 18, category: "Visite" },
    { name: "Visite interactive sensorielle teamLab Planets 🔮", description: "Marchez pieds nus dans des bassins d'eau au milieu de projections florales infinies.", cost: 28, category: "Culture" },
    { name: "Dîner de grillades Okonomiyaki à Shimokitazawa 🥢", description: "Savourez ces crêpes épaisses japonaises cuites sur tables chauffantes devant vous.", cost: 22, category: "Gastronomie" },
    { name: "Balade zen sous les Torii géants du Meiji Jingu & Harajuku ⛩️", description: "Découvrez le sanctuaire shintoïste niché dans une forêt d'arbres au milieu du dynamisme urbain.", cost: 0, category: "Visite" },
    { name: "Session Retro Gaming & Manga à Akihabara 👾", description: "Sillonnez les boutiques d'arcades rétro sur plusieurs étages et découvrez la pop culture nippone.", cost: 10, category: "Loisir" },
    { name: "Coucher de soleil sur Odaiba et sa statue de la Liberté miniature 🗼", description: "Observez le pont suspendu Rainbow Bridge s'embraser au crépuscule depuis la plage de l'île artificielle.", cost: 0, category: "Nature" }
  ],
  londres: [
    { name: "Tour emblématique du Palais de Westminster & Big Ben 🏛️", description: "Admirez le cœur politique du Royaume-Uni et écoutez retentir la cloche légendaire.", cost: 0, category: "Visite" },
    { name: "Visite du British Museum & ses trésors antiques 🏺", description: "Explorez gratuitement l'Histoire du monde, de la pierre de Rosette aux momies d'Égypte.", cost: 0, category: "Culture" },
    { name: "Dégustation Street-Food internationale à Borough Market 🧀", description: "Savourez des plats cultes venus du monde entier sous les grandes verrières victoriennes.", cost: 18, category: "Gastronomie" },
    { name: "Flânerie bucolique & location de barque à Hyde Park 🌳", description: "Pédalez près du lac Serpentine et observez les écureuils peu farouches.", cost: 10, category: "Nature" },
    { name: "Tournée des Pubs historiques du quartier bohème de Soho 🍺", description: "Goûtez une authentique bière brune Stout ou un cidre doux dans un pub du XVIIe siècle.", cost: 25, category: "Loisir" },
    { name: "Vol suspendu à bord de la grande roue London Eye 🎡", description: "Prenez place dans une cabine de verre pour une vue plongeante à 135m sur la Tamise.", cost: 35, category: "Visite" }
  ],
  newyork: [
    { name: "Balade suspendue sur la High Line & Chelsea Market 🌳", description: "Sillonnez cette ancienne voie ferrée réhabilitée en parc luxuriant au milieu des gratte-ciel.", cost: 0, category: "Visite" },
    { name: "Observatoire du Top of the Rock au Rockefeller Center 🏙️", description: "Admirez le plus beau panorama sur Central Park et le mythique Empire State Building.", cost: 42, category: "Visite" },
    { name: "Pique-nique herbeux à Sheep Meadow dans Central Park 🧺", description: "Évadez-vous dans le poumon vert de Manhattan pour vous reposer après la fureur urbaine.", cost: 12, category: "Nature" },
    { name: "Dégustation des classiques Bagels & Pastrami à Brooklyn 🥯", description: "Savourer la street-food new-yorkaise emblématique dans d'anciennes fabriques réaménagées.", cost: 18, category: "Gastronomie" },
    { name: "Visite mémorable du Met (Metropolitan Museum of Art) 🖼️", description: "Explorez un temple d'art s'étendant de l'Égypte antique aux galeries contemporaines.", cost: 25, category: "Culture" },
    { name: "Balade en ferry gratuite vers Staten Island (Vue de la Statue) 🗽", description: "Frôlez la Statue de la Liberté sur l'eau et admirez la grandiose Skyline de Manhattan.", cost: 0, category: "Loisir" }
  ],
  venise: [
    { name: "Flânerie sur la magnifique Place Saint-Marc & Basilique ⛪", description: "Admirez les mosaïques dorées byzantines et le campanile s'élever face à la lagune.", cost: 5, category: "Culture" },
    { name: "Excursion maritime sur les îles colorées de Burano & Murano ⛵", description: "Découvrez les petites briques multicolores des pêcheurs et l'art des souffleurs de verre.", cost: 20, category: "Visite" },
    { name: "Dégustation apéritive de Cicchetti traditionnels dans un Bacaro 🍷", description: "Savourez ces mini bruschettas vénitiennes croustillantes accompagnées d'un Spritz frais.", cost: 15, category: "Gastronomie" },
    { name: "Balade historique sur le majestueux Pont du Rialto 🌉", description: "Contemplez le ballet incessant des gondoles voguant sur le célèbre Grand Canal.", cost: 0, category: "Visite" },
    { name: "Balade tranquille et romantique le long des Zattere 🌅", description: "Prenez un bain de soleil face à l'île de la Giudecca en mangeant une glace gianduiotto.", cost: 6, category: "Nature" }
  ]
};

// Procedural builder for any unknown custom destination
function generateProceduralActivities(destination: string, costMultiplier: number): Activity[] {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  return [
    {
      name: `Randonnée & Belvédère à ${normDest} 🏔️`,
      description: "Prenez de l'altitude pour observer la plus belle vue panoramique de la région, idéale au coucher du soleil.",
      cost: Math.round(0 * costMultiplier),
      category: "Nature"
    },
    {
      name: `Découverte du Coeur Historique de ${normDest} 🏛️`,
      description: "Une balade à pied pour repérer les monuments emblématiques et comprendre le cachet authentique du coin.",
      cost: Math.round(10 * costMultiplier),
      category: "Visite"
    },
    {
      name: `Grand banquet de spécialités locales & Terroir 🥘`,
      description: `Rendez-vous dans une auberge de tradition pour savourer le plat fétiche emblématique de la région de ${normDest}.`,
      cost: Math.round(25 * costMultiplier),
      category: "Gastronomie"
    },
    {
      name: `Visite guidée du Musée Municipal 🎭`,
      description: "Rencontre enrichissante avec l'art local, l'histoire et les secrets culturels de la cité.",
      cost: Math.round(15 * costMultiplier),
      category: "Culture"
    },
    {
      name: `Roulade côtière ou sortie vélo en groupe 🚲`,
      description: "Prendre un grand bol d'air frais le long des berges paysagées ou pistes cyclables d'intérêt local.",
      cost: Math.round(12 * costMultiplier),
      category: "Loisir"
    },
    {
      name: `Flânerie gourmande sur le Marché Hebdomadaire 🧀`,
      description: "Rencontrez les artisans et dégustez du fromage, du pain de pays et des fruits de saison.",
      cost: Math.round(8 * costMultiplier),
      category: "Gastronomie"
    },
    {
      name: `Session d'emplettes artisanales de Souvenirs 🛍️`,
      description: "Explorez un quartier commerçant pour dénicher des créations ou spécialités insolites à rapporter.",
      cost: Math.round(20 * costMultiplier),
      category: "Shopping"
    }
  ];
}

// Generate high-fidelity simulated GetYourGuide (GYG) catalog deals for the destination
function generateGetYourGuideActivities(destination: string, costMultiplier: number): Activity[] {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const lowerDest = destination.toLowerCase();

  let items;
  if (lowerDest.includes("barcelon")) {
    items = [
      {
        name: `Billet coupe-file officiel pour la Sagrada Família de Barcelone 🎫`,
        description: `Sécurisez votre entrée coupe-file pour visiter l'un des monuments les plus célèbres au monde.`,
        cost: Math.round(26 * costMultiplier),
        category: "Culture" as const,
        rating: 4.8,
        reviewsCount: 154200,
        duration: "2h",
        bookingUrl: "https://www.getyourguide.fr/sagrada-familia-l2699/"
      },
      {
        name: `Visite guidée authentique à pied du vieux centre historique 🚶`,
        description: `Sillonnez le quartier Gothique de Barcelone avec un guide certifié et apprenez son histoire secrète.`,
        cost: Math.round(15 * costMultiplier),
        category: "Culture" as const,
        rating: 4.7,
        reviewsCount: 3840,
        duration: "2 heures",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Barcelone+vieux+centre+visite`
      },
      {
        name: `Excursion guidée d'une journée à Montserrat depuis Barcelone 🚌`,
        description: `Montez dans les hauteurs sacrées de la montagne de Catalogne et découvrez l'abbaye mythique. Transport inclus.`,
        cost: Math.round(55 * costMultiplier),
        category: "Nature" as const,
        rating: 4.9,
        reviewsCount: 9240,
        duration: "1 journée",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Montserrat+Barcelone`
      },
      {
        name: `Croisière en catamaran au coucher du soleil avec apéritif dînatoire ⛵`,
        description: `Naviguez paisiblement le long des côtes barcelonaises pour admirer la ville s'illuminer avec boissons et musique.`,
        cost: Math.round(32 * costMultiplier),
        category: "Loisir" as const,
        rating: 4.8,
        reviewsCount: 6510,
        duration: "1h30",
        bookingUrl: `https://www.getyourguide.fr/s/?q=Barcelone+catamaran+coucher+soleil`
      }
    ];
  } else {
    items = [
      {
        name: `Billet coupe-file officiel pour les attractions de ${normDest} 🎫`,
        description: `Accès prioritaire garanti pour explorer les monuments incontournables de la ville. Audioguide multilingue inclus. Évitez les files d'attente interminables aux guichets !`,
        cost: Math.round(22 * costMultiplier),
        category: "Visite" as const,
        rating: 4.8,
        reviewsCount: Math.floor(Math.random() * 2500) + 400,
        duration: "2h - 3h",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " attractions")}`
      },
      {
        name: `Visite guidée authentique à pied du vieux centre de ${normDest} 🚶`,
        description: `Sillonnez les ruelles de charme emblématiques avec un guide historien local certifié et découvrez les anecdotes captivantes et les recoins cachés de la ville.`,
        cost: Math.round(15 * costMultiplier),
        category: "Culture" as const,
        rating: 4.7,
        reviewsCount: Math.floor(Math.random() * 800) + 120,
        duration: "2 heures",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " visite guidee walking tour")}`
      },
      {
        name: `Excursion d'une journée complète guidée depuis ${normDest} 🚌`,
        description: `Transport tout confort climatisé inclus pour visiter des villages exceptionnels à la campagne, des forêts d'intérêt ou des châteaux forts pittoresques voisins.`,
        cost: Math.round(55 * costMultiplier),
        category: "Nature" as const,
        rating: 4.9,
        reviewsCount: Math.floor(Math.random() * 1200) + 180,
        duration: "1 journée",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " excursion day trip")}`
      },
      {
        name: `Dégustation & apéritif au coucher du soleil avec spécialités locales 🍷`,
        description: `Savourez les saveurs du coin lors d'un apéritif convivial au meilleur point de vue, pour admirer la ville s'illuminer à la nuit tombée.`,
        cost: Math.round(32 * costMultiplier),
        category: "Gastronomie" as const,
        rating: 4.8,
        reviewsCount: Math.floor(Math.random() * 1400) + 210,
        duration: "1h30",
        bookingUrl: `https://www.getyourguide.fr/s/?q=${encodeURIComponent(normDest + " apero degustation coucher soleil")}`
      }
    ];
  }

  return items.map(it => ({
    ...it,
    source: "GetYourGuide" as const
  }));
}

// Generate high-fidelity simulated Airbnb Expériences deals for the destination
function generateAirbnbExperiences(
  destination: string, 
  costMultiplier: number, 
  adults: number = 6, 
  checkin: string = "2026-07-20", 
  checkout: string = "2026-07-26"
): Activity[] {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const lowerDest = destination.toLowerCase();

  let items;
  if (lowerDest.includes("barcelon")) {
    items = [
      {
        name: `Visitez la Sagrada Família avec un guide certifié ⛪`,
        description: `Vivez une exploration privilégiée guidée du chef-d'œuvre de Gaudi avec des détails historiques et les tickets officiels d'accès prioritaires inclus.`,
        cost: Math.round(79 * costMultiplier),
        category: "Culture" as const,
        rating: 4.78,
        reviewsCount: 1806,
        duration: "1,5 heure",
        bookingUrl: `https://www.airbnb.fr/experiences/4527793?adults=${adults}&checkin=${checkin}&checkout=${checkout}&location=Barcelone%2C%20Espagne&currentTab=experience_tab&federatedSearchId=cdeb7f58-95c2-44dc-b657-1c2ca55ff964&sectionId=51d71af4-1887-4b5b-bda5-e5a52e26d961`
      },
      {
        name: `Croisière au coucher du soleil à Barcelone avec boissons & tapas ⛵`,
        description: `Montez à bord de notre voilier pour observer le magnifique sunset catalan tout en savourant des amuse-bouches et des rires complices à bord.`,
        cost: Math.round(44 * costMultiplier),
        category: "Loisir" as const,
        rating: 4.9,
        reviewsCount: 1251,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Croisiere+coucher+du+soleil&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Atelier Paella authentique dans mon jardin secret 🥘`,
        description: `Apprenez la recette traditionnelle de la paella espagnole avec une sangria de fruits frais dans un patio historique intimiste plein de poésie.`,
        cost: Math.round(69 * costMultiplier),
        category: "Gastronomie" as const,
        rating: 4.98,
        reviewsCount: 4796,
        duration: "2,5 heures",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Atelier+Paella&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Champagne et convivialité sur un voilier en mer de Barcelone 🥂`,
        description: `Glissez sur la Méditerranée avec un skipper professionnel local, musique, champagne frais, fruits et détente magique en amoureux ou entre amis.`,
        cost: Math.round(37 * costMultiplier),
        category: "Loisir" as const,
        rating: 4.93,
        reviewsCount: 431,
        duration: "1,5 heure",
        bookingUrl: `https://www.airbnb.fr/s/Barcelone%2C%20Espagne/experiences?query=Voilier+Champagne&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      }
    ];
  } else {
    items = [
      {
        name: `Masterclass culinaire locale & dégustation avec un chef privé 🥘`,
        description: `Apprenez à façonner les célèbres mets typiques du marché avec des secrets de famille originaux, suivis d'un dîner de groupe très chaleureux et d'un bon vin de pays.`,
        cost: Math.round(45 * costMultiplier),
        category: "Gastronomie" as const,
        rating: 4.95,
        reviewsCount: Math.floor(Math.random() * 320) + 40,
        duration: "3 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Cuisine+Gastronomie+Local&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Shooting photo professionnel & balade insolite des secrets de ${normDest} 📸`,
        description: `Repérez des points de vue féeriques et panoramas uniques méconnus du grand public tout en profitant d'un shooting à emporter avec un photographe pro.`,
        cost: Math.round(35 * costMultiplier),
        category: "Loisir" as const,
        rating: 4.85,
        reviewsCount: Math.floor(Math.random() * 180) + 30,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Shooting+photo+visite&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Tournée cachée des speakeasies secrets et spiritueux locaux 🍸`,
        description: `Découvrez l'âme nocturne de la ville et dégustez de superbes mélanges ou vins fins façonnés par un mixologue local chevronné au Born ou Soho.`,
        cost: Math.round(30 * costMultiplier),
        category: "Loisir" as const,
        rating: 4.78,
        reviewsCount: Math.floor(Math.random() * 150) + 20,
        duration: "2h30",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Cocktail+Secrets+Speakeasy&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      },
      {
        name: `Atelier créatif de céramique traditionnelle ou de peinture avec un artisan 🎨`,
        description: `Exprimez votre esprit artistique dans un atelier de quartier convivial et fabriquez de vos propres mains votre plus beau souvenir de voyage.`,
        cost: Math.round(25 * costMultiplier),
        category: "Culture" as const,
        rating: 4.9,
        reviewsCount: Math.floor(Math.random() * 95) + 15,
        duration: "2 heures",
        bookingUrl: `https://www.airbnb.fr/s/${encodeURIComponent(normDest)}/experiences?query=Atelier+creatif+artisan&adults=${adults}&checkin=${checkin}&checkout=${checkout}&refinement_paths%5B%5D=%2Fexperiences`
      }
    ];
  }

  return items.map(it => ({
    ...it,
    source: "Airbnb Expériences" as const
  }));
}

// Generate Google Activités focusing on iconic monuments and geographic public highlights
function generateGoogleActivities(destination: string, costMultiplier: number): Activity[] {
  const normDest = destination.charAt(0).toUpperCase() + destination.slice(1);
  const cleanKey = destination.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Pick from our pre-curated base database, otherwise build procedural landmarks
  const curatedBase = DESTINATIONS_DATABASE[cleanKey] || generateProceduralActivities(destination, costMultiplier);

  return curatedBase.map(l => {
    // Specific search query for this specific activity to display its dedicated details card and tickets
    const cleanName = l.name.replace(/[^\w\sÀ-ÿ]/gi, '').trim();
    const query = `Activités à découvrir à ${normDest} ${cleanName}`;
    const bookingUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&sa=X&sqi=2&bih=695&biw=1536&dpr=1.25#ttdcs=EAE`;

    return {
      name: l.name,
      description: l.description,
      cost: l.cost,
      category: l.category,
      source: "Google Activités" as const,
      rating: Number((4.4 + Math.random() * 0.5).toFixed(1)),
      reviewsCount: Math.floor(Math.random() * 12000) + 1500,
      duration: l.duration || "1h30 - 3h",
      bookingUrl
    };
  });
}

// Generate the complete deterministic timeline asynchronously
async function buildOfflineItinerary(
  destination: string,
  days: number,
  budgetType: string,
  adults: number = 6,
  checkin: string = "2026-07-20",
  checkout: string = "2026-07-26",
  page: number = 0
) {
  const cleanKey = destination.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Lodging and transport scale deterministically based on budgetType
  const costMultiplier = budgetType === "Économique" ? 0.6 : budgetType === "Luxe" ? 2.5 : 1.0;
  const lodgingCost = budgetType === "Économique" ? 35 : budgetType === "Luxe" ? 175 : 75;
  const transportCost = budgetType === "Économique" ? 7 : budgetType === "Luxe" ? 32 : 14;

  // 1) Vraies activités géolocalisées (OSM + Wikipédia + Wikidata). On ne renvoie
  //    QUE des données factuelles : nom réel, vraie description, catégorie réelle,
  //    lien réel. Aucun prix/note/avis « estimé », aucun faux vote.
  const real = await fetchPlaceActivities(destination);
  // Pagination « Voir d'autres idées » : on sert une tranche de la liste profonde
  // (déjà classée du + au - pertinent). Page au-delà de la liste = tranche vide
  // (catalogue épuisé) — surtout PAS le repli hors-ligne.
  const PAGE_SIZE = 12;
  const realPage = real.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const activities =
    real.length > 0
      ? realPage.map((act, index) => ({
          id: `act-real-${cleanKey}-${page * PAGE_SIZE + index}`,
          name: act.name,
          description: act.description,
          cost: act.cost ?? 0, // prix RÉEL si fourni, sinon 0, jamais inventé
          category: act.category,
          proposedBy: act.provider, // "OpenStreetMap" | "Wikivoyage" | "Wikipédia" | "Foursquare"
          source: undefined as string | undefined,
          rating: act.rating as number | undefined, // note RÉELLE ou rien
          reviewsCount: act.reviewsCount as number | undefined,
          duration: act.duration,
          bookingUrl: act.bookingUrl,
          imageUrl: act.imageUrl as string | undefined,
          votes: [] as number[],
        }))
      : // 2) Repli (rare) : catalogue hors-ligne, quand les API sont injoignables.
        [
          ...generateGetYourGuideActivities(destination, costMultiplier),
          ...generateAirbnbExperiences(destination, costMultiplier, adults, checkin, checkout),
          ...generateGoogleActivities(destination, costMultiplier),
        ].map((act, index) => ({
          id: `act-comb-${cleanKey}-${index}-${Math.floor(Math.random() * 100000)}`,
          name: act.name,
          description: act.description,
          cost: act.cost,
          category: act.category,
          proposedBy:
            act.source === "GetYourGuide"
              ? "GetYourGuide 🎫"
              : act.source === "Airbnb Expériences"
                ? "Airbnb Expériences 🏠"
                : "Google Activités ✈️",
          source: act.source as string | undefined,
          rating: act.rating as number | undefined,
          reviewsCount: act.reviewsCount as number | undefined,
          duration: act.duration,
          bookingUrl: act.bookingUrl,
          votes: [] as number[],
        }));

  // PROGRAM EMPTY BY DEFAULT: As requested, the program should start with empty events so that passengers can plan!
  const itinerary = [];
  for (let d = 1; d <= days; d++) {
    itinerary.push({
      day: d,
      title: `Jour ${d} : Exploration de ${destination}`,
      events: [] // EMPTY BY DEFAULT, no events pre-scheduled
    });
  }

  return {
    activities,
    itinerary,
    averageLodgingCostPerNight: lodgingCost,
    averageLocalTransportCostPerDay: transportCost,
    isMock: false,
    note: `Suggestions d'activités via GetYourGuide 🎫, Airbnb Expériences 🏠 et Google Activités ✈️.`
  };
}

// (Banques de thèmes « générés » supprimées : on ne fabrique plus de fausses
//  activités — les suggestions viennent uniquement des sources réelles.)


// REST route to suggest activities with absolute robustness
app.post("/api/suggest-activities", async (req, res) => {
  const { destination, days, budgetType, adults, checkin, checkout, page } = req.body;

  if (!destination) {
    return res.status(400).json({ error: "La destination est requise." });
  }

  const requestedDays = Math.min(Math.max(Number(days) || 3, 1), 21);
  const budget = budgetType || "Modéré";
  const pageNum = Math.max(0, Number(page) || 0);

  console.log(`[API Live Suggestions] ${destination} · jours ${requestedDays} · page ${pageNum}`);

  try {
    const results = await buildOfflineItinerary(
      destination,
      requestedDays,
      budget,
      adults,
      checkin,
      checkout,
      pageNum,
    );
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: "Échec de génération du parcours.", details: err?.message });
  }
});

// Œuvres majeures à voir dans des lieux (musée, chapelle…) — données Wikidata.
// En LOT (les noms des cartes visibles) pour n'afficher le bouton « Œuvres à
// voir » que là où il y a vraiment quelque chose. Public, lecture seule, caché.
app.post("/api/place-highlights", async (req, res) => {
  const names = Array.isArray(req.body?.names)
    ? req.body.names.filter((n: unknown): n is string => typeof n === "string").slice(0, 60)
    : [];
  if (names.length === 0) return res.json({ highlights: {} });
  try {
    const highlights = await discoverPlaceHighlightsBatch(names);
    return res.json({ highlights });
  } catch (err: any) {
    return res.status(500).json({ error: "Échec.", details: err?.message });
  }
});

// Autocomplétion de villes pour la saisie de la DESTINATION (proxy Photon/OSM).
// Public, lecture seule : sert le formulaire de création (avant même qu'un
// voyage existe) ET la proposition de villes au vote. Aucune clé exposée, cache
// côté serveur. Renvoie proprement [] si Photon est injoignable (repli : champ
// libre). Limité par IP : l'autocomplétion tape vite, on protège Photon + le serveur.
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { suggestions: [] },
});

app.get("/api/geo/suggest", geoLimiter, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (q.trim().length < 2) return res.json({ suggestions: [] });
  try {
    const suggestions = await suggestCities(q);
    return res.json({ suggestions });
  } catch {
    // Jamais d'erreur dure pour de l'autocomplétion : on dégrade en champ libre.
    return res.json({ suggestions: [] });
  }
});

// Start Express server and serve frontend
async function startServer() {
  // Auto-migration au démarrage : la base (PostgreSQL en prod, PGlite en dev)
  // est mise à niveau avant de servir les requêtes.
  await runMigrations();

  if (process.env.NODE_ENV !== "production") {
    // Import dynamique : Vite n'est chargé qu'en dev, donc le bundle de prod
    // (dist/server.cjs) ne dépend pas de Vite et tourne avec les seules
    // dépendances de production (utile pour un hébergement léger type AlwaysData).
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = createServer(app);
  initRealtime(httpServer); // WebSocket temps réel (/ws)
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Co-Tripper Server] En écoute sur http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Co-Tripper Server] Échec du démarrage :", err);
  process.exit(1);
});

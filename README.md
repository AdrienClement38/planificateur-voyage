# 🛶 Co-Tripper — Planificateur de Voyage Coordonné

Ce projet est une application web collaborative et innovante conçue pour simplifier la planification et la coordination de voyages en groupe. Grâce à des outils interactifs en temps réel et une approche axée sur l'expérience utilisateur, l'organisation collective devient fluide, démocratique et visuelle.

---

## 🎯 But du Projet

L'organisation d'un voyage à plusieurs est souvent un casse-tête (disponibilités divergentes, désaccords sur le budget ou les destinations, éparpillement des idées, etc.).

**Co-Tripper** résout ce problème en centralisant toutes les étapes de la préparation au même endroit :
1. **Trouver les meilleures dates** en superposant visuellement les disponibilités de chacun.
2. **Décider ensemble de la destination** grâce à un système démocratique de vote.
3. **Maîtriser le budget individuel** de manière transparente, interactive et en temps réel.
4. **Co-construire l'itinéraire** et les activités au programme.
5. **Centraliser les échanges et documents** (chat d'équipe, photos, billets, réservations).

Le tout avec une interface moderne, fluide, animée, et compatible avec un usage **hors-ligne (offline-first)**.

---

## 🚀 Fonctionnalités Réalisées jusqu'à présent

### 1. 👥 Simulation Multi-Utilisateur & Profils Intuitifs
* **Création de profil à la volée** : Formulaire permettant de créer son profil voyageur en choisissant un avatar emoji personnalisé ou un avatar généré selon son prénom.
* **Simulateur d'identité contextuel** : Module interactif permettant d'alterner instantanément entre différents voyageurs simulés du groupe (Adrien, Chloé, Emma, etc.) pour tester l'overlay des dates et cumuler des votes en direct.
* **Partage et simulation d'invitation** : Génération de liens de partage instantanés et invitations par e-mail fictives. La validation d'une invitation simule automatiquement l'arrivée d'un nouvel ami actif avec ses propres disponibilités et un message de bienvenue personnalisé dans le chat.

### 2. 🗓️ Optimisation des Dates (Calendrier de Disponibilités)
* **Saisie intuitive** : Chaque voyageur peut renseigner son intervalle de départ préféré.
* **Visualisation par superposition** : Un calendrier met en surbrillance automatique les **jours d'intersection commune optimaux** où le maximum d'amis sont disponibles simultanément.

### 3. 💰 Budget Interactif par Participant
* **Calculateur en temps réel** : Débrayage d'un menu déroulant de budget estimé par voyageur prenant en compte :
  * Les coûts d'hébergement ajustés sur la durée du séjour.
  * Les coûts de transports locaux journaliers.
  * La somme des prix des activités d'ores et déjà votées et prévues au programme.
* **Ajusteur de Transport Principal (A/R)** : Curseur interactif permettant à chaque voyageur de simuler et mettre à jour immédiatement le coût estimé de ses billets d'avion ou de train.

### 4. 🗳️ Démocratie de Groupe : Vote de Destinations & Activités
* **Vote de destinations** : Liste de propositions avec indicateurs de niveau de vie (Économique, Standard, Premium) et vote à un clic par les participants.
* **Suggestion de programme** : Ajout d'activités qualifiées par type (Culture, Nature, Détente, Sport) et soumises aux avis de l'équipe pour être planifiées dans l'itinéraire.

### 5. 💬 Messagerie Intégrée & Journal de Bord
* **Chat de groupe interactif** : Envoi de messages enrichis et d'émojis.
* **Automation relationnelle** : Messages émis dynamiquement par les amis simulés lorsqu'ils rejoignent le projet pour saluer le groupe de voyageurs.

### 6. 📂 Partage de Médias & Documents
* Un espace sécurisé pour stocker les pièces jointes importantes (cartes d'embarquement, réservations d'hôtel) et un carrousel d'inspiration de jolies photos partagées pour le brainstorming visuel.

### 7. 🔌 Mode Hors-Ligne (Offline Space)
* **Indicateur d'état réseau** : Un interrupteur dynamique permettant de passer l'application en mode déconnecté.
* **Persistance Locale** : L'ensemble des données (voyages, membres, votes, messages) est synchronisé et stocké de manière robuste dans le `localStorage` de l'utilisateur pour préserver toutes ses modifications même sans accès Internet.

---

## 🛠️ Architecture Technique

* **Front-end** : [React 19](https://react.dev/) avec configuration d'applications modernes rapides en [Vite](https://vitejs.dev/).
* **Styling** : [Tailwind CSS v4](https://tailwindcss.com/) pour un design fluide, élégant et entièrement responsive (Mobile / Tablette / Desktop).
* **Icônes** : [Lucide React](https://lucide.dev/) pour une sémiologie visuelle cohérente et épurée.
* **State Management** : store centralisé via React Context (`useTripStore`), persistance locale (`localStorage`) **validée par [Zod](https://zod.dev/)** au chargement.
* **Type Safety** : Intégration stricte de [TypeScript](https://www.typescriptlang.org/) pour la robustesse logicielle et la détection des erreurs à la compilation.
* **Qualité** : logique métier pure isolée dans `src/domain/`, tests [Vitest](https://vitest.dev/), [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/), CI GitHub Actions.
* **Mobile** : [PWA](https://web.dev/explore/progressive-web-apps) installable (offline réel) + [Capacitor](https://capacitorjs.com/) pour la publication sur les stores.

### 🤖 Suggestions d'activités

Le serveur ([server.ts](server.ts)) génère les suggestions d'activités en **mode hors-ligne déterministe** par défaut : une base curatée de destinations (Paris, Rome, Barcelone, Lisbonne, Tokyo, Londres, New York, Venise…) complétée par un générateur procédural pour toute ville inconnue, en simulant trois sources (GetYourGuide, Airbnb Expériences, Google Activités). Aucune clé d'API n'est requise — l'app fonctionne entièrement sans réseau.

Une couche d'enrichissement par **IA générative (Gemini)** est prévue de façon **optionnelle** : si la variable `GEMINI_API_KEY` est fournie, le serveur pourra affiner les suggestions ; sinon il se rabat proprement sur le mode hors-ligne. (Dégradation gracieuse.)

### 🗂️ Structure du projet

```
src/
├─ domain/      Logique métier pure, testée (budget, dates, itinéraire, activités)
├─ lib/         api · id · schemas (Zod)
├─ hooks/       useLocalStorage (persistance validée)
├─ store/       TripContext — useTripStore() : état centralisé, typé
├─ pages/       LoginScreen · CreateTripPage · AccountPage
├─ features/    DashboardSidebar · TripWorkspace · onglets (Voting/Chat/Media/Itinerary)
├─ components/  AppHeader · AvailabilityCalendar · OfflineIndicator · LoadingFallback
└─ App.tsx      Fournit le store et assemble l'interface
```

Voir [CLAUDE.md](CLAUDE.md) pour les conventions de développement détaillées.

---

## 🚦 Développement

```bash
npm install
npm run dev            # http://localhost:3000
PORT=3002 npm run dev  # …ou sur un autre port
```

Qualité (exécutés aussi en CI sur chaque push) :

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm test            # 19 tests Vitest (logique domain/)
npm run build       # build web + serveur
```

---

## 🚀 Déploiement

### 🌐 Web — AlwaysData

L'app web et l'API (comptes, voyages, médias) sont servies par le même serveur Node/Express.

1. Créer une base **PostgreSQL** sur AlwaysData et noter son URL de connexion.
2. Sur le site **Node.js** AlwaysData, définir les variables d'environnement :
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://…` (la base créée à l'étape 1)
   - *(le `PORT` est injecté automatiquement par AlwaysData)*
   - *(optionnel)* `GEMINI_API_KEY` pour l'enrichissement IA.
3. Installer + builder : `npm ci && npm run build` (produit `dist/` + `dist/server.cjs`).
4. *(Recommandé)* alléger le runtime : `npm prune --omit=dev` — retire les
   dépendances de **build** (React, Vite, Capacitor, esbuild…) inutiles au
   serveur en production (~−300 Mo sur le disque).
5. Commande de démarrage : `npm start` (lance `node dist/server.cjs`).
   Les **migrations s'appliquent automatiquement au démarrage** (PostgreSQL).

> En local, sans `DATABASE_URL`, l'app utilise **PGlite** (PostgreSQL embarqué,
> fichier `data/dev`) — aucune installation de base de données requise.

L'app est aussi une **PWA** : installable depuis le navigateur (« Ajouter à
l'écran d'accueil ») avec un vrai mode hors-ligne (service worker).

### 📱 Mobile — Android (Capacitor / Play Store)

L'app mobile réutilise **exactement le même code** : le build web est emballé
dans une app native. Comme le bundle mobile est statique, il appelle l'API
**à distance** → définir l'URL d'AlwaysData au moment du build :

```bash
# 1. Build web pointant vers l'API distante + synchronisation native
VITE_API_BASE_URL="https://VOTRE-APP.alwaysdata.net" npm run build:mobile

# 2. Ouvrir le projet Android (nécessite Android Studio)
npm run cap:open:android
```

Puis, depuis Android Studio : générer l'APK/AAB signé et le publier sur le
Play Store. À chaque modification du code : relancer `npm run build:mobile`.

> **iOS** : nécessite un Mac (ou un service de build cloud) pour compiler et
> publier sur l'App Store. La même base de code s'y appliquera via
> `npx cap add ios`.

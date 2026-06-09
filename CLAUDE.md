# CLAUDE.md

Guide pour travailler efficacement sur **Co-Tripper** (planificateur de voyage en groupe).

## Vue d'ensemble

Application **full-stack** de planification de voyage de groupe :
- **Front** : React 19 + TypeScript (Vite) + Tailwind v4 (SPA, PWA installable).
- **Back** : serveur **Express** servant le front + une **API REST** (`/api`)
  pour les comptes, les voyages et toutes les ressources collaboratives.
- **Base de données** via **Drizzle ORM** : **PostgreSQL** en production
  (AlwaysData), **PGlite** (Postgres embarqué, fichier `data/`) en local —
  aucune installation de base requise pour développer.
- **Comptes réels** : authentification email + mot de passe (argon2), sessions
  cookie `httpOnly` (web) ou jeton **Bearer** (mobile cross-origin).

Cible : **une seule base de code → web (AlwaysData) + app mobile (Capacitor /
stores)**. Détails de déploiement dans le [README](README.md).

> Historique : l'app était au départ une démo locale (localStorage, multi-
> utilisateur simulé). Elle est devenue un vrai produit multi-utilisateur avec
> backend. Voir `docs/ROADMAP-PRODUIT.md`.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (Express + Vite middleware), auto-migration PGlite |
| `npm run build` | Build web (`dist/`) **+** bundle serveur (`dist/server.cjs`) |
| `npm run build:web` | Build web seul (pour le mobile) |
| `npm run build:mobile` | `vite build` + `cap sync` |
| `npm start` | Serveur de prod (`node dist/server.cjs`) — auto-migration au démarrage |
| `npm run typecheck` · `lint` · `format` | `tsc --noEmit` · ESLint · Prettier |
| `npm test` · `test:watch` · `coverage` | Vitest |
| `npm run db:generate` | Génère une migration depuis `server/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations (CLI ; aussi auto au démarrage) |

- Port configurable : `PORT=3002 npm run dev`. Base prod : variable `DATABASE_URL`.
- `DISABLE_HMR=true` désactive le HMR (utilisé par l'environnement d'agent).

## Architecture

### Front (`src/`)
```
domain/      Logique métier PURE, testée (budget · availability · itinerary · activities)
lib/         apiClient (client API typé) · api (suggestActivities) · avatar · id · schemas (Zod)
store/       useTripController (cœur : auth · voyages · génération + handlers API-backed) ·
             useActiveTripContent (édition collaborative du voyage actif : votes, planning,
             chat, médias) ; TripContext → useTripStore()
pages/       AuthScreen · CreateTripPage · AccountPage
features/    DashboardSidebar · TripWorkspace · {Voting,Chat,Media,Itinerary}Tab
components/  AppHeader · AvailabilityCalendar · OfflineIndicator · LoadingFallback
App.tsx      Provider + AppShell (gating auth / chargement / état vide)
```

### Back (`server/`)
```
db/          schema (Drizzle) · client (PGlite/Postgres) · migrate-runner · migrations/
auth/        password (argon2) · session · middleware (attachUser, requireAuth)
routes/      auth · trips · trip-content (collaboratif) · uploads
services/    trip-aggregate (DB normalisée → forme Trip dénormalisée du front) ·
             moteur de suggestions MODULAIRE : places (orchestrateur fusion/dédup/
             enrichissement) · geo (géocodage + autocomplétion) · sources wikidata,
             overpass, wikipedia, wikivoyage, foursquare · ranking (vues Wikipédia) ·
             classify · enrich · highlights (œuvres à voir) · core/http (contrat + helpers)
server.ts    (racine) entrée : helmet, CORS, cookies, auth, routes, static, auto-migration
```

## Conventions importantes

- **État via `useTripStore()`** (Context). Le contrôleur `useTripController`
  contient tout l'état + les handlers ; `TripStore = ReturnType<…>` (zéro
  divergence). Les handlers appellent l'**API** et mettent à jour le voyage actif.
- **Logique métier pure dans `src/domain/`** (sans React, testée). Réutilisée
  côté serveur quand pertinent.
- **Appels API via `src/lib/apiClient.ts`** (cookies `credentials: include`,
  `Authorization: Bearer` si `VITE_API_BASE_URL` défini = mobile). Erreurs
  typées `ApiError`.
- **API serveur** : validation **Zod** de chaque corps ; **autorisation**
  systématique (membre du voyage) ; chaque mutation renvoie l'agrégat à jour.
- **IDs** : `uid("prefix")` côté front ; UUID `defaultRandom()` côté DB.
- **Destination** : choisie à la création (optionnelle) ou via action explicite
  (PATCH). Le **vote ne la définit jamais automatiquement** (signal seulement).
- **Onglets/pages lourds** : `React.lazy` sous `Suspense`.

## Tests

Vitest. Aujourd'hui : `src/domain/**` (logique pure). Voir aussi les tests
backend (Supertest) si présents. La CI (`.github/workflows/ci.yml`) exécute
typecheck + lint + test + build sur chaque push/PR.

## Pièges / notes

- Ne pas committer `dist/`, `data/` (DB + uploads locaux). Le projet `android/`
  est versionné (artefacts gitignorés par Capacitor).
- Auto-migration au démarrage : un `server/db/schema.ts` modifié nécessite
  `npm run db:generate` (commiter la migration générée).
- L'API de suggestions fonctionne **hors-ligne** (données curées) ; couche
  Gemini optionnelle si `GEMINI_API_KEY`.
- iOS nécessite un Mac ; Android se build sous Windows via Android Studio.
- Pages légales (`public/*.html`) = modèles à compléter ; domaine d'exemple
  `co-tripper.example` (robots/sitemap) à remplacer.

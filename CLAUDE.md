# CLAUDE.md

Guide pour travailler efficacement sur **Co-Tripper** (planificateur de voyage en groupe).

## Vue d'ensemble

App web React + TypeScript (Vite) qui aide un groupe à organiser un voyage :
calendrier de disponibilités, vote de destinations, budget par participant,
itinéraire, chat et partage de médias. **Offline-first** : toutes les données
vivent dans le `localStorage` (aucune base de données). Un serveur Express léger
sert le front et expose une API de suggestions d'activités.

Cible : **une seule base de code → web (AlwaysData) + app mobile (Capacitor /
Play Store)**. Voir « Déploiement » dans le [README](README.md).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (Express + Vite middleware) sur `PORT` (déf. 3000) |
| `npm run build` | Build web (`dist/`) **+** bundle serveur (`dist/server.cjs`) |
| `npm run build:web` | Build web seul (utilisé pour le mobile) |
| `npm start` | Lance le serveur de prod (`node dist/server.cjs`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (`--write`) |
| `npm test` | Tests Vitest (one-shot) · `test:watch` pour le mode watch |
| `npm run coverage` | Couverture (domain/ + lib/) |
| `npm run build:mobile` | `vite build` + `cap sync` (met à jour le projet natif) |
| `npm run cap:open:android` | Ouvre le projet Android dans Android Studio |

- Choisir le port : `PORT=3002 npm run dev` (le serveur respecte `process.env.PORT`).
- En dev, le HMR peut être désactivé via `DISABLE_HMR=true` (utilisé par l'environnement d'agent pour éviter le scintillement).

## Architecture (`src/`)

```
domain/      Logique métier PURE (sans React) — testée unitairement
             budget · availability · itinerary · activities
lib/         api (URL configurable) · id (uuid) · schemas (Zod)
hooks/       useLocalStorage (persistance + validation Zod)
store/       TripContext — useTripStore() : état + handlers centralisés
pages/       LoginScreen · CreateTripPage · AccountPage
features/    DashboardSidebar · TripWorkspace · {Voting,Chat,Media,Itinerary}Tab
components/  AppHeader · AvailabilityCalendar · OfflineIndicator · LoadingFallback
App.tsx      Fournit le store + assemble pages/dashboard
types.ts     Types du domaine (Trip, Member, ActivityProposal, …)
data/        mockTrips (données de démo initiales)
```

## Conventions importantes

- **État partagé via `useTripStore()`** (Context), pas de prop-drilling.
  Le contrat `TripStore` (dans `store/TripContext.tsx`) doit rester aligné avec
  l'objet `store` construit dans `App.tsx` — `tsc` le garantit. Pour exposer une
  nouvelle valeur/handler à un composant : l'ajouter à l'interface **et** à
  l'objet `store`.
- **Logique métier dans `domain/`** : fonctions pures, sans dépendance React,
  faciles à tester. Toute nouvelle règle de calcul va là (et reçoit un test).
- **Validation au chargement** : les données `localStorage` sont validées par
  Zod (`lib/schemas.ts`) ; en cas de forme invalide, on retombe sur les défauts.
- **IDs** : toujours `uid("prefix")` (`lib/id.ts`), jamais `Date.now()`.
- **Appels API** : passer par `lib/api.ts` (`suggestActivities`). L'URL de base
  est `import.meta.env.VITE_API_BASE_URL` — vide en web (chemins relatifs),
  absolue (AlwaysData) pour le build mobile.
- **Onglets/pages lourds** : chargés en `React.lazy` sous `Suspense`
  (`LoadingFallback`).

## Tests

Tests Vitest sur `src/domain/**` (logique pure). Ajouter un `*.test.ts` à côté
du module testé. Lancer `npm test`. La CI (`.github/workflows/ci.yml`) exécute
typecheck + lint + test + build sur chaque push/PR.

## Pièges / notes

- Ne pas committer `dist/` (gitignoré). Le projet natif `android/` est versionné,
  mais ses artefacts de build sont gitignorés par Capacitor.
- L'API de suggestions fonctionne **hors-ligne** (données curées déterministes) ;
  une couche Gemini optionnelle s'active si `GEMINI_API_KEY` est fournie.
- iOS nécessite un Mac (ou un build cloud) ; Android se build sous Windows via
  Android Studio.

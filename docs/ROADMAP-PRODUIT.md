# Roadmap « Passage en produit grand public »

Document de cadrage pour transformer Co-Tripper (démo locale) en produit public,
hébergeable sur AlwaysData, conforme RGPD et référençable sur Google.

> Statut : **plan validé à coder**. Chaque phase ci-dessous deviendra une série
> de commits sur une branche dédiée, vérifiée (tsc + lint + tests + build).

---

## 0. Constat : où on en est

L'app est aujourd'hui une **démo 100 % locale** :
- les données vivent dans le `localStorage` de **chaque navigateur** ;
- le « multi-utilisateur » est **simulé** dans un seul navigateur (switch d'identité) ;
- rien n'est partagé entre de vrais utilisateurs sur des appareils différents.

Pour un produit où un groupe collabore réellement, il faut un **backend** :
comptes, base de données partagée, API, et synchronisation.

---

## 1. Architecture backend cible

### 1.1 Stack (choisie pour tenir sur le free tier 256 Mo)

| Brique | Choix | Pourquoi |
|---|---|---|
| Serveur | **Express** (existant) | déjà en place, léger |
| ORM | **Drizzle ORM** | full-TS, très léger (pas de moteur natif comme Prisma) |
| DB locale (dev) | **SQLite** (`better-sqlite3`) | zéro install, fichier `data/dev.db` |
| DB prod | **PostgreSQL** (AlwaysData) | même schéma Drizzle, dialecte `pg` |
| Migrations | **drizzle-kit** | génère/applique les migrations SQL |
| Hash mot de passe | **argon2** (ou `@node-rs/argon2`) | standard moderne |
| Sessions | cookie **httpOnly + Secure + SameSite**, table `sessions` | simple, sûr, pas de JWT à révoquer |
| Validation | **Zod** (déjà là) | réutilise `lib/schemas.ts` côté serveur |

> Drizzle permet **le même code de schéma** pour SQLite (local) et Postgres (prod) ;
> on bascule via une variable d'env `DATABASE_URL`.

### 1.2 Modèle de données (schéma normalisé)

Les votes (aujourd'hui des tableaux d'IDs) deviennent des **tables de liaison**.

```
users            id · email(unique) · password_hash · display_name · avatar · created_at
sessions         id · user_id → users · expires_at
trips            id · owner_id → users · name · description · selected_destination
                 · target_days · budget_type · avg_lodging · avg_local_transport
                 · external_transport_cost · created_at
trip_members     trip_id → trips · user_id → users · role            (appartenance)
availabilities   id · trip_id · user_id · start · end
destinations     id · trip_id · name · proposed_by → users
destination_votes  destination_id → destinations · user_id → users
activities       id · trip_id · name · description · cost · category · source
                 · rating · reviews_count · duration · booking_url · proposed_by
activity_votes   activity_id → activities · user_id → users
itinerary_days   id · trip_id · day · title
events           id · day_id → itinerary_days · time · description · cost
messages         id · trip_id · user_id · text · created_at
documents        id · trip_id · uploaded_by · name · type · size · url · created_at
photos           id · trip_id · uploaded_by · url · caption · created_at
```

### 1.3 API REST (esquisse)

```
POST   /api/auth/signup            {email, password, displayName}
POST   /api/auth/login             {email, password}      → set cookie session
POST   /api/auth/logout
GET    /api/auth/me                                        → user courant
DELETE /api/auth/me                                        → suppression compte (RGPD)
GET    /api/auth/export                                    → export données (RGPD)

GET    /api/trips                                          → voyages de l'utilisateur
POST   /api/trips
GET    /api/trips/:id
PATCH  /api/trips/:id
DELETE /api/trips/:id
POST   /api/trips/:id/join                                 → rejoindre via lien

# Sous-ressources (CRUD) : availabilities, destinations, votes, activities,
# itinerary/events, messages, documents, photos — toutes scoping par trip_id +
# vérification que l'utilisateur est membre du voyage (autorisation).

POST   /api/suggest-activities      (existant, inchangé)
```

Toutes les routes protégées vérifient : **session valide** + **membre du voyage**.

### 1.4 Stratégie offline ↔ serveur

L'app est « offline-first » ; on garde cet atout sans complexité excessive :

- **MVP : online-first + cache.** Le serveur est la source de vérité. Au
  chargement, on récupère les données via l'API ; le `localStorage` sert de
  **cache de lecture hors-ligne** et de **file d'attente d'écritures** rejouées
  à la reconnexion (last-write-wins). Le hook `useLocalStorage` + le store
  `useTripStore` actuels facilitent ça (on remplace la persistance locale par
  un client API + cache).
- **Plus tard : collaboration temps réel.** D'abord du *polling* léger (refetch
  toutes les N s), puis WebSocket si besoin (édition simultanée du même voyage).

> Le découpage déjà réalisé (logique pure `domain/`, store central) rend cette
> bascule **localisée** : surtout `lib/api.ts`, le store, et le hook de
> persistance. Les composants ne changent quasi pas.

### 1.5 Tient-on sur AlwaysData gratuit ?

- Serveur Node prod = statique + API ≈ 60–100 Mo RAM → OK dans 256 Mo.
- Drizzle + `pg` avec un **petit pool** (2–4 connexions) → léger.
- DB Postgres free (~100 Mo) → large pour démarrer.
- 1/4 CPU → OK pour de l'I/O à faible trafic.
- **Upgrade** nécessaire seulement à l'échelle (forte concurrence).

---

## 2. Sécurité (checklist)

- [ ] HTTPS partout (fourni par AlwaysData) ; cookies `Secure`.
- [ ] Mots de passe hashés (argon2), jamais en clair / jamais loggés.
- [ ] Sessions `httpOnly` + `SameSite=Lax/Strict` ; expiration + rotation.
- [ ] Validation **Zod** de tous les corps de requête (réutiliser `lib/schemas`).
- [ ] Autorisation systématique (membre du voyage) sur chaque route.
- [ ] **Rate-limiting** (login, signup, API) — `express-rate-limit`.
- [ ] En-têtes de sécurité (`helmet`) : CSP, HSTS, etc.
- [ ] CSRF : protégé par `SameSite` + en-tête custom pour les mutations.
- [ ] Secrets en variables d'env (jamais commités) — déjà la règle.
- [ ] Pas de PII dans les logs ; pas de stack traces en prod.
- [ ] Uploads (docs/photos) : limiter taille/type, ou stocker des URLs externes.

---

## 3. RGPD / conformité (checklist)

> Aujourd'hui : **exposition quasi nulle** (aucune donnée perso ne quitte le
> navigateur). La conformité devient requise dès l'arrivée des comptes/DB.

**Légal (pages à publier) :**
- [ ] Politique de confidentialité (données collectées, finalité, base légale,
  durée de conservation, droits, contact DPO/responsable).
- [ ] CGU / Conditions d'utilisation.
- [ ] **Mentions légales** (obligatoires en France : éditeur, hébergeur…).
- [ ] Bannière de **consentement** si cookies non essentiels / analytics.

**Technique (à implémenter) :**
- [ ] **Droit à l'effacement** : `DELETE /api/auth/me` supprime le compte + données.
- [ ] **Droit à la portabilité** : `GET /api/auth/export` (JSON des données).
- [ ] Minimisation : ne collecter que l'email + le nécessaire.
- [ ] Consentement explicite à l'inscription (case CGU + confidentialité).
- [ ] Durée de conservation + purge des comptes inactifs.

**Atout** : AlwaysData héberge en **France/UE** → résidence des données conforme.

---

## 4. SEO / visibilité Google

L'app est une SPA (rendu client) → peu de HTML pour les crawlers. On ne
référence pas l'app (derrière login) mais une **vitrine**.

- [ ] **Landing page publique crawlable** (statique/SSR) : titre, meta
  description (✓), **Open Graph** + **Twitter cards**, HTML sémantique.
- [ ] `robots.txt` + `sitemap.xml`.
- [ ] Bon score **Lighthouse** (perf/accessibilité/SEO), responsive (✓), HTTPS (✓).
- [ ] Données structurées (`schema.org` `WebApplication`).
- [ ] Option d'implémentation : **Astro** ou simple HTML statique pour la
  landing (séparée de la SPA) — évite de migrer toute l'app en Next.js.

---

## 5. Roadmap d'implémentation (ordre conseillé)

| Phase | Contenu | Dépend de |
|---|---|---|
| **B1** | Fondation DB : Drizzle + schéma + migrations (SQLite local) | — |
| **B2** | Auth : signup / login / logout / me, hash argon2, sessions cookie | B1 |
| **B3** | API CRUD (trips + sous-ressources) + autorisation | B2 |
| **B4** | Bascule de l'app : `localStorage` → client API + cache offline | B3 |
| **B5** | Config Postgres prod + déploiement AlwaysData | B3 |
| **B6** | RGPD technique (delete/export) + pages légales + consentement | B2 |
| **B7** | Sécurité durcie (helmet, rate-limit, CSP) | B3 |
| **B8** | Landing SEO (Astro/HTML) + sitemap/robots/OG | — (parallélisable) |
| **B9** | Temps réel (polling → WebSocket) — *optionnel* | B4 |

**Chemin critique pour un lancement** : B1 → B2 → B3 → B4 → B7 → B6 → B5,
avec B8 en parallèle.

---

## 6. Décisions (validées juin 2026)

1. **Auth** : **email + mot de passe** (argon2 + sessions cookie). Google/OAuth
   pourra être ajouté plus tard.
2. **Sync** : **online-first + cache** (serveur = source de vérité, localStorage
   en cache/queue offline, last-write-wins).
3. **Landing** : **Astro**, projet séparé de la SPA (B8).
4. **Uploads** : **vrai upload de fichiers** (documents/photos) **avec limites**
   pour tenir sur le free tier :
   - taille max par fichier (ex. **5 Mo**),
   - quota de stockage **par voyage** (ex. **50 Mo**),
   - types autorisés (images + PDF),
   - stockage disque AlwaysData en MVP ; migration possible vers un stockage
     objet (ex. Cloudflare R2) si le volume grossit.

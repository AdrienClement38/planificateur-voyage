# Moteur de suggestions d'activités — mémoire de conception

> Récap complet du moteur de suggestions (sources, tri, filtres, œuvres,
> robustesse, pré-chargement) et des décisions prises. Sert de **mémoire** pour
> reprendre le travail. Tout est dans `server/services/places.ts` (sauf le
> pré-chargement, dans `server/routes/trips.ts`, et l'UI dans
> `src/features/ItineraryTab.tsx`).

## Vue d'ensemble

Pour une destination, on assemble de **vrais lieux** à partir de sources
ouvertes, on **filtre** (que des lieux visitables), on **classe par notoriété
touristique réelle**, et on enrichit (photos, descriptions). **Zéro donnée
inventée** (jamais de note/prix/avis bidon — règle absolue).

## Sources (toutes gratuites/ouvertes)

- **Wikidata** (SPARQL `wikibase:around`) = source PRINCIPALE. Rayon **20 km**
  (capte les alentours : Versailles, Bygdøy…), seuil ≥14 langues, `LIMIT 500`
  (sinon mégapoles bridées car les top-sitelinks sont des non-lieux).
- **OpenStreetMap** (Overpass, multi-miroir), **Wikivoyage** (`{{voir}}/{{faire}}`),
  **Wikipédia** (geosearch) = en SECOURS / complément (Wikipédia ramène des
  institutions, donc reléguée aux petites villes / fallback).
- Foursquare/Amadeus : abandonnés (Foursquare passé payant 06/2026, Amadeus
  self-service fermé 07/2026).

## Tri = notoriété TOURISTIQUE (le cœur)

- **PAS les sitelinks** (nombre de langues Wikipédia) : c'est encyclopédique, pas
  touristique → ça sur-classe communes voisines, rivières, chaînes de montagnes.
- **Vues Wikipédia réelles sur 3 ANS**, via l'API REST par article
  (`/metrics/pageviews/per-article/...`). Fenêtre LONGUE = lisse les pics
  actu/sport (sur 60 j, Wembley passait #1 devant Big Ben !).
- **Vues FR PURES** quand l'article FR existe (audience de l'app = touristes
  FRANÇAIS) ; l'EN ne sert que de SECOURS (réduit à l'échelle FR, ×0,1) pour les
  lieux sans article FR. L'EN est gonflé par l'intérêt SPORTIF **mondial** (un
  stade explose en EN via le foot) : on l'ignore quand on a du FR. C'est
  l'audience FR — et non un malus — qui distingue le **stade-attraction** (Camp
  Nou, que les Français visitent → vues FR réelles, reste #2 à Barcelone) du
  **stade-pas-touristique** (Ullevaal à Oslo → vues FR faibles, tombe à #6).
- Repli sitelinks si pas de vues. **Aucun bonus/malus bidouillé** (règle posée
  par Adrien : tri par notoriété pure).
- Sondé sur le **top-40 candidats** + **concurrence 16** + **cache 14 j** (sinon
  ~100 appels REST = 35 s). Voir « Limites ».

## Filtres & purges (ce qui ne doit JAMAIS sortir en liste, et ce qui reste)

Filtre « lieu » (allow-list de super-types via P31/P279*) **découpé en lots de
100 en parallèle** (fiabilité). Puis purge secondaire :

| Exclu | Comment | Gardé (important !) |
|---|---|---|
| Communes **séparées** (Courmayeur) | zone habitée Q486972 **sans** être quartier Q123705/Q2983893 | Quartiers (Montmartre, Trastevere) |
| Rivières | watercourse Q355304 | — |
| Chaînes/massifs | Q46831 | Sommets individuels (aiguille du Midi) |
| Supermarchés (Carrefour) | chaîne Q507619/Q18043413 | Grands magasins (Galeries Lafayette) |
| Œuvres en standalone (Le Cri, La Pietà) | groupe-de-peintures Q18573970 + page d'homonymie Q4167410 en bad-types ; **œuvre (sculpture/peinture) DANS un édifice** (P276 → musée/église/palais) en purge | Statues **extérieures** (Manneken-Pis, Statue de la Liberté) |
| Événements (conclave, Journée des Tuiles) | bad-types + NOISE_BLOCK | — |
| Bateaux-objets (Fram) | exclus du filtre lieu | Bateaux-LIEUX (HMS Belfast) — *à ajouter, cf. Reste à faire* |

## « Œuvres à voir » (volet sur les cartes)

- Œuvres d'art rattachées à un lieu via **P276/P195**, **+ sous-collection
  P361*** (La Joconde = département des peintures DU Louvre), **+ versions P527**
  (Le Cri en plusieurs versions au musée Munch). Seuil ≥5 langues.
- Munch→Le Cri, Louvre→La Joconde, Vatican/Sixtine→fresques, Orsay→toiles.
- UI : bouton **masqué si aucune œuvre**, **accordéon** (un seul ouvert),
  **clic photo → plein écran** (lightbox, sans lien Wikipédia). Endpoint
  **groupé** `POST /api/place-highlights` (1 requête pour les cartes visibles).
- **Que des œuvres d'art** (pas les activités type téléphérique — celles-ci
  restent dans la liste principale).

## Robustesse (durement gagnée — ne pas régresser !)

- Le filtre « lieu » **renvoie `null` en cas d'échec réseau** (≠ Set vide).
- **FAIL-SAFE, jamais fail-open** : si le filtre échoue, on **garde les candidats
  Wikidata** (pré-filtrés bad-types) **triés par vues** — surtout PAS de repli
  Wikipédia (ordre pourri) ni de fuite de non-lieux.
- Réessais sur toutes les requêtes SPARQL ; lots parallèles.
- **Tri en DEUX PALIERS — anti-mélange d'échelles** (commit `8b89329`) : `fame`
  mélangeait les vraies vues (~10³-10⁵) et le repli liens/sitelinks (~10²). Si la
  récup des vues d'un lieu MAJEUR échouait (throttle), il retombait à ~200 et
  **plongeait sous un lieu mineur** ayant eu ses vues → ordre **instable** d'une
  régénération à l'autre. Fix : champ **`views` distinct de `fame`** ; au tri
  final, **palier 1 = lieux AVEC vues** (triés par vues), **palier 2 = les autres**
  (par `fame`). Un échec de récup ⇒ au pire en tête du palier 2, jamais enfoui.
- **Récup des vues fiabilisée** : réessais avec **back-off** (l'API REST throttle
  vite en rafale), un échec = `null` (**≠ « 0 vue »**, non mis en cache),
  **concurrence 6** (＞ fiable que 16), **EN sondé seulement en secours** (lieux
  sans vue FR) ⇒ ~2× moins d'appels REST, donc moins de throttle.

## Pré-chargement + cache (latence invisible)

- **Pré-chauffe en arrière-plan** dès qu'une destination est choisie (création de
  voyage `POST /trips` ou sélection `PATCH /trips/:id`) → `warmSuggestions()`
  fire-and-forget. Quand l'user ouvre Suggestions, c'est chaud → quasi instantané.
- **Déduplication des fetchs en cours** (`inFlight`) : la pré-chauffe et
  l'ouverture des suggestions partagent la même promesse.
- Cache résultats 6 h (15 min si dégradé) + cache des vues 14 j.

## Limites connues (à traiter)

1. ~~Oslo sous-classé~~ **RÉSOLU** (commit `97a8a36`) : tri sur **vues FR pures**
   → opéra/Munch/palais remontent, Ullevaal tombe #2 → #6. Voir « Tri ».
   - **Arbitrage produit (PAS un bug) — stades célèbres** : le **stade de Wembley**
     ressort #3 à Londres, au-dessus du British Museum. Vérifié : **339 499 vues FR
     sur 3 ans** (vs 178 437 pour le British Museum) — les Français consultent
     VRAIMENT Wembley (concerts, foot anglais, FA Cup). Ce n'est donc PAS une
     contamination EN ni un bug : c'est le **vrai signal FR**, cohérent avec la
     règle « tri par notoriété réelle, aucun malus » (idem Camp Nou, gardé #2).
     Limite de fond : les vues = **intérêt/recherche**, pas **priorité de visite**.
     Aucun correctif par les vues ne corrige ça (cf. ci-dessous). À trancher avec
     Adrien : accepter (honnête) ou poser un signal « fonction = sport vs culture »
     (mais ça toucherait aussi Camp Nou, que l'on veut garder haut).
   - **Multi-langues testé et ÉCARTÉ** : sommer FR+EN+ES+IT+DE+ZH **ré-injecte du
     foot** (Liga, Serie A, Bundesliga) → à Oslo le stade **remonte** #4 → #3 et
     tout se **tasse** (~290k, 4 % d'écart) = classement fragile. Le **FR pur**
     reste le meilleur séparateur stade-attraction / stade-pas-touristique.
2. **Athènes — Athéna Parthénos** (statue ANTIQUE disparue) sort comme un lieu
   (#3). Même classe de bug que La Pietà/Le Cri (œuvre-en-standalone) : passe le
   filtre « lieu » et n'a pas de P276 → édifice exploitable par la purge. À
   purger proprement (cf. Reste à faire).
3. **Latence à froid ~10-27 s** (API vues par-article + throttle). Mitigée par la
   pré-chauffe + le cache, mais **cache EN MÉMOIRE → perdu au redémarrage**
   (problème sur AlwaysData). **Fix durable = persister les vues en base.**
4. Vénus de Milo échappe à la purge « œuvre dans édifice » (sa salle n'est pas
   taguée comme bâtiment) — mineur, sans risque.

## Banc de test (vérité terrain — à coder en test auto)

Règles GLOBALES (toutes villes) : tri par vues (pas sitelinks, pas de bonus) ;
liens « Voir le lieu » → tous Google Maps ; zéro donnée inventée ; photos réelles ;
« Voir d'autres idées » accumule. NE DOIT JAMAIS sortir : œuvres en standalone,
communes voisines, rivières, chaînes, événements, supermarchés, homonymies.
DOIT garder : quartiers, grands magasins, statues extérieures.

Par ville (DOIT contenir / NE DOIT PAS / œuvres) :
- **Paris** : Eiffel, Louvre, Versailles, Notre-Dame, Arc / La Joconde-standalone,
  Seine / Louvre→Joconde, Orsay→Origine du monde.
- **Rome** : Colisée, St-Pierre, Trevi, Panthéon, Sixtine / Statut de Rome,
  conclave, La Pietà-standalone / Vatican→Création d'Adam.
- **Oslo** : palais royal, parc Vigeland, opéra, Munch, citadelle d'Akershus
  (Ullevaal bas) / Le Cri-standalone, Coupe de Norvège / Munch→Le Cri.
- **Chamonix** : mont Blanc, aiguille du Midi, Mer de Glace, **téléphérique du
  Montenvers** / Courmayeur, Doire baltée, Alpes occidentales.
- **Barcelone** : Sagrada Família, parc Güell, Casa Batlló, Casa Milà.
- **Londres** : Big Ben, Buckingham, **stade de Wembley** (légitimement haut :
  339k vues FR), tour de Londres, Tower Bridge, Westminster, British Museum, London
  Eye, **HMS Belfast** *(à faire apparaître)*.
- **Grenoble** : **fort de la Bastille**, **téléphérique (les Bulles)**, musée de
  Grenoble / Journée des Tuiles (événement).
- **Lyon** : Fourvière, place Bellecour, Vieux Lyon, musée des Beaux-Arts.
- **Athènes** : Parthénon, Érechthéion, Agora, Olympiéion (le stade
  **panathénaïque** est un MONUMENT, doit rester).

## Reste à faire

1. **Page `/banc` interactive** (idée d'Adrien) : annoter les suggestions par
   ville en mode ludique (✓ incontournable / ❌ à virer / ⭐ manquant) → remplit le
   banc automatiquement. Page isolée, zéro risque.
2. **Athéna Parthénos** (Athènes) : purger l'œuvre-en-standalone (cf. Limite 2).
3. **Persister le cache des vues** en base (fix AlwaysData, cf. Limite 3).
4. **HMS Belfast** : type « navire-musée » = lieu visitable (à ajouter au filtre).
5. **Dédoublonnage par adresse/coordonnées** (Grenoble : musée de la Résistance vs
   musée des Chasseurs alpins — distincts ? vérifier par l'adresse).
6. Coder le **banc** en test Vitest (lance le vrai code, vérifie DOIT/NE DOIT PAS).
7. (Abandonné) ~~Vues en langue locale~~ : rejeté (les locaux suivent le foot) ;
   ~~multi-langues~~ : testé, ré-injecte le foot. Le **FR pur** est la réponse.

## Commits clés de la session (branche `feat/refonte-dashboard`)

- `c3e31d2` rayon 20 km + filtre « lieu » uniforme
- `516b95a` LIMIT 500 (remplir les mégapoles)
- `04e13ba` volet « Œuvres à voir » + exclusion grandes surfaces
- `a1e90e7` œuvres en lot + bouton conditionnel
- `713b772` noms capitalisés + clic photo plein écran
- `28f5839` accordéon œuvres
- `8fb65c0` Le Cri (chefs-d'œuvre multi-versions, P527)
- `9f9feaf` tri par vues + purge parasites
- `30ca860` robustesse filtre (fail-safe, fini le fail-open)
- `a5e733d` La Joconde (sous-collection P361)
- `8586f00` vues sur 3 ANS (Big Ben #1, anti-pic sport)
- `da874ef` fiabilité + latence du tri par vues
- `88bddce` œuvres dans un édifice écartées (La Pietà)
- `06c40c5` pré-chargement arrière-plan + déduplication
- `97a8a36` tri sur vues FR pures (Oslo cohérent, stade enterré sans malus)
- `81f690f` doc : Oslo résolu + arbitrages (Wembley, Athéna Parthénos)
- `8b89329` fiabilité vues + tri 2 paliers (anti-cratering, ordre stable)

# Moteur de suggestions d'activités — mémoire de conception

> Récap complet du moteur de suggestions (sources, tri, filtres, œuvres,
> robustesse, pré-chargement) et des décisions prises. Sert de **mémoire** pour
> reprendre le travail. Le moteur est **modulaire** dans `server/services/` :
> `places.ts` (orchestrateur : fusion des sources, dédup, enrichissement, tri
> final) délègue aux sources `wikidata` · `overpass` · `wikipedia` · `wikivoyage`
> · `foursquare`, au `ranking` (vraies vues Wikipédia), aux helpers `geo` ·
> `classify` · `enrich` · `core` · `http`, et à `highlights` (œuvres à voir).
> Pré-chargement dans `server/routes/trips.ts`, UI dans
> `src/features/ItineraryTab.tsx`.

## Vue d'ensemble

Pour une destination, on assemble de **vrais lieux** à partir de sources
ouvertes, on **filtre** (que des lieux visitables), on **classe par notoriété
touristique réelle**, et on enrichit (photos, descriptions). **Zéro donnée
inventée** (jamais de note/prix/avis bidon — règle absolue).

## Sources (toutes gratuites/ouvertes)

- **Wikidata** (SPARQL `wikibase:around`) = source PRINCIPALE. Rayon **20 km**
  (capte les alentours : Versailles, Bygdøy…), **seuil ≥8 langues**, `LIMIT 500`
  (sinon mégapoles bridées car les top-sitelinks sont des non-lieux). ⚠ Le seuil
  langues est un **garde-fou de VOLUME, PAS un critère de tri** : on classe par VUES
  (cf. « Tri »). Abaissé de 14 → **8** (`e16e144`) pour faire remonter les icônes
  **RÉGIONALES** et des pays peu couverts par Wikidata, ensuite mesurées par leurs
  vraies vues : Bastille de Grenoble (8 langues), Majorelle & Koutoubia à Marrakech.
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
- **Vues FR + EN (popularité GLOBALE)** : un Français qui voyage à l'ÉTRANGER doit
  voir les lieux mondialement/localement iconiques, pas seulement ceux lus en FR
  (mémorial du 11-Septembre, musées étrangers, gratte-ciels). `fetchPopularity`
  renvoie `{ total = FR+EN, fr }`.
- ⚠ **Anti-foot** : l'EN est gonflé par le foot mondial → on garde `fr` À PART. La
  décision « garder ce stade ? » (cf. demote) se tranche sur les **vues FR PURES**
  (intérêt TOURISTIQUE), JAMAIS sur le total → un stade-foot moderne (Karaïskákis,
  OAKA) ne remonte pas via ses vues EN. **C'est ce qui rend le multi-langues SÛR.**
  *Histoire :* on était d'abord en **FR pur** (robuste, mais Oslo sous-classait
  Munch/Fram sous les stades & NYC ratait le mémorial). Le **FR+EN + demote-sur-FR**
  règle Oslo (Munch remonte 4ᵉ) sans réinjecter le foot (banc 9/9).
- Repli sitelinks si pas de vues. **Aucun bonus/malus bidouillé** (règle posée
  par Adrien : tri par notoriété pure).
- Sondé sur le **top-40 candidats**, **FR ET EN en parallèle**, **concurrence 16** +
  **cache 14 j**. Voir « Limites ».

## Filtres & purges (ce qui ne doit JAMAIS sortir en liste, et ce qui reste)

Filtre « lieu » (allow-list de super-types via P31/P279*) **découpé en lots de
100 en parallèle** (fiabilité). ⚠ L'allow-list inclut **`musée` (Q33506)** : beaucoup
de musées sont typés « institution » SANS type bâtiment → sans ça, ils échouaient le
filtre et n'arrivaient que via Wikivoyage (sans vues, donc relégués SOUS des stades
locaux). Ex. Oslo : Fram, Kon-Tiki, navires vikings, Folkemuseum. Puis purge secondaire :

| Exclu | Comment | Gardé (important !) |
|---|---|---|
| Communes **séparées** (Courmayeur) | zone habitée Q486972 **sans** être quartier Q123705/Q2983893 | Quartiers (Montmartre, Trastevere) |
| Rivières | watercourse Q355304 | — |
| Chaînes/massifs | Q46831 | Sommets individuels (aiguille du Midi) |
| Supermarchés (Carrefour) | chaîne Q507619/Q18043413 | Grands magasins (Galeries Lafayette) |
| Œuvres en standalone (Le Cri, La Pietà) | groupe-de-peintures Q18573970 + page d'homonymie Q4167410 en bad-types ; **œuvre (sculpture/peinture) DANS un édifice** (P276 → musée/église/palais) en purge | Statues **extérieures** (Manneken-Pis, Statue de la Liberté) |
| Œuvres **disparues/détruites** (Athéna Parthénos, Promachos, Lemnia) | **« œuvre d'art perdue » Q4140840** (P31/P279*) en purge — l'original n'existe plus, mais reste géotaggé sur l'Acropole et bien classé (sitelinks ≥17) | Statues **extérieures existantes** (Liberté, Manneken-Pis) ; **sites archéologiques** (Agora, Aréopage) — aucun n'est une « œuvre perdue » |
| Événements / émeutes (conclave, **Journée des Tuiles**) | bad-types (émeute Q124757) + NOISE_BLOCK ; **+ la source de secours Wikipédia est filtrée par le VRAI filtre lieu** (résolution du Q-id de chaque article → place-filter, `e16e144`) : la regex seule ratait ces non-lieux (émeute, académie, institution) | — |
| Bateaux-objets (Fram) | exclus du filtre lieu | Bateaux-LIEUX (HMS Belfast) — *à ajouter, cf. Reste à faire* |
| Gares-transit UTILITAIRES (Saint-Charles, aéroports, Penn Station) — **RÉTROGRADÉES, pas supprimées** | transport P31/P279* (gare Q55488, métro Q928830, gare routière Q494829, aéroport Q1248784) SANS le tag **« site touristique » Q570116 en P31 DIRECT** → drapeau `demote` → tout en bas du tri (`wikidataClassifyDemote`). Règle GÉNÉRALE & MONDIALE, langue-agnostique | **Gares-MONUMENTS** marquées site touristique (Grand Central) |
| Stades 2ᵉ rang / locaux **+ RÉGIONAUX** (Lluís-Companys, Emirates, Ullevaal, Chaban-Delmas, Old Trafford…) — **RÉTROGRADÉS** | enceinte sportive P31/P279* (stade Q483110 / sports venue Q1076486 / arène Q641226) NON « site touristique » : on ne garde que **LE stade le plus consulté de la ville** ET **≥ `STADIUM_VIEWS_MIN` = 250k vues FR** (`dc1cb78`, relevé de 100k). Un seuil ABSOLU seul échoue (Lluís-Companys 307k n'est pas le top de Barcelone) → règle « **top de la ville ET plancher** ». Le plancher 250k ne laisse que les stades **MONDIAUX** ; les régionaux tombent (Chaban-Delmas 166k → plus #1 à Bordeaux, Old Trafford 122k, Anfield 127k, Matmut 152k) | **LE stade MONDIALEMENT iconique** (Camp Nou 513k, Wembley 339k, Vélodrome 520k, Stade de France) ; **panathénaïque** (antique, via tag « site touristique ») ; **TREMPLINS de saut à ski** (Q1109069, exemptés `bf6588c`) — Holmenkollen = belvédère + musée du ski, pas une enceinte de compétition → revient #10 à Oslo |
| **Quartiers** résidentiels en EXCÈS (Broadway, Greenwich Village, Upper West Side…) — **RÉTROGRADÉS** | quartier Q123705/Q2983893 (P31/P279*) → drapeau `demote` (`wikidataClassifyDemote`, branche `hoods`), SAUF « site touristique » DIRECT (Times Square) ou plage Q40080 (Coney Island). Évite que les ZONES noient les SITES précis | **Quartiers-destinations** (Times Square, Coney Island ; Montmartre/Trastevere restent par leurs vues) |
| **Infra / labo** non-touristique (digue **MOSE**, institut de recherche **IRAM**) — **RÉTROGRADÉS** | branche `infra` (`4640b82`) : flood barrier Q24853940 / institut de recherche Q31855 (P31/P279*), SAUF musée Q33506 ou « site touristique » Q570116. ⚠ PAS « port maritime » Q15310171 (même type que le **Vieux-Port** touristique → aucun signal propre, on laisse) | Un institut/musée qui se VISITE (épargné par le garde-fou) ; le Vieux-Port |

> **Dédup « même article »** (`eef49e9`, dans `places.ts` après le tri) : deux entrées
> aux **vues IDENTIQUES non nulles** et à **< 200 m** sont le MÊME lieu sous deux noms —
> translittération (« Jemaa el-Fna » / « Place Jamaâ el-fna »), synonyme (« Olympiéion » /
> « Temple de Zeus ») — qui tirent leurs vues du MÊME article Wikipédia, d'où l'égalité
> EXACTE (deux lieux DISTINCTS n'ont jamais exactement les mêmes vues sur 3 ans). On garde
> la 1ʳᵉ (tri stable). Rattrape ce que la dédup par nom/token laisse passer (cf. plus bas).

> **Filtre « lieu » du TOP-UP des vues** (`b5667e5`, dans `ranking.ts`) : un titre NU de
> Wikivoyage/OSM peut être l'homonyme d'un sujet ultra-consulté et lui VOLER ses vues
> (« Monsanto » le parc de Lisbonne → les 1,7M vues de l'**ENTREPRISE** Monsanto → sortait
> #1 !). `fetchTitleViews` résout le **Q-id** de chaque titre et IGNORE ses vues si l'entité
> est un NON-lieu CONFIRMÉ (même `wikidataPlaceFilter` que la source Wikidata → cohérent ;
> un musée, lieu ET organisation, reste un lieu). Fail-open : filtre HS → rien rejeté ;
> titre sans Q-id → gardé. La tour de Belém reprend #1, le vrai parc reste #32 (vraies vues).

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
  *(Un **palier 0** s'ajoute en tête : les gares-transit `demote` tout en bas, cf.
  « Filtres & purges ».)*
- **Récup des vues fiabilisée** : réessais avec **back-off** (l'API REST throttle
  vite en rafale), un échec = `null` (**≠ « 0 vue »**, non mis en cache),
  **concurrence 6** (＞ fiable que 16). **FR et EN sondés en PARALLÈLE** (popularité
  GLOBALE = FR+EN) ; le **cache 14 j** + la pré-chauffe absorbent le surcoût d'appels.
- **Purge « œuvre perdue » ISOLÉE** : la purge des œuvres disparues (Q4140840,
  Athéna Parthénos…) tourne en **requête SÉPARÉE, en parallèle** de la purge lourde
  (rivières/communes/œuvre-dans-édifice). Un seul `P31/P279*` → réponse <1 s, donc
  elle **aboutit même quand la requête lourde expire** (Wikidata sous charge) :
  cette purge ciblée n'est jamais l'otage de la latence des autres branches. Les
  deux sont fail-safe indépendamment (échec de l'une ⇒ on ne purge pas sa part).

## Pré-chargement + cache (latence invisible)

- **Pré-chauffe en arrière-plan** dès qu'une destination est choisie (création de
  voyage `POST /trips` ou sélection `PATCH /trips/:id`) → `warmSuggestions()`
  fire-and-forget. Quand l'user ouvre Suggestions, c'est chaud → quasi instantané.
- **Déduplication des fetchs en cours** (`inFlight`) : la pré-chauffe et
  l'ouverture des suggestions partagent la même promesse.
- Cache résultats 6 h (15 min si dégradé) + **cache des vues PERSISTANT sur disque**
  (`data/.cache/pv.json`, `caa3899`) : écriture **atomique** (tmp + rename), survit aux
  **redémarrages** → un vivier large reste rapide. Flush propre à l'arrêt (cf. « DB
  sécurisée »). En prod avec DB distante, le chemin fichier est désactivé (cache mémoire).

## Limites connues (à traiter)

1. ~~Oslo sous-classé~~ **RÉSOLU** : (a) tri sur **vues réelles FR+EN**, décision
   stade tranchée sur **FR pur** (`b9c8b82`) → opéra/Munch/palais remontent (Munch 4ᵉ)
   SANS réinjecter le foot ; (b) **musées réintégrés** (Q33506 dans l'allow-list)
   + **stades locaux rétrogradés** (`27467f2`) → Ullevaal/Bislett/Holmenkollbakken
   partent, musées du Fram/navires vikings remontent. Voir « Tri » & « Filtres ».
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
   - **Multi-langues (FR+EN) ADOPTÉ** (`b9c8b82`) : un Français à l'ÉTRANGER doit voir
     les lieux mondialement/localement iconiques (mémorial du 11-Septembre, musées
     étrangers, gratte-ciels) mal lus en FR. La somme FR+EN les remonte. **L'anti-foot
     tient** parce que la décision « garder ce stade ? » reste sur le **FR pur** (cf.
     « Tri ») : l'EN gonflé par le foot ne sert qu'à classer, jamais à *garder* un stade.
     ⚠ Garde-fou écarté **avant** ce design : sommer 6 langues (FR+EN+ES+IT+DE+ZH) SANS
     la séparation stade-sur-FR ré-injectait le foot (Oslo #4→#3, écart 4 %). La clé
     n'est donc pas « peu de langues » mais **trancher les stades sur le FR**.
2. ~~**Athènes — Athéna Parthénos**~~ **RÉSOLU** : la statue de Phidias (Q2070605,
   détruite dans l'Antiquité) sortait #3. Elle passe le filtre « lieu » car *statue
   colossale* → *statue* → *structure architecturale* (Q811979) ; et son P276 =
   Parthénon (un **temple**, hors allow-list édifices) la faisait échapper à la purge
   « œuvre dans édifice ». Fix : **purge dédiée P31/P279* → « œuvre d'art perdue »
   (Q4140840)** — vire aussi Athéna Promachos (Q755221) & Lemnia (Q950701), mêmes
   colosses perdus, **sans toucher** statues existantes ni sites archéologiques
   (vérifié : aucun n'est sous-classe de Q4140840). Voir « Filtres & purges ».
3. ~~**Latence à froid + cache perdu au redémarrage**~~ **RÉSOLU** (`caa3899`) : le cache
   des vues est désormais **PERSISTANT** (`data/.cache/pv.json`, écriture atomique tmp +
   rename, flush à l'arrêt propre). Survit aux redémarrages → pré-chauffe + ce cache
   absorbent la latence à froid, ce qui a aussi permis d'**élargir le vivier** (cf. point 8
   : le mémorial du 11-Septembre remonte). *(En prod AlwaysData, cache fichier désactivé si
   DB distante ; un cache en base serait l'étape suivante si besoin.)*
4. Vénus de Milo échappe à la purge « œuvre dans édifice » (sa salle n'est pas
   taguée comme bâtiment) — mineur, sans risque.
5. **Lieux « célèbres mais pas une sortie » — arbitrage ASSUMÉ (pas un bug)** : certains
   lieux très consultés ne sont pas des visites idéales — prison (Rikers), île abandonnée
   (Poveglia), stade lointain (MetLife, New Jersey), port de COMMERCE, domaines viticoles
   (Romanée-Conti, Pessac-Léognan). Ils montent par leur **vraie notoriété** (vues). On a
   démoté ceux qui ont un **type propre** non-touristique (infra/labo — digue, institut ;
   cf. Filtres) ; les autres sont **GARDÉS par CHOIX** car **aucun type ne les isole sans
   casser des légitimes** : filtrer « prison » tue Alcatraz, « île » tue Burano, « domaine
   viticole » tue l'œnotourisme, « port maritime » tue le Vieux-Port (même type Q15310171
   que le port de commerce). **Principe : corriger par TYPE / seuil / vues, JAMAIS par
   nom ; les `notContain` du banc sont des fils-pièges anti-régression, pas la logique.**

## Banc de test (vérité terrain) — **CODÉ** ✅

Implémenté dans **`server/services/places.bench.test.ts`** : appelle le VRAI moteur
en ligne par ville et vérifie DOIT / NE DOIT PAS (top 15). **Exclu de la CI** (réseau
= flaky) ; à lancer À LA MAIN avant tout changement du moteur :
`RUN_BENCH=1 npx vitest run server/services/places.bench.test.ts` (PowerShell :
`$env:RUN_BENCH=1; npx vitest run …`). **15 villes** couvertes (Rome, Oslo, Barcelone,
Londres, Athènes, Marseille, Paris, Chamonix, Viviers, New York, Grenoble, Marrakech,
Bordeaux, Dijon, Venise) — tailles & pays VARIÉS. Assertions `contain`/`notContain`
(top 15) **+ `containAll`/`notContainAll`** (liste ENTIÈRE, invariants plus stricts).
⚠ **Throttle-flaky** : 1-2 villes peuvent FAUX-échouer en rafale (API vues saturée, une
icône retombe à 0 vue) → re-lancer la ville seule au calme (`-t Ville`, vues en cache)
confirme. Un run propre = **15/15**.

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
- **Grenoble** (petite ville FR, valide le **seuil ≥8**) : **la Bastille** (8 langues,
  remonte), musée de Grenoble, téléphérique / **Journée des Tuiles** (émeute) & **Académie**
  (non-lieux de la source Wikipédia, désormais filtrés par le filtre lieu) ; **IRAM**
  (institut de recherche → infra-démote).
- **Lyon** : Fourvière, place Bellecour, Vieux Lyon, musée des Beaux-Arts.
- **Marseille** : **stade Vélodrome** (icône, GARDÉ #1), Bonne Mère, château d'If,
  Calanques, Vieux-Port / **Marseille-Saint-Charles & Aix-TGV** (gares-transit →
  RÉTROGRADÉES, hors page 1).
- **New York** : Liberté, Empire State, **World Trade Center**, Central Park ; **mémorial
  du 11-Septembre** présent (vivier élargi + cache, cf. Limite 3/8) / **Penn Station,
  aéroports LaGuardia & Newark** (transit → rétrogradés) ; **Broadway, Greenwich Village**
  (quartiers → rétrogradés) ; **Jersey City, Hoboken, Hudson, East River** (zones larges →
  purgées, liste ENTIÈRE) ; **Grand Central GARDÉ** (gare-monument « site touristique »).
- **Athènes** : Parthénon, Acropole, Érechthéion, Agora, Aréopage, Olympiéion (le
  stade **panathénaïque** est un MONUMENT, doit rester ; **« Temple de Zeus » = doublon
  d'Olympiéion → dédupliqué**) / **Athéna Parthénos, Promachos, Lemnia** (statues
  antiques DÉTRUITES = « œuvre d'art perdue », ne doivent PAS sortir).
- **Marrakech** (Maroc, pays peu couvert) : **Majorelle, Koutoubia, Jemaa el-Fna** mesurés
  par leurs VRAIES vues (jadis Koutoubia 1 vue, coupée par le seuil 14) ; le doublon
  « Place Jamaâ el-fna » est dédupliqué.
- **Bordeaux** : cathédrale Saint-André, place de la Bourse, **Cité du Vin** / **stade
  Chaban-Delmas** (régional 166k < 250k → rétrogradé, n'est plus #1).
- **Dijon** : **palais des ducs de Bourgogne**, musée des Beaux-Arts.
- **Venise** : Saint-Marc, palais des Doges, Rialto / **MOSE** (digue → infra-démote ;
  **Poveglia GARDÉ** = notoriété réelle, aucun type « interdit » → arbitrage assumé).

## Reste à faire

1. **Page `/banc` interactive** (idée d'Adrien) : annoter les suggestions par
   ville en mode ludique (✓ incontournable / ❌ à virer / ⭐ manquant) → remplit le
   banc automatiquement. Page isolée, zéro risque.
2. ~~**Athéna Parthénos** (Athènes)~~ **FAIT** : purge « œuvre d'art perdue »
   Q4140840 (cf. Limite 2 & « Filtres & purges »).
3. ~~**Persister le cache des vues**~~ **FAIT** (`caa3899`) : cache fichier persistant
   `data/.cache/pv.json` (écriture atomique, cf. Limite 3). *(En base = étape ultérieure
   pour AlwaysData si la latence à froid redevient un souci.)*
4. **HMS Belfast** : type « navire-musée » = lieu visitable (à ajouter au filtre).
5. ~~Dédoublonnage~~ **FAIT** : (a) suffixe destination retiré avec la VILLE seule
   (dest « Ville, Pays ») ; (b) dédup floue par NOM — préfixe de type
   (« basilique X »=« X »), suffixe transport (« Grand Central »=« … Terminal »),
   qualificatif (« … de l'Isère ») ; (c) dédup par **COORDONNÉES** (< 110 m + mot
   commun, « regarder les adresses ») pour les noms vraiment différents (« Musée
   Solomon-R.-Guggenheim »=« Musée Guggenheim »). Helpers `dedupKey`/`isNearDup`/
   `distanceMeters`/`shareToken` **testés** ; jamais de fusion à tort (Saint-Pierre
   vs …-aux-Liens préservés). **(d) dédup « même article »** (`eef49e9`) : vues IDENTIQUES
   non nulles + < 200 m = même lieu (translittération/synonyme : Jemaa/Jamaâ,
   Olympiéion/Temple de Zeus) → rattrape ce que (b)/(c) ratent (aucun token commun).
8. ~~**Lieux majeurs sans vues, coulés**~~ **FAIT** : les vues n'étaient prises que
   pour le top-40 Wikidata (sitelinks) + jamais Wikivoyage → Rockefeller, MET, MoMA
   sans vues, sous du bruit. `fetchTitleViews` (ranking) complète par TITRE pour tous
   les candidats → notoriété réelle (Rockefeller 47ᵉ→20ᵉ, MET 42ᵉ→9ᵉ).
9. ~~**Villes mono-thème tronquées**~~ **FAIT** : le plafond /catégorie (20) coupait
   NYC (57 « Visite ») à ~28. `curate` en 2 passages (variété en tête PUIS comble
   jusqu'à 50). Testé déterministiquement (top 20 inchangé → banc intact).
10. ~~**Œuvres : MoMA vide + auto-référence**~~ **FAIT** : match `rdfs:label|skos:altLabel`
   (« MoMA » = alias de « Museum of Modern Art ») → ses chefs-d'œuvre remontent (Van
   Gogh, Dalí…) ; une œuvre dont le nom == le lieu est exclue (Statue de la Liberté).
6. ~~Coder le **banc** en test Vitest~~ **FAIT** (`places.bench.test.ts`, `RUN_BENCH=1`).
7. **Gares-monuments SANS le tag « site touristique »** (ex. St-Pancras Grade I,
   Gare de Lyon) : actuellement RÉTROGRADÉES à tort (soft, jamais supprimées). Les
   remonter via un patrimoine FORT, sans réintroduire le piège de l'« Inventaire
   général » (Q16739336, fourre-tout de 21k entités) ni de logique franco-centrée.
11. ~~**Multi-langues (FR+EN)**~~ **FAIT** (`b9c8b82`) : popularité GLOBALE = vues FR+EN
   (lieux iconiques à l'étranger : mémorial du 11-Septembre, musées/gratte-ciels mal lus
   en FR). L'anti-foot tient car la décision stade reste sur le **FR pur**. *Reste* :
   ~~vues en langue LOCALE~~ écartées (les locaux suivent le foot → ré-injection) — le
   FR+EN-avec-stade-sur-FR couvre déjà Oslo/Athènes sans ce risque.
8. ~~**Mémorial du 11-Septembre (NYC) absent**~~ **RÉSOLU** (`217e388`) : c'était un
   problème de SÉLECTION (vivier `out` plafonné ~55 AVANT le tri par vues → le musée
   [34 sitelinks] coupé). Le **cache persistant** (point 3) a permis d'**élargir le vivier**
   sans exploser la latence → le mémorial est mesuré par ses vraies vues FR+EN et remonte.
   Idem les bâtiments RÉCENTS peu multilingues (High Line, One Vanderbilt, supertalls).

## Commits clés (branche `feat/refonte-dashboard`, puis `main`)

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
- `f454888` doc : robustesse 2 paliers + Wembley clarifié (pas un bug)
- `f94e2ab` purge « œuvre perdue » Q4140840 (Athéna Parthénos) + gares-transit
  rétrogradées (Saint-Charles↓, Grand Central gardé)
- `27467f2` musées réintégrés (Q33506 dans l'allow-list) + 1ère version du filtre stades
- `74fee8d` stades : on ne garde que LE plus consulté de la ville (Camp Nou seul à
  Barcelone, Wembley seul à Londres…) — règle « top ville + plancher », pas un seuil
- *(banc)* `places.bench.test.ts` : armure anti-régression (8 villes, `RUN_BENCH=1`)
- `91d1f30` plafond des sommets (Chamonix : le train du Montenvers remonte #35→#10)
- `c339730` dédup floue « nom + qualificatif de région » (doublon musée Grenoble)
- `b9c8b82` popularité GLOBALE (vues FR+EN) + décision stade sur vues FR (Oslo : Munch
  remonte 4ᵉ, NYC mieux couvert, foot toujours enterré — banc 9/9)

**Session suivante (sur `main`) :**
- `caa3899` **cache des vues PERSISTANT** (`data/.cache/pv.json`, écriture atomique) → un
  vivier large reste rapide même après redémarrage
- `217e388` **vivier élargi** → les lieux RÉCENTS / peu multilingues remontent (High Line,
  One Vanderbilt, supertalls, **mémorial du 11-Septembre**) — possible grâce au cache
- `37e80f2` **DB sécurisée** : sauvegarde auto au démarrage (rotation 8) + arrêt PROPRE
  (SIGTERM/SIGINT → flush du cache vues + fermeture PGlite) — fini la corruption au kill
- `e16e144` **seuil langues ≥8** (icônes RÉGIONALES : Bastille de Grenoble, Marrakech) +
  source de secours Wikipédia **filtrée par le VRAI filtre lieu** (émeute « Journée des
  Tuiles », académie → bannies STRUCTURELLEMENT)
- `dc1cb78` **stade : plancher vues FR 100k → 250k** — seuls les stades MONDIAUX restent
  (Chaban-Delmas régional n'est plus #1 à Bordeaux)
- `b6e98c6` **banc → 15 villes** (+ Grenoble, Marrakech, Bordeaux, Dijon, Venise ; tailles
  & pays variés)
- `eef49e9` **dédup « même article »** (vues IDENTIQUES + < 200 m → doublons
  translittération/synonyme virés : Jemaa/Jamaâ, Olympiéion/Temple de Zeus)
- `4640b82` **démote infra/labo** (branche `infra` : digue MOSE Q24853940 + institut de
  recherche IRAM Q31855 ; garde-fous musée/tourisme ; port de commerce NON visé)
- `bf6588c` **tremplins de saut à ski exemptés** du démote sportif (Q1109069) → Holmenkollen
  (belvédère + musée du ski) revient #10 à Oslo, n'est plus traité comme un stade de foot
- `b5667e5` **place-filtre le top-up des vues** (`fetchTitleViews`) : un titre-homonyme ne
  vole plus les vues d'un sujet célèbre (« Monsanto » le parc ≠ l'entreprise) → la tour de
  Belém reprend #1 à Lisbonne

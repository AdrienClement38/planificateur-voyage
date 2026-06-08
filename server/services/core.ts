/**
 * Cœur partagé du moteur de suggestions — le CONTRAT COMMUN dont dépendent toutes
 * les sources (OSM, Wikidata, Wikivoyage, Foursquare…), le classement et
 * l'orchestrateur. Isolé ici pour que chaque module dépende d'un petit noyau
 * stable plutôt que du « god-file » entier :
 *  - `Cat` : catégorie fermée d'une activité (palette affichée côté front).
 *  - `PlaceActivity` : la forme RÉELLE et factuelle produite par chaque source —
 *    jamais d'invention ; les champs optionnels restent absents quand la source
 *    ne les fournit pas.
 *  - `mapsLink` : lien « Voir le lieu » uniforme (fiche Google Maps).
 */

export type Cat =
  | "Visite"
  | "Gastronomie"
  | "Culture"
  | "Loisir"
  | "Nature"
  | "Shopping"
  | "Bien-être";

export interface PlaceActivity {
  name: string;
  description: string;
  category: Cat;
  duration: string;
  /** Lien « Voir le lieu » : fiche Google Maps du lieu (uniforme, toutes sources). */
  bookingUrl: string;
  /** Source réelle : "OpenStreetMap" | "Wikivoyage" | "Wikipédia" | "Foursquare". */
  provider: string;
  /** Prix RÉEL en €, sinon undefined — jamais inventé. */
  cost?: number;
  /** Note RÉELLE, sinon undefined — jamais inventée. */
  rating?: number;
  reviewsCount?: number;
  /** Photo RÉELLE, sinon undefined. */
  imageUrl?: string;
  /** Indice interne : titre d'article Wikipédia (FR) pour retrouver photo/intro. */
  wikiTitle?: string;
  /** Notoriété interne : nombre de versions linguistiques Wikipédia (classement). */
  fame?: number;
  /**
   * Vraies vues Wikipédia (FR) si on a pu les récupérer, sinon undefined. C'est le
   * signal de notoriété de PREMIER RANG. On le garde DISTINCT de `fame` pour ne
   * jamais comparer une échelle « vues » (~10³-10⁵) à une échelle « liens » (~10²) :
   * au tri final, les lieux AVEC vues passent tous devant (triés par vues), les
   * autres suivent (triés par `fame`). Évite qu'un lieu majeur dont la récup de vues
   * échoue (throttle) ne plonge sous un lieu mineur — classement stable & cohérent.
   */
  views?: number;
  /**
   * Lieu de transit UTILITAIRE (gare/métro/aéroport non touristique, ex. Marseille-
   * Saint-Charles) : énormément consulté par les voyageurs mais sans intérêt touristique.
   * On NE le supprime PAS (jamais de perte sèche d'une gare-monument) mais on le
   * RÉTROGRADE tout en bas du classement (cf. tri final). Les gares-MONUMENTS marquées
   * « site touristique » (Grand Central) ne portent PAS ce drapeau → restent en haut.
   */
  demote?: boolean;
}

/** Lien « Voir le lieu » : TOUJOURS une fiche Google Maps (uniforme, toutes sources). */
export function mapsLink(name: string, dest: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${dest}`)}`;
}

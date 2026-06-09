/**
 * Plafonne un cache mémoire (Map à TTL) pour une empreinte BORNÉE dans le temps :
 * au-delà de `max` entrées, on évince les plus ANCIENNES (l'ordre d'insertion de
 * Map = FIFO). Indispensable sur un process qui tourne des semaines (AlwaysData) :
 * sans plafond, un cache à long TTL (ex. vues Wikipédia, 14 j) croît sans fin. Ne
 * change RIEN à la sémantique TTL — juste un toit mémoire prévisible. À appeler
 * juste après chaque `.set()`.
 */
export function capMap<K, V>(map: Map<K, V>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

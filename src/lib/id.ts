/**
 * Génère un identifiant unique.
 *
 * Remplace les anciens `"prefix-" + Date.now()` qui pouvaient entrer en
 * collision si deux entités étaient créées dans la même milliseconde.
 * `crypto.randomUUID()` est natif (navigateurs modernes + Node 19+).
 */
export function uid(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : // Repli ultra-rare (environnements sans WebCrypto) : suffisamment unique.
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${uuid}` : uuid;
}

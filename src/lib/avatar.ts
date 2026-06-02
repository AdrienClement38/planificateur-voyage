/**
 * Renvoie l'URL d'avatar d'un membre, ou un avatar généré déterministe à partir
 * de son nom si aucun n'est défini. Évite les `<img src="">` (avertissement React
 * + requête réseau inutile).
 */
export function avatarUrl(name: string, avatar?: string | null): string {
  if (avatar && avatar.trim()) return avatar;
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name || "user")}`;
}

/**
 * Outils purs de planification horaire des étapes du programme.
 *
 * Les activités suggérées portent une durée en texte libre ("2h", "1h30",
 * "90 min", "1 journée", "2h – 3h"…). On la convertit en minutes pour calculer
 * automatiquement une heure de fin à partir d'une heure de début. Si la durée
 * est inconnue, on retombe sur 1h (signalé comme « estimé » pour que
 * l'utilisateur vérifie).
 */

/** Convertit une durée libre en minutes. `null` si rien d'exploitable. */
export function parseDurationToMinutes(duration?: string | null): number | null {
  if (!duration) return null;
  const s = duration.toLowerCase();

  // Journée / demi-journée ("journée" ou "journee", avec ou sans accent).
  if (/demi[-\s]?journ[ée]e/.test(s)) return 240;
  if (/journ[ée]e|full[-\s]?day/.test(s)) return 480;

  // "1h30", "2 h", "2 heures", "1h30min" — première valeur d'une éventuelle
  // plage ("2h - 3h" → 2h).
  const hm = s.match(/(\d+)\s*h(?:eures?|rs?)?\s*(\d{1,2})?/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }

  // "90 min", "45 minutes", "30 mn".
  const mm = s.match(/(\d+)\s*(?:min(?:utes?)?|mn)\b/);
  if (mm) {
    const total = parseInt(mm[1], 10);
    return total > 0 ? total : null;
  }

  return null;
}

/** Vrai si l'heure est au format "HH:MM" valide (00:00–23:59). */
export function isValidTime(time: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
}

/** Ajoute des minutes à "HH:MM", borné à 23:59 (pas de passage au lendemain). */
export function addMinutesToTime(time: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return time;
  let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + minutes;
  total = Math.max(0, Math.min(23 * 60 + 59, total));
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface ComputedEnd {
  /** Heure de fin "HH:MM". */
  endTime: string;
  /** Vrai si la durée était inconnue (fin = +1h par défaut, à vérifier). */
  estimated: boolean;
  /** Durée retenue, en minutes. */
  minutes: number;
}

/**
 * Calcule l'heure de fin d'une étape à partir de son heure de début et de la
 * durée de l'activité. Durée inconnue → +1h, marqué `estimated`.
 */
export function computeEndTime(startTime: string, duration?: string | null): ComputedEnd {
  const parsed = parseDurationToMinutes(duration);
  const minutes = parsed ?? 60;
  return {
    endTime: addMinutesToTime(startTime, minutes),
    estimated: parsed === null,
    minutes,
  };
}

/** Minutes depuis minuit pour "HH:MM", ou null si invalide. */
function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Vrai si deux créneaux [début, fin) se chevauchent. Une fin absente est
 * traitée comme un instant (= début). Les créneaux adjacents (11:00–12:00 puis
 * 12:00–13:00) ne se chevauchent PAS.
 */
export function slotsOverlap(
  aStart: string,
  aEnd: string | undefined,
  bStart: string,
  bEnd: string | undefined,
): boolean {
  const s1 = toMinutes(aStart);
  const s2 = toMinutes(bStart);
  if (s1 === null || s2 === null) return false;
  const e1 = toMinutes(aEnd ?? aStart) ?? s1;
  const e2 = toMinutes(bEnd ?? bStart) ?? s2;
  return s1 < e2 && s2 < e1;
}

export interface SlotLike {
  id: string;
  time: string;
  endTime?: string;
  description?: string;
}

/**
 * Renvoie la première étape d'un jour en conflit avec le créneau [start, end),
 * ou null si le créneau est libre. `excludeId` permet d'ignorer l'étape en
 * cours d'édition.
 */
export function findConflictingEvent(
  events: SlotLike[],
  start: string,
  end: string | undefined,
  excludeId?: string,
): SlotLike | null {
  for (const ev of events) {
    if (excludeId && ev.id === excludeId) continue;
    if (slotsOverlap(start, end, ev.time, ev.endTime)) return ev;
  }
  return null;
}

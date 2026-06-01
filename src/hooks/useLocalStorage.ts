import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ZodType } from "zod";

/**
 * État React synchronisé avec le `localStorage`, avec validation optionnelle.
 *
 * Remplace les trois blocs `getItem` + `try/catch` dupliqués dans `App.tsx`.
 *
 * Robustesse :
 * - si la lecture/le `JSON.parse` échoue → on retombe sur `defaultValue` ;
 * - si un `schema` Zod est fourni et que les données stockées ne le respectent
 *   pas (forme obsolète, stockage corrompu) → on journalise et on retombe sur
 *   `defaultValue` au lieu de propager des données invalides dans l'app ;
 * - les erreurs d'écriture (quota dépassé, mode privé) sont journalisées sans
 *   faire planter le rendu.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  schema?: ZodType<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    readStored(key, defaultValue, schema),
  );

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[useLocalStorage] échec d'écriture pour "${key}"`, e);
    }
  }, [key, value]);

  return [value, setValue];
}

function readStored<T>(
  key: string,
  defaultValue: T,
  schema?: ZodType<T>,
): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return defaultValue;
  }
  if (raw == null) return defaultValue;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`[useLocalStorage] JSON invalide pour "${key}"`, e);
    return defaultValue;
  }

  if (!schema) return parsed as T;

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(
      `[useLocalStorage] données invalides pour "${key}", retour aux valeurs par défaut`,
      result.error.issues,
    );
    return defaultValue;
  }
  return result.data;
}

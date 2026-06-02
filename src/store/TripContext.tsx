import { createContext, useContext } from "react";
import type { TripStore } from "./useTripController";

// Types réexportés pour les composants (évite des imports croisés).
export type {
  TripStore,
  BudgetType,
  ActivePage,
  ActiveTab,
  ActivityFilter,
  AuthStatus,
} from "./useTripController";

export const TripContext = createContext<TripStore | null>(null);

/** Accès typé au store applicatif. Lève une erreur si hors provider. */
export function useTripStore(): TripStore {
  const ctx = useContext(TripContext);
  if (!ctx) {
    throw new Error(
      "useTripStore doit être utilisé à l'intérieur de <TripContext.Provider>.",
    );
  }
  return ctx;
}

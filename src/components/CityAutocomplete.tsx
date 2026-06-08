import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { suggestCities, type CitySuggestion } from "../lib/api";

interface CityAutocompleteProps {
  /** Valeur contrôlée du champ (texte libre tant qu'aucune ville n'est choisie). */
  value: string;
  /** Appelé à chaque frappe ET à la sélection (avec le `label` de la ville). */
  onChange: (value: string) => void;
  /** Appelé en plus à la sélection d'une ville réelle (porte lat/lon, pays…). */
  onSelect?: (city: CitySuggestion) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  /** Classe du `<input>` — pour coller au style propre à chaque écran. */
  inputClassName?: string;
  /** Classe du conteneur positionné (qui porte le dropdown absolu). */
  className?: string;
}

/** Drapeau emoji depuis un code pays ISO 3166-1 alpha-2 (ex. « ES » → 🇪🇸). */
function flagEmoji(code?: string): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * Champ de saisie de ville avec autocomplétion (combobox accessible) — à la
 * Booking/Google : on propose des villes RÉELLES (OSM via Photon) et on
 * privilégie une sélection dans la liste, ce qui garantit une destination propre
 * et géocodable pour le moteur de suggestions. La saisie libre reste possible en
 * repli (si l'API est injoignable ou la ville absente).
 *
 * - Débounce 250 ms, requête annulée à chaque frappe (AbortController).
 * - Navigation clavier complète (↑/↓ pour parcourir, Entrée pour choisir, Échap
 *   pour fermer) et `aria-combobox` / `aria-activedescendant` pour l'a11y.
 * - Entrée NE sélectionne que si une option est surlignée ; sinon elle laisse le
 *   formulaire se soumettre normalement (repli texte libre).
 */
export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  id,
  inputClassName,
  className,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  // Mémorise la dernière valeur CHOISIE dans la liste : on ne relance pas de
  // recherche dessus (sinon le dropdown se rouvrirait juste après la sélection).
  // Initialisé à `value` pour qu'un champ pré-rempli ne s'ouvre pas au montage.
  const justPickedRef = useRef<string | null>(value || null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Débounce + fetch annulable, relancé à chaque changement de `value`.
  useEffect(() => {
    const q = value.trim();
    if (justPickedRef.current === value) return; // valeur tout juste choisie
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const items = await suggestCities(q, ctrl.signal);
      if (ctrl.signal.aborted) return; // frappe plus récente : on jette ce résultat
      setSuggestions(items);
      setActiveIndex(-1);
      setOpen(items.length > 0);
      setLoading(false);
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Fermeture au clic en dehors du composant.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pick = (city: CitySuggestion) => {
    justPickedRef.current = city.label;
    onChange(city.label);
    onSelect?.(city);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case "Enter":
        // On ne capture Entrée QUE si une option est surlignée — sinon on laisse
        // le formulaire se soumettre (repli : proposition en texte libre).
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          pick(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          justPickedRef.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0 && justPickedRef.current !== value)
            setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />

      {loading && (
        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto py-1"
        >
          {suggestions.map((city, i) => (
            <li
              key={`${city.label}-${i}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown (et non click) : se déclenche AVANT le blur de l'input,
              // donc la fermeture au blur n'annule pas la sélection.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(city);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${
                i === activeIndex ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="text-base leading-none shrink-0 w-5 text-center">
                {flagEmoji(city.countryCode) || (
                  <MapPin className="w-4 h-4 text-slate-300 inline" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 truncate">
                  {city.name}
                  {city.country && (
                    <span className="text-slate-400 font-normal">
                      , {city.country}
                    </span>
                  )}
                </span>
                {city.region && (
                  <span className="block text-[11px] text-slate-400 truncate">
                    {city.region}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

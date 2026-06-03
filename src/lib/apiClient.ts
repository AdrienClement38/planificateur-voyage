import type { Trip } from "../types";
import { apiUrl } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
}

export interface TripSummary {
  id: string;
  name: string;
  description: string;
  selectedDestination: string;
  targetDays: number;
  budgetType: string;
}

/** Activité « graine » envoyée à l'API (sans id ni votes — gérés côté serveur). */
export interface ActivityInput {
  name: string;
  description?: string;
  cost?: number;
  category?: string;
  proposedBy?: string;
  source?: string;
  rating?: number;
  reviewsCount?: number;
  duration?: string;
  bookingUrl?: string;
}

/** Erreur d'API portant le code HTTP (0 = réseau injoignable). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
  }
}

// En mobile (Capacitor), l'API est cross-origin : le cookie httpOnly n'est pas
// envoyé → on utilise un jeton Bearer stocké localement. En web (même origine,
// VITE_API_BASE_URL vide), on reste sur le cookie httpOnly (plus sûr).
const USE_BEARER = Boolean(import.meta.env.VITE_API_BASE_URL);
const TOKEN_KEY = "cotripper_token";

function getToken(): string | null {
  return USE_BEARER ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setAuthToken(token: string | null): void {
  if (!USE_BEARER) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options?.headers ?? {}),
      },
      ...options,
    });
  } catch (cause) {
    throw new ApiError("Impossible de joindre le serveur.", 0, { cause });
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data.error as string) ?? `Erreur ${res.status}`,
      res.status,
    );
  }
  return data as T;
}

const body = (b: unknown): RequestInit => ({ body: JSON.stringify(b) });

export const authApi = {
  me: () => request<{ user: AuthUser }>("/api/auth/me"),
  signup: async (b: { email: string; password: string; displayName: string }) => {
    const res = await request<{ user: AuthUser; token?: string }>("/api/auth/signup", {
      method: "POST",
      ...body(b),
    });
    setAuthToken(res.token ?? null);
    return { user: res.user };
  },
  login: async (b: { email: string; password: string }) => {
    const res = await request<{ user: AuthUser; token?: string }>("/api/auth/login", {
      method: "POST",
      ...body(b),
    });
    setAuthToken(res.token ?? null);
    return { user: res.user };
  },
  logout: async () => {
    await request<void>("/api/auth/logout", { method: "POST" });
    setAuthToken(null);
  },
  updateProfile: (b: { displayName?: string; avatar?: string }) =>
    request<{ user: AuthUser }>("/api/auth/me", { method: "PATCH", ...body(b) }),
  exportData: () => request<unknown>("/api/auth/export"),
  deleteAccount: async () => {
    await request<void>("/api/auth/me", { method: "DELETE" });
    setAuthToken(null);
  },
};

type TripResp = { trip: Trip };

export const tripsApi = {
  list: () => request<{ trips: TripSummary[] }>("/api/trips"),
  get: (id: string) => request<TripResp>(`/api/trips/${id}`),
  create: (b: { name: string; description?: string; selectedDestination?: string; targetDays?: number; budgetType?: string }) =>
    request<TripResp>("/api/trips", { method: "POST", ...body(b) }),
  patch: (id: string, b: Record<string, unknown>) =>
    request<TripResp>(`/api/trips/${id}`, { method: "PATCH", ...body(b) }),
  remove: (id: string) => request<void>(`/api/trips/${id}`, { method: "DELETE" }),
  join: (id: string) => request<TripResp>(`/api/trips/${id}/join`, { method: "POST" }),

  addAvailability: (id: string, b: { start: string; end: string }) =>
    request<TripResp>(`/api/trips/${id}/availabilities`, { method: "POST", ...body(b) }),
  deleteAvailability: (id: string, availId: string) =>
    request<TripResp>(`/api/trips/${id}/availabilities/${availId}`, { method: "DELETE" }),

  addDestination: (id: string, b: { name: string }) =>
    request<TripResp>(`/api/trips/${id}/destinations`, { method: "POST", ...body(b) }),
  deleteDestination: (id: string, destId: string) =>
    request<TripResp>(`/api/trips/${id}/destinations/${destId}`, { method: "DELETE" }),
  voteDestination: (id: string, destId: string) =>
    request<TripResp>(`/api/trips/${id}/destinations/${destId}/vote`, { method: "POST" }),

  addActivity: (id: string, b: ActivityInput) =>
    request<TripResp>(`/api/trips/${id}/activities`, { method: "POST", ...body(b) }),
  bulkActivities: (id: string, activities: ActivityInput[]) =>
    request<TripResp>(`/api/trips/${id}/activities/bulk`, { method: "POST", ...body({ activities }) }),
  deleteActivity: (id: string, actId: string) =>
    request<TripResp>(`/api/trips/${id}/activities/${actId}`, { method: "DELETE" }),
  clearActivities: (id: string) =>
    request<TripResp>(`/api/trips/${id}/activities`, { method: "DELETE" }),
  voteActivity: (id: string, actId: string) =>
    request<TripResp>(`/api/trips/${id}/activities/${actId}/vote`, { method: "POST" }),

  putItinerary: (
    id: string,
    itinerary: {
      day: number;
      title: string;
      events: { time: string; endTime?: string; description: string; cost: number }[];
    }[],
  ) => request<TripResp>(`/api/trips/${id}/itinerary`, { method: "PUT", ...body({ itinerary }) }),
  addEvent: (
    id: string,
    b: {
      day: number;
      time: string;
      endTime?: string;
      description: string;
      cost: number;
      bookingUrl?: string;
    },
  ) => request<TripResp>(`/api/trips/${id}/events`, { method: "POST", ...body(b) }),
  updateEvent: (
    id: string,
    eventId: string,
    b: {
      time?: string;
      endTime?: string | null;
      description?: string;
      cost?: number;
      bookingUrl?: string | null;
    },
  ) => request<TripResp>(`/api/trips/${id}/events/${eventId}`, { method: "PATCH", ...body(b) }),
  deleteEvent: (id: string, eventId: string) =>
    request<TripResp>(`/api/trips/${id}/events/${eventId}`, { method: "DELETE" }),

  sendMessage: (id: string, text: string) =>
    request<TripResp>(`/api/trips/${id}/messages`, { method: "POST", ...body({ text }) }),

  addDocument: (id: string, b: { name: string; type?: string; size?: string; url?: string }) =>
    request<TripResp>(`/api/trips/${id}/documents`, { method: "POST", ...body(b) }),
  uploadFile: async (id: string, file: File): Promise<TripResp> => {
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/trips/${id}/uploads`), {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: form,
      });
    } catch (cause) {
      throw new ApiError("Impossible de joindre le serveur.", 0, { cause });
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError((data.error as string) ?? `Erreur ${res.status}`, res.status);
    }
    return data as TripResp;
  },
  deleteDocument: (id: string, docId: string) =>
    request<TripResp>(`/api/trips/${id}/documents/${docId}`, { method: "DELETE" }),

  addPhoto: (id: string, b: { url: string; caption?: string }) =>
    request<TripResp>(`/api/trips/${id}/photos`, { method: "POST", ...body(b) }),
  deletePhoto: (id: string, photoId: string) =>
    request<TripResp>(`/api/trips/${id}/photos/${photoId}`, { method: "DELETE" }),
};

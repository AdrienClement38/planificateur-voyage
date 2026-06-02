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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
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
  signup: (b: { email: string; password: string; displayName: string }) =>
    request<{ user: AuthUser }>("/api/auth/signup", { method: "POST", ...body(b) }),
  login: (b: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", { method: "POST", ...body(b) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  updateProfile: (b: { displayName?: string; avatar?: string }) =>
    request<{ user: AuthUser }>("/api/auth/me", { method: "PATCH", ...body(b) }),
  exportData: () => request<unknown>("/api/auth/export"),
  deleteAccount: () => request<void>("/api/auth/me", { method: "DELETE" }),
};

type TripResp = { trip: Trip };

export const tripsApi = {
  list: () => request<{ trips: TripSummary[] }>("/api/trips"),
  get: (id: string) => request<TripResp>(`/api/trips/${id}`),
  create: (b: { name: string; description?: string; targetDays?: number; budgetType?: string }) =>
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
  voteActivity: (id: string, actId: string) =>
    request<TripResp>(`/api/trips/${id}/activities/${actId}/vote`, { method: "POST" }),

  putItinerary: (
    id: string,
    itinerary: { day: number; title: string; events: { time: string; description: string; cost: number }[] }[],
  ) => request<TripResp>(`/api/trips/${id}/itinerary`, { method: "PUT", ...body({ itinerary }) }),
  addEvent: (id: string, b: { day: number; time: string; description: string; cost: number }) =>
    request<TripResp>(`/api/trips/${id}/events`, { method: "POST", ...body(b) }),
  deleteEvent: (id: string, eventId: string) =>
    request<TripResp>(`/api/trips/${id}/events/${eventId}`, { method: "DELETE" }),

  sendMessage: (id: string, text: string) =>
    request<TripResp>(`/api/trips/${id}/messages`, { method: "POST", ...body({ text }) }),

  addDocument: (id: string, b: { name: string; type?: string; size?: string; url?: string }) =>
    request<TripResp>(`/api/trips/${id}/documents`, { method: "POST", ...body(b) }),
  deleteDocument: (id: string, docId: string) =>
    request<TripResp>(`/api/trips/${id}/documents/${docId}`, { method: "DELETE" }),

  addPhoto: (id: string, b: { url: string; caption?: string }) =>
    request<TripResp>(`/api/trips/${id}/photos`, { method: "POST", ...body(b) }),
  deletePhoto: (id: string, photoId: string) =>
    request<TripResp>(`/api/trips/${id}/photos/${photoId}`, { method: "DELETE" }),
};

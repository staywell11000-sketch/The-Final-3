import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";
import {
  Property, PropertyCategory, PropertyStatus,
} from "@/components/dashboard/properties-data";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data?.error ?? `Request failed: ${res.status}`);
  return data as T;
}

// ── Types matching the API schema ────────────────────────────────────────────
export type PropertyRecord = {
  id: number;
  title: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  zipCode?: string | null;
  country?: string | null;
  type?: string | null;
  subtype?: string | null;
  status: string;
  price?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  sqft?: number | null;
  sizeMarla?: string | null;
  sector?: string | null;
  lotSize?: string | null;
  yearBuilt?: number | null;
  parkingSpaces?: number | null;
  images: string[];
  amenities: string[];
  tags: string[];
  mlsNumber?: string | null;
  listedById?: string | null;
  dealerId?: number | null;
  agentId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyListResponse = {
  data: PropertyRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PropertyInput = {
  title: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  country?: string;
  type?: string;
  subtype?: string;
  status?: string;
  price?: string;
  bedrooms?: number;
  bathrooms?: string;
  sqft?: number;
  sizeMarla?: string;
  sector?: string;
  lotSize?: string;
  yearBuilt?: number;
  parkingSpaces?: number;
  images?: string[];
  amenities?: string[];
  tags?: string[];
  mlsNumber?: string;
  dealerId?: number;
  agentId?: string;
  metadata?: Record<string, unknown>;
};

export type PropertiesFilters = {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
};

// ── Image URL helper ──────────────────────────────────────────────────────────
export function objectPathToUrl(objectPath: string): string {
  if (!objectPath) return "";
  if (objectPath.startsWith("http")) return objectPath;
  return objectPath.replace(/^\/objects/, `${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api/storage/objects`);
}

// ── Data mappers ─────────────────────────────────────────────────────────────
export function recordToProperty(r: PropertyRecord): Property {
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  const priceNum = r.price ? parseFloat(r.price) : 0;
  const firstImage = r.images?.[0] ?? "";

  return {
    id: String(r.id),
    title: r.title,
    address: r.address,
    city: r.city,
    state: r.state,
    country: (r.country ?? "USA") as string,
    price: priceNum,
    beds: r.bedrooms ?? 0,
    baths: r.bathrooms ? parseFloat(r.bathrooms) : 0,
    sqft: r.sqft ?? 0,
    lotSqft: r.lotSize ? parseFloat(r.lotSize) : null,
    yearBuilt: r.yearBuilt ?? new Date().getFullYear(),
    garage: r.parkingSpaces ?? 0,
    pool: Array.isArray(meta.amenities)
      ? false
      : Boolean(meta.pool),
    category: (r.type ?? "Villa") as PropertyCategory,
    status: (r.status ?? "active") as PropertyStatus,
    featured: Boolean(meta.featured),
    image: objectPathToUrl(firstImage),
    description: r.description ?? "",
    features: r.amenities ?? [],
    owner: (meta.owner as Property["owner"]) ?? { name: "", phone: "", email: "" },
    agent: (meta.agent as string) ?? "",
    analytics: (meta.analytics as Property["analytics"]) ?? { views: 0, inquiries: 0, saves: 0, trend: "0%" },
    listedAt: r.createdAt.slice(0, 10),
    updatedAt: r.updatedAt.slice(0, 10),
    daysOnMarket: typeof meta.daysOnMarket === "number" ? meta.daysOnMarket : 0,
    priceHistory: (meta.priceHistory as Property["priceHistory"]) ?? [],
    notes: (meta.notes as string) ?? "",
  };
}

export function propertyToInput(p: Property): PropertyInput {
  return {
    title: p.title,
    description: p.description,
    address: p.address,
    city: p.city,
    state: p.state,
    country: p.country,
    type: p.category,
    status: p.status,
    price: String(p.price),
    bedrooms: p.beds,
    bathrooms: String(p.baths),
    sqft: p.sqft,
    lotSize: p.lotSqft ? String(p.lotSqft) : undefined,
    yearBuilt: p.yearBuilt,
    parkingSpaces: p.garage,
    images: p.image ? [p.image] : [],
    amenities: p.features,
    metadata: {
      owner: p.owner,
      agent: p.agent,
      analytics: p.analytics,
      featured: p.featured,
      pool: p.pool,
      daysOnMarket: p.daysOnMarket,
      priceHistory: p.priceHistory,
      notes: p.notes,
    },
  };
}

// ── Query keys ────────────────────────────────────────────────────────────────
export const PROPERTIES_KEY = ["properties"] as const;

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useProperties(filters?: PropertiesFilters) {
  const { session } = useAuth();
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.type && filters.type !== "all") params.set("type", filters.type);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<PropertyListResponse>({
    queryKey: [...PROPERTIES_KEY, filters],
    queryFn: () => apiFetch<PropertyListResponse>(`/properties${qs}`),
    enabled: !!session,
    staleTime: 30_000,
    select: (data) => ({
      ...data,
      data: data.data.map(recordToProperty) as unknown as PropertyRecord[],
    }),
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PropertyInput) =>
      apiFetch<PropertyRecord>("/properties", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY });
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PropertyInput }) =>
      apiFetch<PropertyRecord>(`/properties/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY });
    },
  });
}

export function useUpdatePropertyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<PropertyRecord>(`/properties/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/properties/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY });
    },
  });
}

export function useBulkImportProperties() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: any[]) =>
      apiFetch<{ imported: number; skipped: number; errors: string[] }>("/properties/bulk", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPERTIES_KEY });
    },
  });
}

// ── Image upload helper ───────────────────────────────────────────────────────
export async function uploadPropertyImage(file: File): Promise<string> {
  const urlRes = await apiFetch<{ uploadURL: string; objectPath: string }>(
    "/storage/uploads/request-url",
    {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    },
  );

  await fetch(urlRes.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return objectPathToUrl(urlRes.objectPath);
}

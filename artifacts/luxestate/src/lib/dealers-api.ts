import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

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

export type DealerRecord = {
  id: number;
  userId: string;
  name: string;
  company?: string | null;
  phone: string;
  email?: string | null;
  location?: string | null;
  dealerType: string;
  profileImage?: string | null;
  status: string;
  notes?: string | null;
  totalLeads: number;
  totalDeals: number;
  createdAt: string;
  updatedAt: string;
};

export type DealerListResponse = {
  data: DealerRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type DealerInput = {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  location?: string;
  dealerType?: string;
  profileImage?: string;
  status?: string;
  notes?: string;
};

export type DealersFilters = {
  search?: string;
  status?: string;
  dealerType?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export const DEALERS_KEY = ["dealers"] as const;

export function useDealers(filters?: DealersFilters) {
  const { session } = useAuth();
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.dealerType && filters.dealerType !== "all") params.set("dealerType", filters.dealerType);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<DealerListResponse>({
    queryKey: [...DEALERS_KEY, filters],
    queryFn: () => apiFetch<DealerListResponse>(`/dealers${qs}`),
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useCreateDealer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DealerInput) =>
      apiFetch<DealerRecord>("/dealers", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEALERS_KEY }),
  });
}

export function useUpdateDealer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: DealerInput }) =>
      apiFetch<DealerRecord>(`/dealers/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEALERS_KEY }),
  });
}

export function useUpdateDealerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<DealerRecord>(`/dealers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEALERS_KEY }),
  });
}

export function useDeleteDealer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/dealers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEALERS_KEY }),
  });
}

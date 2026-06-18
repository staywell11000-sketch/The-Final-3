import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lead } from "@/components/dashboard/leads-types";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type CreateLeadInput = Omit<Lead, "id">;
export type UpdateLeadInput = Partial<Omit<Lead, "id">>;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export function useLeads() {
  const { session } = useAuth();
  return useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => apiFetch<Lead[]>("/leads"),
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadInput) =>
      apiFetch<Lead>("/leads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newLead) => {
      qc.setQueryData<Lead[]>(["leads"], (old) =>
        old ? [newLead, ...old] : [newLead]
      );
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: UpdateLeadInput }) =>
      apiFetch<Lead>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: (updated) => {
      qc.setQueryData<Lead[]>(["leads"], (old) =>
        old ? old.map((l) => (l.id === updated.id ? updated : l)) : [updated]
      );
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: (_v, id) => {
      qc.setQueryData<Lead[]>(["leads"], (old) =>
        old ? old.filter((l) => l.id !== id) : []
      );
    },
  });
}

export function useBulkDeleteLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/leads/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (_v, ids) => {
      const idSet = new Set(ids);
      qc.setQueryData<Lead[]>(["leads"], (old) =>
        old ? old.filter((l) => !idSet.has(l.id)) : []
      );
    },
  });
}

export function useBulkImportLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leads: CreateLeadInput[]) => {
      const { created } = await apiFetch<{ created: Lead[]; errors: string[] }>("/leads/bulk", {
        method: "POST",
        body: JSON.stringify({ leads }),
      });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useSyncLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; message: string }>("/lead-sync/trigger", {
        method: "POST",
      }),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["leads"] });
      }, 3000);
    },
  });
}

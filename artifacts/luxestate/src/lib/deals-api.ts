import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type DealStage = "new" | "contacted" | "negotiation" | "won" | "lost";
export type DealStatus = "active" | "closed";

export type Deal = {
  id: number;
  title: string;
  leadId: number | null;
  leadName: string | null;
  propertyId: number | null;
  assignedToId: string | null;
  createdById: string | null;
  stage: DealStage;
  status: DealStatus;
  value: string | null;
  commission: string | null;
  commissionRate: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  lostReason: string | null;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateDealInput = {
  title: string;
  leadId?: number | null;
  propertyId?: number | null;
  stage?: DealStage;
  value?: string | null;
  notes?: string;
  expectedCloseDate?: string | null;
  probability?: number | null;
  lostReason?: string | null;
};

export type UpdateDealInput = Partial<CreateDealInput>;

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
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export function useDeals(stage?: string) {
  const { session } = useAuth();
  return useQuery<Deal[]>({
    queryKey: ["deals", stage],
    queryFn: () => {
      const params = stage && stage !== "all" ? `?stage=${stage}` : "";
      return apiFetch<Deal[]>(`/deals${params}`);
    },
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDealInput) =>
      apiFetch<Deal>("/deals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: UpdateDealInput }) =>
      apiFetch<Deal>(`/deals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/deals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

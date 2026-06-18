import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type Activity = {
  id: number;
  userId: string;
  leadId: number | null;
  dealId: number | null;
  propertyId: number | null;
  type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  duration: number | null;
  metadata: Record<string, unknown> | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewActivity = {
  userId: string;
  leadId?: number;
  dealId?: number;
  propertyId?: number;
  type: string;
  title: string;
  description?: string;
  outcome?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  scheduledAt?: string;
  completedAt?: string;
};

async function authFetch(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export function useActivities(leadId?: number) {
  const { session } = useAuth();
  return useQuery<Activity[]>({
    queryKey: ["activities", leadId],
    queryFn: async () => {
      const token = session?.access_token ?? "";
      const url = leadId
        ? `${API_BASE}/activities?leadId=${leadId}`
        : `${API_BASE}/activities`;
      return authFetch(url, token);
    },
    enabled: !!session,
  });
}

export function useCreateActivity() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: NewActivity): Promise<Activity> => {
      const token = session?.access_token ?? "";
      return authFetch(`${API_BASE}/activities`, token, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      if (data.leadId) qc.invalidateQueries({ queryKey: ["activities", data.leadId] });
    },
  });
}

export function useDeleteActivity() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/activities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete activity");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

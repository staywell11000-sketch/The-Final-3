import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ApiNotification = {
  id: number;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function useNotifications() {
  const { session } = useAuth();
  return useQuery<ApiNotification[]>({
    queryKey: ["notifications", session?.user?.id],
    queryFn: async () => {
      const headers = await authHeaders();
      const res = await fetch(`${BASE}/notifications`, { headers });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!session,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await authHeaders();
      await fetch(`${BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const headers = await authHeaders();
      await fetch(`${BASE}/notifications/read-all`, {
        method: "PATCH",
        headers,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDismissNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const headers = await authHeaders();
      await fetch(`${BASE}/notifications/${id}`, {
        method: "DELETE",
        headers,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

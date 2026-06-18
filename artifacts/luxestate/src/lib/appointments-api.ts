import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type Appointment = {
  id: number;
  userId: string;
  leadId: number | null;
  dealId: number | null;
  title: string;
  description: string | null;
  dateTime: string;
  duration: number;
  location: string | null;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  leadName?: string | null;
  dealTitle?: string | null;
};

export type CreateAppointmentInput = {
  title: string;
  description?: string;
  dateTime: string;
  duration?: number;
  location?: string;
  leadId?: number | null;
  dealId?: number | null;
  reminderAt?: string | null;
};

export type UpdateAppointmentInput = Partial<CreateAppointmentInput>;

async function authFetch<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: "Request failed" }));
  if (!res.ok) throw new Error(data?.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export function useAppointments(month?: number, year?: number) {
  const { session } = useAuth();
  return useQuery<Appointment[]>({
    queryKey: ["appointments", month, year],
    queryFn: async () => {
      const token = session?.access_token ?? "";
      const params = new URLSearchParams();
      if (month !== undefined) params.set("month", String(month));
      if (year !== undefined) params.set("year", String(year));
      const qs = params.toString() ? `?${params.toString()}` : "";
      return authFetch<Appointment[]>(`${API_BASE}/appointments${qs}`, token);
    },
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useCreateAppointment() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAppointmentInput): Promise<Appointment> => {
      const token = session?.access_token ?? "";
      return authFetch<Appointment>(`${API_BASE}/appointments`, token, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useUpdateAppointment() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: UpdateAppointmentInput;
    }): Promise<Appointment> => {
      const token = session?.access_token ?? "";
      return authFetch<Appointment>(`${API_BASE}/appointments/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useDeleteAppointment() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const token = session?.access_token ?? "";
      return authFetch<void>(`${API_BASE}/appointments/${id}`, token, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

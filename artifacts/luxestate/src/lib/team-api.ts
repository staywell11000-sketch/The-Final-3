import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type TeamRole = "admin" | "manager" | "agent";

export type TeamMember = {
  id: number;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  performanceScore: number | null;
  assignedLeadsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TeamMemberDetail = TeamMember & {
  assignedLeads: Array<{
    id: number;
    name: string;
    email: string;
    status: string;
    priority: string;
    source: string | null;
    budget: string | null;
    createdAt: string | null;
  }>;
};

export type CreateMemberInput = {
  name: string;
  email: string;
  phone?: string;
  role?: TeamRole;
  performanceScore?: number | null;
  dateOfEmployment?: string | null;
};

export type UpdateMemberInput = Partial<CreateMemberInput>;

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

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => apiFetch<TeamMember[]>("/team-members"),
    staleTime: 30_000,
  });
}

export function useTeamMember(id: number | null) {
  return useQuery<TeamMemberDetail>({
    queryKey: ["team-members", id],
    queryFn: () => apiFetch<TeamMemberDetail>(`/team-members/${id}`),
    enabled: id !== null,
    staleTime: 20_000,
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMemberInput) =>
      apiFetch<TeamMember>("/team-members", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: UpdateMemberInput }) =>
      apiFetch<TeamMember>(`/team-members/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useDeleteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/team-members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, leadId }: { memberId: number; leadId: number }) =>
      apiFetch<{ ok: boolean }>(`/team-members/${memberId}/assign-lead`, {
        method: "POST",
        body: JSON.stringify({ leadId }),
      }),
    onSuccess: (_v, { memberId }) => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-members", memberId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

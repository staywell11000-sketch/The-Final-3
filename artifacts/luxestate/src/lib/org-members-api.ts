import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

export type OrgMember = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  role: string;
  orgRole: string;
  isActive: boolean;
  isOwner: boolean;
  avatarUrl: string | null;
  createdAt: string;
};

export type OrgInvitation = {
  id: number;
  email: string;
  name: string;
  orgRole: string;
  invitationCode: string;
  invitedByName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type RolePermissions = Record<string, Array<{ resource: string; action: string }>>;

export function useOrgMembers() {
  return useQuery<OrgMember[]>({
    queryKey: ["org-members"],
    queryFn: () => apiFetch("/api/org/members").then((r) => r.json()),
    staleTime: 30_000,
  });
}

export function useInvitations() {
  return useQuery<OrgInvitation[]>({
    queryKey: ["invitations"],
    queryFn: () => apiFetch("/api/invitations").then((r) => r.json()),
    staleTime: 30_000,
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string; orgRole: string }) =>
      apiFetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Failed to create invitation");
        }
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useDeleteInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/invitations/${id}`, { method: "DELETE" }).then((r) => {
        if (r.status !== 204 && !r.ok) throw new Error("Failed to delete");
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiFetch(`/api/org/members/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Failed");
        }
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, orgRole }: { userId: string; orgRole: string }) =>
      apiFetch(`/api/org/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Failed");
        }
        return r.json();
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
  });
}

export function usePasswordReset() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/org/members/${userId}/password-reset`, { method: "POST" }).then(
        async (r) => {
          if (!r.ok) {
            const err = await r.json().catch(() => ({ error: "Request failed" }));
            throw new Error(err.error ?? "Failed");
          }
          return r.json();
        }
      ),
  });
}

export function useRolePermissions() {
  return useQuery<{ roles: RolePermissions; hasCustomized: boolean }>({
    queryKey: ["role-permissions"],
    queryFn: () => apiFetch("/api/permissions/roles").then((r) => r.json()),
    staleTime: 60_000,
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleName,
      permissions,
    }: {
      roleName: string;
      permissions: Array<{ resource: string; action: string }>;
    }) =>
      apiFetch(`/api/permissions/roles/${roleName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Failed");
        }
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    },
  });
}

export async function validateInvitation(email: string, code: string) {
  const res = await fetch(
    `${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api/invitations/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Invalid invitation" }));
    throw new Error(err.error ?? "Invalid invitation");
  }
  return res.json() as Promise<{
    valid: boolean;
    name: string;
    email: string;
    orgRole: string;
    orgName: string;
  }>;
}

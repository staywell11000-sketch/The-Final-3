import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "./supabase"

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

export type UserProfile = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
  title: string | null
  phone: string | null
  avatarUrl: string | null
  onboarded: boolean
  createdAt: string
  updatedAt: string
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

async function fetchCurrentUser(): Promise<UserProfile> {
  const headers = await getAuthHeaders()
  if (!headers.Authorization) throw new Error("No session")
  const res = await fetch(`${BASE}/api/users/me`, { headers })
  if (!res.ok) throw new Error("Not found")
  return res.json()
}

async function upsertCurrentUser(data: Partial<UserProfile>): Promise<UserProfile> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE}/api/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to save user")
  return res.json()
}

export function useCurrentUser(userId?: string) {
  return useQuery<UserProfile>({
    queryKey: ["currentUser", userId],
    queryFn: fetchCurrentUser,
    retry: false,
    enabled: !!userId,
  })
}

export function useUpdateCurrentUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: upsertCurrentUser,
    onSuccess: (data) => {
      qc.setQueryData(["currentUser", data.id], data)
      qc.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })
}

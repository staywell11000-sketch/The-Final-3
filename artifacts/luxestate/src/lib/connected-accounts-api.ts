import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "./supabase"

const getBase = () => (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// ─── Types ────────────────────────────────────────────────

export type Provider = "whatsapp" | "facebook" | "instagram" | "tiktok"

export type ConnectedAccount = {
  id: string
  user_id: string
  provider: Provider
  account_name: string | null
  account_id: string | null
  status: "active" | "expired" | "error"
  last_synced_at: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

export type OAuthUrlResult =
  | { configured: true; url: string }
  | { configured: false; error: string; envVars: string[] }

export type FacebookPage = {
  id: string
  name: string
  access_token?: string
  category?: string
  fan_count?: number
}

export type AdAccount = {
  id: string
  name: string
  account_status?: number
  currency?: string
  lead_gen_enabled?: boolean
}

// ─── API functions ────────────────────────────────────────

export async function fetchConnectedAccounts(): Promise<ConnectedAccount[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${getBase()}/api/connected-accounts`, { headers })
  if (!res.ok) throw new Error("Failed to load connected accounts")
  return res.json()
}

export async function fetchOAuthUrl(provider: Provider, returnUrl: string): Promise<OAuthUrlResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${getBase()}/api/connected-accounts/oauth-url/${provider}?returnUrl=${encodeURIComponent(returnUrl)}`,
    { headers }
  )
  const data = await res.json()
  if (res.status === 503) return { configured: false, error: data.error, envVars: data.envVars ?? [] }
  if (!res.ok) throw new Error(data?.error || "Failed to get OAuth URL")
  return { configured: true, url: data.url }
}

export async function fetchPages(accountId: string): Promise<FacebookPage[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${getBase()}/api/connected-accounts/${accountId}/pages`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err.error || "Failed to fetch pages")
  }
  return res.json()
}

export async function fetchAdAccounts(accountId: string): Promise<AdAccount[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${getBase()}/api/connected-accounts/${accountId}/ad-accounts`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err.error || "Failed to fetch ad accounts")
  }
  return res.json()
}

export async function saveAccountMetadata(
  accountId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${getBase()}/api/connected-accounts/${accountId}/metadata`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err.error || "Failed to save metadata")
  }
}

async function deleteConnectedAccount(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${getBase()}/api/connected-accounts/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 204) throw new Error("Failed to disconnect account")
}

// ─── React Query hooks ────────────────────────────────────

export function useConnectedAccounts() {
  return useQuery<ConnectedAccount[]>({
    queryKey: ["connectedAccounts"],
    queryFn: fetchConnectedAccounts,
    staleTime: 30_000,
    retry: false,
  })
}

export function usePages(accountId: string | null) {
  return useQuery<FacebookPage[]>({
    queryKey: ["pages", accountId],
    queryFn: () => fetchPages(accountId!),
    enabled: !!accountId,
    staleTime: 60_000,
    retry: false,
  })
}

export function useAdAccounts(accountId: string | null) {
  return useQuery<AdAccount[]>({
    queryKey: ["adAccounts", accountId],
    queryFn: () => fetchAdAccounts(accountId!),
    enabled: !!accountId,
    staleTime: 60_000,
    retry: false,
  })
}

export function useDisconnectAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteConnectedAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectedAccounts"] })
    },
  })
}

export function useSaveAccountMetadata() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, metadata }: { accountId: string; metadata: Record<string, unknown> }) =>
      saveAccountMetadata(accountId, metadata),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectedAccounts"] })
    },
  })
}

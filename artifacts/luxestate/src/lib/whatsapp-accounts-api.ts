import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"

// ─── Types ────────────────────────────────────────────────

export interface WhatsAppAccount {
  id:            number
  organizationId: number
  phoneNumber:   string | null
  phoneNumberId: string | null
  displayName:   string | null
  businessName:  string | null
  wabaId:        string | null
  accountId:     string | null
  status:        "active" | "expired" | "error" | string
  connectedAt:   string | null
  lastSyncedAt:  string | null
  templates:     WhatsAppTemplate[]
  templatesSyncedAt: string | null
  myPermission?: UserWaPermission | null
}

export interface WhatsAppTemplate {
  id:       string
  name:     string
  language: string
  category: string
  status:   string
}

export interface UserWaPermission {
  userId:           string
  whatsappAccountId: number
  canView:          boolean
  canReply:         boolean
  canAssign:        boolean
}

export interface WaAccountsLimit {
  used:      number
  limit:     number | null
  remaining: number | null
  plan:      string
}

export interface OrgMemberPermission {
  userId:    string
  userName:  string | null
  userEmail: string | null
  orgRole:   string | null
  accounts:  Array<{
    accountId:  number
    canView:    boolean
    canReply:   boolean
    canAssign:  boolean
  }>
}

// ─── API functions ────────────────────────────────────────

export async function fetchWaAccounts(): Promise<WhatsAppAccount[]> {
  const res = await apiFetch("/api/whatsapp/accounts")
  if (!res.ok) throw new Error("Failed to load WhatsApp accounts")
  const data = await res.json()
  return data.accounts ?? []
}

export async function fetchWaLimit(): Promise<WaAccountsLimit> {
  const res = await apiFetch("/api/whatsapp/accounts/limit")
  if (!res.ok) throw new Error("Failed to load WhatsApp limit")
  return res.json()
}

export async function connectWaAccount(code: string): Promise<WhatsAppAccount> {
  const res = await apiFetch("/api/whatsapp/accounts/connect", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ code }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? "Connect failed")
  return data.account
}

export async function disconnectWaAccount(accountId: number): Promise<void> {
  const res = await apiFetch(`/api/whatsapp/accounts/${accountId}`, { method: "DELETE" })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({})) as any
    throw new Error(data?.error ?? "Disconnect failed")
  }
}

export async function fetchWaAccountHealth(accountId: number): Promise<any> {
  const res = await apiFetch(`/api/whatsapp/accounts/${accountId}/health`)
  if (!res.ok) throw new Error("Health check failed")
  return res.json()
}

export async function syncWaAccountTemplates(accountId: number): Promise<{ synced: number; templates: WhatsAppTemplate[] }> {
  const res = await apiFetch(`/api/whatsapp/accounts/${accountId}/templates/sync`, { method: "POST" })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? "Template sync failed")
  return data
}

export async function fetchWaPermissions(): Promise<OrgMemberPermission[]> {
  const res = await apiFetch("/api/whatsapp/permissions")
  if (!res.ok) throw new Error("Failed to load permissions")
  const data = await res.json()
  return data.members ?? []
}

export async function setWaPermission(payload: {
  userId:           string
  whatsappAccountId: number
  canView:          boolean
  canReply:         boolean
  canAssign:        boolean
}): Promise<void> {
  const res = await apiFetch("/api/whatsapp/permissions", {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any
    throw new Error(data?.error ?? "Failed to save permission")
  }
}

export async function revokeWaPermission(userId: string, whatsappAccountId: number): Promise<void> {
  const res = await apiFetch("/api/whatsapp/permissions", {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userId, whatsappAccountId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as any
    throw new Error(data?.error ?? "Failed to revoke permission")
  }
}

// ─── React Query Hooks ────────────────────────────────────

export function useWaAccounts() {
  return useQuery<WhatsAppAccount[]>({
    queryKey:  ["waAccounts"],
    queryFn:   fetchWaAccounts,
    staleTime: 30_000,
    retry:     false,
  })
}

export function useWaLimit() {
  return useQuery<WaAccountsLimit>({
    queryKey:  ["waAccountsLimit"],
    queryFn:   fetchWaLimit,
    staleTime: 30_000,
    retry:     false,
  })
}

export function useWaAccountHealth(accountId: number, enabled = true) {
  return useQuery({
    queryKey:  ["waAccountHealth", accountId],
    queryFn:   () => fetchWaAccountHealth(accountId),
    staleTime: 60_000,
    retry:     false,
    enabled,
  })
}

export function useConnectWaAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => connectWaAccount(code),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["waAccounts"] })
      qc.invalidateQueries({ queryKey: ["waAccountsLimit"] })
      qc.invalidateQueries({ queryKey: ["whatsappStatus"] })
    },
  })
}

export function useDisconnectWaAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => disconnectWaAccount(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["waAccounts"] })
      qc.invalidateQueries({ queryKey: ["waAccountsLimit"] })
      qc.invalidateQueries({ queryKey: ["whatsappStatus"] })
    },
  })
}

export function useSyncWaTemplates(accountId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncWaAccountTemplates(accountId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["waAccounts"] })
    },
  })
}

export function useWaPermissions() {
  return useQuery<OrgMemberPermission[]>({
    queryKey:  ["waPermissions"],
    queryFn:   fetchWaPermissions,
    staleTime: 30_000,
    retry:     false,
  })
}

export function useSetWaPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: setWaPermission,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["waPermissions"] })
      qc.invalidateQueries({ queryKey: ["waAccounts"] })
    },
  })
}

export function useRevokeWaPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, accountId }: { userId: string; accountId: number }) =>
      revokeWaPermission(userId, accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waPermissions"] })
      qc.invalidateQueries({ queryKey: ["waAccounts"] })
    },
  })
}

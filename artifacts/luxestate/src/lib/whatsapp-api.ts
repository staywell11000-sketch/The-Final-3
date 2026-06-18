import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "./supabase"

const getBase = () => (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// ─── Types ────────────────────────────────────────────────

export type WhatsAppStatus = {
  connected: false
} | {
  connected:         true
  status:            "active" | "expired" | "error"
  accountName:       string | null
  phoneNumberId:     string | null
  wabaId:            string | null
  phoneNumber:       string | null
  businessName:      string | null
  lastSyncedAt:      string | null
  webhookUrl:        string
  verifyToken:       string
  templates:         WhatsAppTemplate[]
  templatesSyncedAt: string | null
}

export type WhatsAppHealth = {
  connected: false
} | {
  connected:         true
  healthy:           boolean
  tokenValid:        boolean
  phoneValid:        boolean
  webhookConfigured: boolean
  warnings:          string[]
  details:           {
    fbName?:        string | null
    displayPhone?:  string | null
    verifiedName?:  string | null
    qualityRating?: string | null
  }
  webhookUrl:  string
  verifyToken: string | null
}

export type WhatsAppTemplate = {
  id:       string
  name:     string
  language: string
  category: string
  status:   "APPROVED" | "PENDING" | "REJECTED" | string
}

export type SdkConfig =
  | { configured: false }
  | { configured: true; appId: string; configId: string | null }

export type EbsResult = {
  success:      boolean
  wabaId:       string | null
  phoneNumberId: string | null
  phoneNumber:  string | null
  businessName: string | null
  businessId:   string | null
}

// ─── API functions ────────────────────────────────────────

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  const headers = await authHeaders()
  const res = await fetch(`${getBase()}/api/whatsapp/status`, { headers })
  if (!res.ok) throw new Error("Failed to get WhatsApp status")
  return res.json()
}

export async function fetchWhatsAppHealth(): Promise<WhatsAppHealth> {
  const headers = await authHeaders()
  const res = await fetch(`${getBase()}/api/whatsapp/health`, { headers })
  if (!res.ok) throw new Error("Failed to get WhatsApp health")
  return res.json()
}

export async function fetchSdkConfig(): Promise<SdkConfig> {
  const res = await fetch(`${getBase()}/api/whatsapp/sdk-config`)
  if (!res.ok) throw new Error("Failed to get SDK config")
  return res.json()
}

export async function postEmbeddedSignup(code: string): Promise<EbsResult> {
  const headers = await authHeaders()
  const res = await fetch(`${getBase()}/api/whatsapp/embedded-signup`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? "Embedded signup failed")
  return data
}

export async function postSyncTemplates(): Promise<{ synced: number; templates: WhatsAppTemplate[] }> {
  const headers = await authHeaders()
  const res = await fetch(`${getBase()}/api/whatsapp/templates/sync`, {
    method: "POST",
    headers,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? "Template sync failed")
  return data
}

export async function deleteDisconnect(): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`${getBase()}/api/whatsapp/disconnect`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({})) as any
    throw new Error(data?.error ?? "Disconnect failed")
  }
}

// ─── React Query hooks ────────────────────────────────────

export function useWhatsAppStatus() {
  return useQuery<WhatsAppStatus>({
    queryKey: ["whatsappStatus"],
    queryFn:  fetchWhatsAppStatus,
    staleTime: 30_000,
    retry:     false,
  })
}

export function useWhatsAppHealth(enabled = true) {
  return useQuery<WhatsAppHealth>({
    queryKey: ["whatsappHealth"],
    queryFn:  fetchWhatsAppHealth,
    staleTime: 60_000,
    retry:     false,
    enabled,
  })
}

export function useWhatsAppSdkConfig() {
  return useQuery<SdkConfig>({
    queryKey: ["whatsappSdkConfig"],
    queryFn:  fetchSdkConfig,
    staleTime: 5 * 60_000,
    retry:     false,
  })
}

export function useWhatsAppEmbeddedSignup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => postEmbeddedSignup(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsappStatus"] })
      qc.invalidateQueries({ queryKey: ["whatsappHealth"] })
      qc.invalidateQueries({ queryKey: ["connectedAccounts"] })
    },
  })
}

export function useWhatsAppSyncTemplates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postSyncTemplates,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsappStatus"] })
    },
  })
}

export function useWhatsAppDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteDisconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsappStatus"] })
      qc.invalidateQueries({ queryKey: ["whatsappHealth"] })
      qc.invalidateQueries({ queryKey: ["connectedAccounts"] })
    },
  })
}

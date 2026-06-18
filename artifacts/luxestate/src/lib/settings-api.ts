import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useAuth } from "./auth-context"
import { supabase } from "./supabase"

const API = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api"

export type UserProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  title: string | null
  phone: string | null
  avatar_url: string | null
}

export type UserSettingsData = {
  id: number
  business_name: string | null
  business_logo_url: string | null
  whatsapp_number: string | null
  office_address: string | null
  team_size: string | null
  position: string | null
  theme: string | null
  time_format: string | null
  notifications_enabled: boolean
  new_lead_notif: boolean
  deal_status_notif: boolean
  whatsapp_notif: boolean
  weekly_reports_enabled: boolean
  marketing_emails_enabled: boolean
  security_two_factor_enabled: boolean
}

export type SettingsResponse = {
  user: UserProfile | null
  settings: UserSettingsData | null
}

export type SettingsUpdate = {
  firstName?: string
  lastName?: string
  phone?: string
  title?: string
  avatarUrl?: string
  businessName?: string
  businessLogoUrl?: string
  whatsappNumber?: string
  officeAddress?: string
  teamSize?: string
  position?: string
  theme?: string
  timeFormat?: string
  notificationsEnabled?: boolean
  newLeadNotif?: boolean
  dealStatusNotif?: boolean
  whatsappNotif?: boolean
  weeklyReportsEnabled?: boolean
  marketingEmailsEnabled?: boolean
  securityTwoFactorEnabled?: boolean
  preferredLanguage?: string
}

// Always read the token fresh from Supabase at call time — never from a
// React state closure that may have been captured before a token refresh.
async function freshHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (session?.access_token) h["Authorization"] = `Bearer ${session.access_token}`
  return h
}

async function fetchSettings(): Promise<SettingsResponse> {
  let res = await fetch(`${API}/settings`, { headers: await freshHeaders() })

  // 401 → token just expired, refresh once and retry
  if (res.status === 401) {
    await supabase.auth.refreshSession()
    res = await fetch(`${API}/settings`, { headers: await freshHeaders() })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any
    throw new Error(body?.error ?? `Settings request failed (HTTP ${res.status})`)
  }
  return res.json()
}

export function useSettings() {
  const { session } = useAuth()

  return useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: !!session,
    staleTime: 1000 * 60 * 5,           // 5 min — settings rarely change
    gcTime: 1000 * 60 * 15,             // Keep cache 15 min after unmount
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: keepPreviousData,  // Keep old data visible during re-fetch
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (update: SettingsUpdate) => {
      const res = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: await freshHeaders(),
        body: JSON.stringify(update),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any
        throw new Error(err.error || "Failed to update settings")
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] })
    },
  })
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ field, file }: { field: "avatar" | "logo"; file: File }) => {
      const base64 = await fileToBase64(file)
      const res = await fetch(`${API}/settings/upload`, {
        method: "POST",
        headers: await freshHeaders(),
        body: JSON.stringify({ field, base64, filename: file.name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any
        throw new Error(err.error || "Upload failed")
      }
      const data = await res.json() as { url: string }
      return data.url
    },
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

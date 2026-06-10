import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { ConnectedAccountsTab } from "@/components/dashboard/connected-accounts-tab"
import { WhatsAppSettingsTab } from "@/components/whatsapp/WhatsAppSettingsTab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { surfaceInputClass } from "@/lib/ui-classes"
import { useSettings, useUpdateSettings, useUploadImage, type SettingsUpdate } from "@/lib/settings-api"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import {
  User, Bell, Shield, Palette, MessageCircle, Building2,
  Link2, Camera, Loader2,
  Check, Lock, Clock, Mail, Save, RefreshCw, AlertCircle,
  Smartphone, KeyRound, LogOut, Trash2, Download, UserCog,
  Eye, EyeOff, ShieldCheck, MonitorSmartphone, Copy, CheckCheck,
  Globe, UserCircle2, CreditCard, ShieldAlert, HeadphonesIcon,
  FileDown, ToggleLeft, ToggleRight, ChevronDown, ChevronRight as ChevronRightIcon,
  FileText, Database, History, Plus, HelpCircle,
} from "lucide-react"
import {
  useTickets, useCreateTicket, useTicket, useSendMessage,
  usePrivacySettings, useToggleSupportAccess, usePrivacyAuditLog, useDataExport,
  STATUS_LABELS, STATUS_COLORS, type TicketStatus,
} from "@/lib/support-api"
import { format } from "date-fns"
import { THEMES, THEME_PAIRS } from "@/lib/themes"

// ─── Tab Config ───────────────────────────────────────────

const TABS = [
  { id: "profile",      label: "Profile",            icon: User },
  { id: "branding",     label: "Business",           icon: Building2 },
  { id: "appearance",   label: "Appearance",         icon: Palette },
  { id: "notifications",label: "Notifications",      icon: Bell },
  { id: "security",     label: "Security",           icon: Shield },
  { id: "accounts",     label: "Connected Accounts", icon: Link2 },
  { id: "whatsapp",     label: "WhatsApp",           icon: MessageCircle },
  { id: "account",      label: "Account",            icon: UserCog },
  { id: "privacy",      label: "Privacy & Security", icon: ShieldAlert },
  { id: "support",      label: "Support",            icon: HeadphonesIcon },
]

// ─── Toggle Switch ────────────────────────────────────────

function Toggle({
  checked, onChange, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-input border border-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

// ─── Avatar / Image Uploader ──────────────────────────────

function ImageUploader({
  current, fallback, field, onUploaded, shape = "circle",
}: {
  current?: string | null
  fallback: string
  field: "avatar" | "logo"
  onUploaded: (url: string) => void
  shape?: "circle" | "rounded"
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadMut = useUploadImage()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB")
      return
    }
    try {
      const url = await uploadMut.mutateAsync({ field, file })
      onUploaded(url)
      toast.success("Image uploaded")
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed")
    }
    e.target.value = ""
  }

  return (
    <div className="relative group">
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer overflow-hidden flex items-center justify-center",
          "bg-gradient-to-br from-primary/70 to-accent/70 transition-all",
          shape === "circle" ? "h-20 w-20 rounded-full" : "h-16 w-32 rounded-xl",
          "ring-2 ring-border/40 group-hover:ring-primary/50"
        )}
      >
        {current ? (
          <img src={current} alt="avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-primary-foreground select-none">{fallback}</span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploadMut.isPending
            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
            : <Camera className="h-5 w-5 text-white" />
          }
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function NotifRow({
  label, description, checked, onChange, saving,
}: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; saving: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-secondary/10 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={saving} />
    </div>
  )
}

// ─── Password Input ───────────────────────────────────────

function PasswordInput({
  value, onChange, placeholder, show, onToggleShow,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  show: boolean
  onToggleShow: () => void
}) {
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(surfaceInputClass, "pr-10")}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ─── Detect browser + platform from user agent ────────────

function parseUserAgent(ua: string): { browser: string; os: string } {
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Unknown Browser"
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" : "Unknown OS"
  return { browser, os }
}

// ─── Main Page ────────────────────────────────────────────

export default function SettingsPage() {
  const { data, isPending, isFetching, isError, refetch } = useSettings()
  const [retrying, setRetrying] = useState(false)
  const handleRetry = async () => { setRetrying(true); try { await refetch() } finally { setRetrying(false) } }
  const updateSettings = useUpdateSettings()
  const { theme, setTheme } = useTheme()
  const { session, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")

  // ── URL param: OAuth redirect ─────────────────────────
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null)
  const [oauthError, setOauthError]               = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab"); const connected = params.get("connected"); const error = params.get("error")
    const validTabs = TABS.map(t => t.id)
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab)
      window.history.replaceState({}, "", window.location.pathname)
    } else if (connected || error) {
      setActiveTab("accounts")
    }
    if (connected) { setConnectedProvider(connected); window.history.replaceState({}, "", window.location.pathname) }
    else if (error) { setOauthError(decodeURIComponent(params.get("provider") ? `${params.get("provider")}: ${error}` : error)); window.history.replaceState({}, "", window.location.pathname) }
  }, [])

  // ── Profile form state ────────────────────────────────
  const user = data?.user
  const settings = data?.settings

  const [profile, setProfile] = useState({
    firstName: "", lastName: "", email: "", phone: "", title: "", avatarUrl: "",
  })
  const [business, setBusiness] = useState({
    businessName: "", businessLogoUrl: "", whatsappNumber: "", officeAddress: "", teamSize: "", position: "",
  })
  const [notifs, setNotifs] = useState({
    notificationsEnabled: true, newLeadNotif: true, dealStatusNotif: true,
    whatsappNotif: true, weeklyReportsEnabled: true, marketingEmailsEnabled: false,
  })
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h")
  const [savingNotif, setSavingNotif] = useState(false)
  const formInitialised = useRef(false)

  // ── 2FA state ─────────────────────────────────────────
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaEnrollData, setMfaEnrollData] = useState<{ id: string; qrCode: string; secret: string } | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaDisabling, setMfaDisabling] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  // ── Password state ────────────────────────────────────
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" })
  const [pwLoading, setPwLoading] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwStrength, setPwStrength] = useState(0)

  // ── Sessions state ────────────────────────────────────
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  // ── Account / danger zone ─────────────────────────────
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Populate form fields from DB — runs once when data first arrives.
  useEffect(() => {
    if (!settings || formInitialised.current) return
    formInitialised.current = true
    if (user) {
      setProfile({
        firstName: user.first_name ?? "",
        lastName:  user.last_name ?? "",
        email:     user.email ?? "",
        phone:     user.phone ?? "",
        title:     user.title ?? "",
        avatarUrl: user.avatar_url ?? "",
      })
    }
    setBusiness({
      businessName:    settings.business_name ?? "",
      businessLogoUrl: settings.business_logo_url ?? "",
      whatsappNumber:  settings.whatsapp_number ?? "",
      officeAddress:   settings.office_address ?? "",
      teamSize:        settings.team_size ?? "",
      position:        settings.position ?? "",
    })
    setNotifs({
      notificationsEnabled:  settings.notifications_enabled,
      newLeadNotif:          settings.new_lead_notif,
      dealStatusNotif:       settings.deal_status_notif,
      whatsappNotif:         settings.whatsapp_notif,
      weeklyReportsEnabled:  settings.weekly_reports_enabled,
      marketingEmailsEnabled:settings.marketing_emails_enabled,
    })
    setTimeFormat((settings.time_format as "12h" | "24h") ?? "12h")
  }, [settings, user])

  // Load MFA factors when security tab is opened
  useEffect(() => {
    if (activeTab === "security") loadMfaFactors()
  }, [activeTab])

  // ── Password strength ─────────────────────────────────
  useEffect(() => {
    const p = pwForm.newPassword
    let score = 0
    if (p.length >= 8) score++
    if (p.length >= 12) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^a-zA-Z0-9]/.test(p)) score++
    setPwStrength(score)
  }, [pwForm.newPassword])

  // ── Save handlers ─────────────────────────────────────

  const saveProfile = async () => {
    try {
      await updateSettings.mutateAsync({
        firstName: profile.firstName || undefined,
        lastName:  profile.lastName  || undefined,
        phone:     profile.phone     || undefined,
        title:     profile.title     || undefined,
        avatarUrl: profile.avatarUrl || undefined,
      })
      toast.success("Profile saved")
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed")
    }
  }

  const saveBusiness = async () => {
    try {
      await updateSettings.mutateAsync({
        businessName:    business.businessName    || undefined,
        businessLogoUrl: business.businessLogoUrl || undefined,
        whatsappNumber:  business.whatsappNumber  || undefined,
        officeAddress:   business.officeAddress   || undefined,
        teamSize:        business.teamSize        || undefined,
        position:        business.position        || undefined,
      })
      toast.success("Business info saved")
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed")
    }
  }

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    try {
      await updateSettings.mutateAsync({ theme: newTheme, timeFormat })
    } catch {}
  }

  const handleTimeFormatChange = async (fmt: "12h" | "24h") => {
    setTimeFormat(fmt)
    try {
      await updateSettings.mutateAsync({ theme, timeFormat: fmt })
    } catch {}
  }

  const handleNotifToggle = useCallback(async (key: keyof typeof notifs, value: boolean) => {
    const updated = { ...notifs, [key]: value }
    setNotifs(updated)
    setSavingNotif(true)
    try {
      await updateSettings.mutateAsync(updated as SettingsUpdate)
    } catch (err: any) {
      setNotifs(notifs) // revert
      toast.error(err?.message ?? "Save failed")
    } finally {
      setSavingNotif(false)
    }
  }, [notifs, updateSettings])

  // ── 2FA handlers ──────────────────────────────────────

  const loadMfaFactors = async () => {
    setMfaLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error && data) setMfaFactors(data.totp ?? [])
    setMfaLoading(false)
  }

  const startMfaEnrollment = async () => {
    setMfaEnrolling(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
    if (error || !data) {
      toast.error("Failed to start 2FA setup: " + (error?.message ?? "Unknown error"))
      setMfaEnrolling(false)
      return
    }
    setMfaEnrollData({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    })
    setMfaCode("")
    setMfaEnrolling(false)
  }

  const verifyMfaCode = async () => {
    if (!mfaEnrollData || mfaCode.length < 6) return
    setMfaVerifying(true)
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id })
    if (challengeErr || !challenge) {
      toast.error("Failed to create challenge")
      setMfaVerifying(false)
      return
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfaEnrollData.id,
      challengeId: challenge.id,
      code: mfaCode,
    })
    if (verifyErr) {
      toast.error("Invalid code — please try again")
      setMfaVerifying(false)
      return
    }
    toast.success("Two-factor authentication enabled!")
    setMfaEnrollData(null)
    setMfaCode("")
    await loadMfaFactors()
    setMfaVerifying(false)
  }

  const disableMfa = async (factorId: string) => {
    setMfaDisabling(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) {
      toast.error("Failed to disable 2FA: " + error.message)
      setMfaDisabling(false)
      return
    }
    toast.success("Two-factor authentication disabled")
    await loadMfaFactors()
    setMfaDisabling(false)
  }

  const cancelMfaEnrollment = async () => {
    if (mfaEnrollData) {
      await supabase.auth.mfa.unenroll({ factorId: mfaEnrollData.id }).catch(() => {})
    }
    setMfaEnrollData(null)
    setMfaCode("")
  }

  const copySecret = () => {
    if (!mfaEnrollData) return
    navigator.clipboard.writeText(mfaEnrollData.secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  // ── Password handler ──────────────────────────────────

  const changePassword = async () => {
    if (pwForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword })
    if (error) {
      toast.error(error.message)
      setPwLoading(false)
      return
    }
    toast.success("Password updated successfully")
    setPwForm({ newPassword: "", confirmPassword: "" })
    setPwLoading(false)
  }

  // ── Session handler ───────────────────────────────────

  const signOutOtherSessions = async () => {
    setSigningOutOthers(true)
    const { error } = await supabase.auth.signOut({ scope: "others" })
    if (error) toast.error("Failed to sign out other sessions")
    else toast.success("Signed out of all other devices")
    setSigningOutOthers(false)
  }

  // ── Data export handler ───────────────────────────────

  const exportData = async () => {
    setExportLoading(true)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const headers: Record<string, string> = s?.access_token
        ? { Authorization: `Bearer ${s.access_token}` } : {}
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")
      const [leadsRes, dealsRes, propertiesRes] = await Promise.all([
        fetch(`${BASE}/api/leads`, { headers }),
        fetch(`${BASE}/api/deals`, { headers }),
        fetch(`${BASE}/api/properties`, { headers }),
      ])
      const exportData = {
        exportedAt: new Date().toISOString(),
        leads: leadsRes.ok ? await leadsRes.json() : [],
        deals: dealsRes.ok ? await dealsRes.json() : [],
        properties: propertiesRes.ok ? await propertiesRes.json() : [],
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `luxestate-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch {
      toast.error("Export failed")
    } finally {
      setExportLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────

  const avatarInitials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || (user?.email?.[0] ?? "U").toUpperCase()
  const activeMfaFactor = mfaFactors.find((f) => f.status === "verified")
  const { browser, os } = parseUserAgent(navigator.userAgent)
  const memberSince = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—"
  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][pwStrength] ?? ""
  const pwStrengthColor = pwStrength <= 1 ? "bg-red-500" : pwStrength <= 2 ? "bg-amber-500" : pwStrength <= 3 ? "bg-yellow-400" : "bg-emerald-500"

  // First-ever load — no data at all yet
  if (isPending) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Settings" description="Manage your profile, preferences, and integrations." />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  // Hard error — first load failed with no data to fall back on
  if (isError && !data) {
    return (
      <div className="space-y-6">
        <DashboardPageHeader title="Settings" description="Manage your profile, preferences, and integrations." />
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold">Failed to load settings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The server may be starting up. Your account data is safe — try again in a moment.
            </p>
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 px-4 py-2 text-sm font-medium hover:bg-secondary/60 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
            {retrying ? "Retrying…" : "Try Again"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Settings"
        description="Manage your profile, preferences, and integrations."
        actions={
          isFetching ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
            </span>
          ) : null
        }
      />

      {/* Soft error — re-fetch failed but stale data is still shown */}
      {isError && data && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            Couldn't refresh your settings — showing last saved data.
          </span>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400"
          >
            <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
            {retrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-row gap-1 overflow-x-auto pb-2 shrink-0 md:flex-col md:w-48 md:overflow-visible md:pb-0 md:sticky md:top-4"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all shrink-0",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label.split(" ")[0]}</span>
            </button>
          ))}
        </motion.nav>

        {/* ── Content ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 min-w-0 space-y-4"
          >

            {/* ─── Profile ──────────────────────────────── */}
            {activeTab === "profile" && (
              <Section title="Profile Information" subtitle="Update your personal details and contact info.">
                <div className="flex items-center gap-4">
                  <ImageUploader
                    current={profile.avatarUrl}
                    fallback={avatarInitials}
                    field="avatar"
                    shape="circle"
                    onUploaded={(url) => setProfile((p) => ({ ...p, avatarUrl: url }))}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Profile Photo</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 4 MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldRow label="First Name">
                    <Input value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} placeholder="James" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Last Name">
                    <Input value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} placeholder="Donovan" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Email">
                    <Input value={profile.email} disabled placeholder="Email" className={cn(surfaceInputClass, "opacity-60 cursor-not-allowed")} />
                    <p className="text-[11px] text-muted-foreground">Email is managed through your auth provider</p>
                  </FieldRow>
                  <FieldRow label="Phone">
                    <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Job Title">
                    <Input value={profile.title} onChange={(e) => setProfile((p) => ({ ...p, title: e.target.value }))} placeholder="Senior Agent" className={surfaceInputClass} />
                  </FieldRow>
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={updateSettings.isPending}
                  className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2"
                >
                  {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </Section>
            )}

            {/* ─── Business / Branding ──────────────────── */}
            {activeTab === "branding" && (
              <Section title="Business & Branding" subtitle="Your agency info and branding assets.">
                <div className="flex items-center gap-4">
                  <ImageUploader
                    current={business.businessLogoUrl}
                    fallback={business.businessName?.[0]?.toUpperCase() ?? "B"}
                    field="logo"
                    shape="rounded"
                    onUploaded={(url) => setBusiness((b) => ({ ...b, businessLogoUrl: url }))}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Business Logo</p>
                    <p className="text-xs text-muted-foreground">Displayed in documents and reports · max 4 MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldRow label="Business Name">
                    <Input value={business.businessName} onChange={(e) => setBusiness((b) => ({ ...b, businessName: e.target.value }))} placeholder="My Real Estate Agency" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Your Position">
                    <Input value={business.position} onChange={(e) => setBusiness((b) => ({ ...b, position: e.target.value }))} placeholder="Managing Director" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Business Phone / WhatsApp">
                    <Input value={business.whatsappNumber} onChange={(e) => setBusiness((b) => ({ ...b, whatsappNumber: e.target.value }))} placeholder="+1 (555) 000-0000" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Team Size">
                    <Input value={business.teamSize} onChange={(e) => setBusiness((b) => ({ ...b, teamSize: e.target.value }))} placeholder="e.g. 2–5" className={surfaceInputClass} />
                  </FieldRow>
                  <FieldRow label="Office Address">
                    <Input value={business.officeAddress} onChange={(e) => setBusiness((b) => ({ ...b, officeAddress: e.target.value }))} placeholder="123 Main St, Beverly Hills, CA" className={cn(surfaceInputClass, "sm:col-span-2")} />
                  </FieldRow>
                </div>

                <div className="pt-1">
                  <Button
                    onClick={saveBusiness}
                    disabled={updateSettings.isPending}
                    className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2"
                  >
                    {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </Section>
            )}

            {/* ─── Appearance ───────────────────────────── */}
            {activeTab === "appearance" && (
              <Section title="Appearance" subtitle="Customize how your CRM looks and feels. Changes apply instantly across the entire app.">

                {/* Theme picker */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Color Theme</label>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-md bg-secondary">
                      {THEMES.find(t => t.id === theme)?.name ?? "Gold"}
                    </span>
                  </div>

                  {/* Theme pairs: one row per color family, light + dark side by side */}
                  <div className="space-y-5">
                    {THEME_PAIRS.map((pair) => {
                      const ThemeCard = ({ t }: { t: typeof pair.light }) => {
                        const active = theme === t.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            className={cn(
                              "relative flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all duration-150 w-full",
                              active
                                ? "border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                                : "border-border/40 hover:border-border hover:shadow-md hover:scale-[1.005]"
                            )}
                          >
                            {/* Mini UI preview */}
                            <div className="flex h-[72px] w-full overflow-hidden" style={{ background: t.preview.bg }}>
                              {/* Sidebar strip */}
                              <div
                                className="w-7 h-full flex flex-col gap-1 p-1 shrink-0"
                                style={{ background: t.preview.sidebar, borderRight: `1px solid ${t.preview.border}` }}
                              >
                                <div className="w-3.5 h-1.5 rounded-sm mt-0.5" style={{ background: t.preview.primary }} />
                                {[1,2,3,4].map(i => (
                                  <div key={i} className="h-1 rounded-sm" style={{ background: i === 1 ? t.preview.primary + "45" : t.preview.muted + "50", width: i === 1 ? "100%" : "75%" }} />
                                ))}
                              </div>
                              {/* Content area */}
                              <div className="flex-1 p-1.5 flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <div className="h-1.5 rounded-sm flex-1" style={{ background: t.preview.muted + "55" }} />
                                  <div className="h-3.5 w-3.5 rounded-full" style={{ background: t.preview.primary }} />
                                </div>
                                <div className="grid grid-cols-3 gap-1 flex-1">
                                  {[1,2,3].map(i => (
                                    <div key={i} className="rounded-md p-1 flex flex-col gap-0.5"
                                      style={{ background: t.preview.card, border: `1px solid ${t.preview.border}` }}>
                                      <div className="h-1 w-3/4 rounded-sm" style={{ background: t.preview.muted + "75" }} />
                                      <div className="h-1.5 w-full rounded-sm" style={{ background: i === 1 ? t.preview.primary + "80" : t.preview.text + "25" }} />
                                    </div>
                                  ))}
                                </div>
                                <div className="rounded-md px-1 py-0.5 flex gap-1"
                                  style={{ background: t.preview.card, border: `1px solid ${t.preview.border}` }}>
                                  <div className="h-1 flex-1 rounded-sm" style={{ background: t.preview.muted + "55" }} />
                                  <div className="h-1 w-5 rounded-sm" style={{ background: t.preview.primary + "65" }} />
                                </div>
                              </div>
                            </div>
                            {/* Label row */}
                            <div
                              className="flex items-center justify-between px-2.5 py-1.5"
                              style={{ background: t.preview.card, borderTop: `1px solid ${t.preview.border}` }}
                            >
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: t.preview.text }}>
                                  {t.dark ? "Dark" : "Light"}
                                </p>
                                <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: t.preview.muted }}>{t.description}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {t.swatches.slice(0,2).map((s, si) => (
                                  <div key={si} className="h-2.5 w-2.5 rounded-full border" style={{ background: s, borderColor: t.preview.border }} />
                                ))}
                                {active && (
                                  <div className="h-4 w-4 rounded-full flex items-center justify-center"
                                    style={{ background: t.preview.primary }}>
                                    <Check className="h-2.5 w-2.5" style={{ color: "white" }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      }
                      return (
                        <div key={pair.label} className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{pair.label}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <ThemeCard t={pair.light} />
                            <ThemeCard t={pair.dark} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Time Format */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Time Format</label>
                  <div className="flex gap-3">
                    {[
                      { id: "12h", label: "12-hour", sample: "3:00 PM" },
                      { id: "24h", label: "24-hour", sample: "15:00" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleTimeFormatChange(opt.id as "12h" | "24h")}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all",
                          timeFormat === opt.id
                            ? "border-primary bg-primary/10"
                            : "border-border/50 hover:border-primary/50 hover:bg-secondary/30"
                        )}
                      >
                        <Clock className={cn("h-5 w-5", timeFormat === opt.id ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", timeFormat === opt.id ? "text-primary" : "text-muted-foreground")}>
                          {opt.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{opt.sample}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* ─── Notifications ────────────────────────── */}
            {activeTab === "notifications" && (
              <Section title="Notifications" subtitle="Choose when and how you want to be notified.">
                <div className="space-y-3">
                  <NotifRow
                    label="New Lead Assigned"
                    description="Get notified when a new lead is assigned to you"
                    checked={notifs.newLeadNotif}
                    onChange={(v) => handleNotifToggle("newLeadNotif", v)}
                    saving={savingNotif}
                  />
                  <NotifRow
                    label="Deal Status Change"
                    description="When a deal moves through the pipeline stages"
                    checked={notifs.dealStatusNotif}
                    onChange={(v) => handleNotifToggle("dealStatusNotif", v)}
                    saving={savingNotif}
                  />
                  <NotifRow
                    label="WhatsApp Messages"
                    description="Get notified when a lead replies via WhatsApp"
                    checked={notifs.whatsappNotif}
                    onChange={(v) => handleNotifToggle("whatsappNotif", v)}
                    saving={savingNotif}
                  />
                  <NotifRow
                    label="Weekly Performance Report"
                    description="A weekly summary of your leads, deals, and activities"
                    checked={notifs.weeklyReportsEnabled}
                    onChange={(v) => handleNotifToggle("weeklyReportsEnabled", v)}
                    saving={savingNotif}
                  />
                </div>
                {savingNotif && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </p>
                )}
              </Section>
            )}

            {/* ─── Security ────────────────────────────── */}
            {activeTab === "security" && (
              <div className="space-y-4">

                {/* Two-Factor Authentication */}
                <div className="glass-card p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Smartphone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Two-Factor Authentication</h3>
                      <p className="text-sm text-muted-foreground">Use an authenticator app for a second layer of security</p>
                    </div>
                    {mfaLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />}
                    {!mfaLoading && activeMfaFactor && (
                      <Badge className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-medium">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Enabled
                      </Badge>
                    )}
                    {!mfaLoading && !activeMfaFactor && (
                      <Badge variant="outline" className="ml-auto text-xs text-muted-foreground">Not enabled</Badge>
                    )}
                  </div>

                  {/* Enrollment flow */}
                  <AnimatePresence>
                    {mfaEnrollData ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-5">
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-1">Step 1 — Scan with your authenticator app</p>
                            <p className="text-xs text-muted-foreground">Open Google Authenticator, Authy, or any TOTP app and scan the QR code below.</p>
                          </div>

                          {/* QR Code */}
                          <div className="flex flex-col sm:flex-row gap-5 items-start">
                            <div className="flex-shrink-0 rounded-xl border-2 border-border bg-white p-2 shadow-sm">
                              <div
                                className="h-40 w-40 [&_svg]:w-full [&_svg]:h-full [&_svg]:max-w-full"
                                dangerouslySetInnerHTML={{ __html: mfaEnrollData.qrCode }}
                              />
                            </div>
                            <div className="space-y-3 flex-1">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Can't scan? Enter this key manually:</p>
                                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                                  <code className="text-xs font-mono text-foreground flex-1 break-all select-all">
                                    {mfaEnrollData.secret}
                                  </code>
                                  <button onClick={copySecret} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                                    {secretCopied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  Save this key somewhere safe. It lets you recover access if you lose your authenticator app.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Verify */}
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">Step 2 — Enter the 6-digit code from your app</p>
                            <div className="flex gap-3">
                              <Input
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className={cn(surfaceInputClass, "font-mono text-center text-lg tracking-widest w-40")}
                                onKeyDown={(e) => e.key === "Enter" && verifyMfaCode()}
                              />
                              <Button
                                onClick={verifyMfaCode}
                                disabled={mfaCode.length < 6 || mfaVerifying}
                                className="bg-primary hover:bg-primary/90 gap-2"
                              >
                                {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                Verify & Enable
                              </Button>
                              <Button variant="outline" onClick={cancelMfaEnrollment}>Cancel</Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {activeMfaFactor ? (
                          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5">
                            <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">Your account is protected with 2FA</p>
                              <p className="text-xs text-muted-foreground">Authenticator app is linked and active</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disableMfa(activeMfaFactor.id)}
                              disabled={mfaDisabling}
                              className="flex-shrink-0 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
                            >
                              {mfaDisabling ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disable"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={startMfaEnrollment}
                            disabled={mfaEnrolling}
                            className="bg-primary hover:bg-primary/90 gap-2"
                          >
                            {mfaEnrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                            Set Up Authenticator App
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Change Password */}
                <div className="glass-card p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Change Password</h3>
                      <p className="text-sm text-muted-foreground">Update your account password anytime</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <FieldRow label="New Password">
                      <PasswordInput
                        value={pwForm.newPassword}
                        onChange={(v) => setPwForm((f) => ({ ...f, newPassword: v }))}
                        placeholder="Minimum 8 characters"
                        show={showNewPw}
                        onToggleShow={() => setShowNewPw((s) => !s)}
                      />
                      {pwForm.newPassword.length > 0 && (
                        <div className="space-y-1 mt-1.5">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1 flex-1 rounded-full transition-all duration-300",
                                  i <= pwStrength ? pwStrengthColor : "bg-border"
                                )}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">{pwStrengthLabel}</p>
                        </div>
                      )}
                    </FieldRow>

                    <FieldRow label="Confirm New Password">
                      <PasswordInput
                        value={pwForm.confirmPassword}
                        onChange={(v) => setPwForm((f) => ({ ...f, confirmPassword: v }))}
                        placeholder="Re-enter new password"
                        show={showConfirmPw}
                        onToggleShow={() => setShowConfirmPw((s) => !s)}
                      />
                      {pwForm.confirmPassword.length > 0 && pwForm.newPassword !== pwForm.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                      {pwForm.confirmPassword.length > 0 && pwForm.newPassword === pwForm.confirmPassword && (
                        <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Passwords match
                        </p>
                      )}
                    </FieldRow>

                    <Button
                      onClick={changePassword}
                      disabled={pwLoading || !pwForm.newPassword || !pwForm.confirmPassword}
                      className="bg-primary hover:bg-primary/90 gap-2"
                    >
                      {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                      Update Password
                    </Button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="glass-card p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                      <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Active Sessions</h3>
                      <p className="text-sm text-muted-foreground">Devices currently signed into your account</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Current session */}
                    <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 flex-shrink-0">
                        <Globe className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{browser} on {os}</p>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            Current
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Signed in · Expires {session?.expires_at
                            ? new Date(session.expires_at * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"
                          }
                        </p>
                      </div>
                    </div>

                    {/* Sign out other devices */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-secondary/10 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                          <LogOut className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Sign out everywhere else</p>
                          <p className="text-xs text-muted-foreground">Revoke access from all other devices and browsers</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={signOutOtherSessions}
                        disabled={signingOutOthers}
                        className="flex-shrink-0"
                      >
                        {signingOutOthers ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sign Out Others"}
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ─── Connected Accounts ───────────────────── */}
            {activeTab === "accounts" && (
              <ConnectedAccountsTab
                connectedProvider={connectedProvider}
                errorMessage={oauthError}
              />
            )}

            {/* ─── Account ──────────────────────────────── */}
            {activeTab === "account" && (
              <div className="space-y-4">

                {/* Account Overview */}
                <div className="glass-card p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <UserCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Account Overview</h3>
                      <p className="text-sm text-muted-foreground">Your account details and membership info</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: "Email Address", value: session?.user?.email ?? "—", mono: false },
                      { label: "Member Since",  value: memberSince, mono: false },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-secondary/10 px-4 py-3.5">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground">Plan & Billing</h3>
                      <p className="text-sm text-muted-foreground">Your current subscription plan</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">Free Plan</Badge>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-secondary/10 px-4 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">LuxeState CRM — Free</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Unlimited leads, deals, and basic analytics</p>
                    </div>
                    <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                      Upgrade
                    </Button>
                  </div>
                </div>

                {/* Tour Guide Restart */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Product Tour</h3>
                      <p className="text-sm text-muted-foreground">Restart the interactive walkthrough of LuxeState CRM</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-secondary/10 px-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Restart tour guide</p>
                      <p className="text-xs text-muted-foreground">The tour will begin on your next visit to the dashboard</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const uid = session?.user?.id
                        if (uid) {
                          localStorage.removeItem(`lxs-tour-done-${uid}`)
                          toast.success("Tour restarted — refresh the dashboard to begin")
                        }
                      }}
                      className="flex-shrink-0 gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Restart Tour
                    </Button>
                  </div>
                </div>

                {/* Data Export */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50">
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Export Your Data</h3>
                      <p className="text-sm text-muted-foreground">Download all your leads, deals, and properties as JSON</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-secondary/10 px-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Full data export</p>
                      <p className="text-xs text-muted-foreground">Leads, deals, and properties in JSON format</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportData}
                      disabled={exportLoading}
                      className="flex-shrink-0 gap-1.5"
                    >
                      {exportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Export
                    </Button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="glass-card p-6 space-y-4 border border-red-500/20">
                  <div>
                    <h3 className="text-base font-semibold text-red-500">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Irreversible actions — proceed with extreme caution</p>
                  </div>

                  {/* Sign out everywhere */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/10 bg-red-500/5 px-4 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Sign out of all devices</p>
                      <p className="text-xs text-muted-foreground">End all active sessions, including this one</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => signOut()}
                      className="flex-shrink-0 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" />
                      Sign Out All
                    </Button>
                  </div>

                  {/* Delete account */}
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Delete Account</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account, all data, leads, and integrations. This cannot be undone.</p>
                      </div>
                      {!showDeleteConfirm && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex-shrink-0 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete Account
                        </Button>
                      )}
                    </div>

                    <AnimatePresence>
                      {showDeleteConfirm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pt-1">
                            <p className="text-xs font-medium text-red-500">
                              Type <span className="font-mono font-bold">DELETE</span> to confirm
                            </p>
                            <Input
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="Type DELETE to confirm"
                              className={cn(surfaceInputClass, "border-red-500/30 focus:border-red-500/60")}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={deleteConfirmText !== "DELETE"}
                                className="bg-red-500 hover:bg-red-600 text-white gap-1.5 disabled:opacity-40"
                                onClick={() => toast.error("Account deletion requires contacting support. Please email support@luxestate.app")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Permanently Delete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* ─── WhatsApp ─────────────────────────────── */}
            {activeTab === "whatsapp" && <WhatsAppSettingsTab />}

            {/* ─── Privacy & Security ───────────────────── */}
            {activeTab === "privacy" && <PrivacyTab />}

            {/* ─── Support ──────────────────────────────── */}
            {activeTab === "support" && <SupportTab />}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PRIVACY TAB
// ──────────────────────────────────────────────────────────────────────────────
function PrivacyTab() {
  const { data: privData, isPending: privLoading } = usePrivacySettings()
  const { data: auditData } = usePrivacyAuditLog()
  const toggleAccess = useToggleSupportAccess()
  const exportData = useDataExport()
  const [exportTypes, setExportTypes] = useState<string[]>(["leads", "deals", "properties", "contacts"])
  const [exporting, setExporting] = useState(false)

  const settings = privData?.settings
  const accessEnabled: boolean = settings?.support_access_enabled ?? false
  const auditLogs: any[] = auditData?.data ?? []

  const handleToggle = async () => {
    const next = !accessEnabled
    try {
      await toggleAccess.mutateAsync(next)
      toast.success(next ? "Support access enabled" : "Support access disabled")
    } catch {
      toast.error("Failed to update support access")
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportData.mutateAsync(exportTypes)
      if (result.error) { toast.error(result.error); return }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `luxestate-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Data exported successfully")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  const EXPORT_TYPES = [
    { id: "leads",      label: "Leads" },
    { id: "deals",      label: "Deals" },
    { id: "properties", label: "Properties" },
    { id: "contacts",   label: "Contacts" },
    { id: "documents",  label: "Documents Metadata" },
  ]

  return (
    <div className="space-y-4">
      {/* Trust Banner */}
      <div className="glass-card p-5 border-l-4 border-l-primary bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Your Data is Yours</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Your business data remains private. CRM administrators cannot access your leads, conversations, documents, or customer information unless you explicitly enable support access.
            </p>
          </div>
        </div>
      </div>

      {/* Data Ownership */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center">
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Data Ownership</h3>
            <p className="text-sm text-muted-foreground">You own all data in your organization</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { icon: "👤", label: "Leads & Contacts", desc: "Names, phones, emails — fully private" },
            { icon: "💬", label: "Conversations", desc: "WhatsApp & message history — isolated" },
            { icon: "📄", label: "Documents", desc: "Files and metadata — your control only" },
            { icon: "🏠", label: "Deals & Properties", desc: "Transaction data — never shared" },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-border/50 bg-secondary/10 px-4 py-3.5 flex items-start gap-3">
              <span className="text-base mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support Access */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accessEnabled ? "bg-amber-100" : "bg-secondary/50")}>
            <Lock className={cn("h-4 w-4", accessEnabled ? "text-amber-600" : "text-muted-foreground")} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">Support Access</h3>
            <p className="text-sm text-muted-foreground">Allow support staff to access your data for troubleshooting</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggleAccess.isPending || privLoading}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: accessEnabled ? "hsl(var(--primary))" : "hsl(var(--secondary))" }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform"
              style={{ transform: accessEnabled ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
        </div>
        {accessEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-500/30 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Support Access is Active</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 leading-relaxed">
                  Support staff can temporarily access your organization's data for troubleshooting. All access is logged. Disable when your issue is resolved.
                </p>
                {settings?.support_access_enabled_at && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Enabled: {format(new Date(settings.support_access_enabled_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Only organization admins can change this setting. All changes are logged for your review.
        </p>
      </div>

      {/* Data Export */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center">
            <FileDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Data Export</h3>
            <p className="text-sm text-muted-foreground">Download a copy of your organization's data</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPORT_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setExportTypes(prev =>
                prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
              )}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                exportTypes.includes(t.id)
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
              )}
            >
              <Check className={cn("h-3 w-3", exportTypes.includes(t.id) ? "opacity-100" : "opacity-0")} />
              {t.label}
            </button>
          ))}
        </div>
        <Button
          onClick={handleExport}
          disabled={exportTypes.length === 0 || exporting}
          variant="outline"
          className="gap-2"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Selected Data
        </Button>
        <p className="text-xs text-muted-foreground">Data is exported as JSON. All exports are logged in your audit history.</p>
      </div>

      {/* Data Deletion Policy */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Data Deletion Policy</h3>
            <p className="text-sm text-muted-foreground">What happens to your data when you leave</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            "Your data is retained for 30 days after account closure for recovery purposes.",
            "After 30 days, all leads, deals, conversations, and documents are permanently deleted.",
            "Backup snapshots are deleted within 90 days.",
            "To request immediate deletion, contact support@luxestate.app.",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      {auditLogs.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Privacy Audit Log</h3>
              <p className="text-sm text-muted-foreground">Recent privacy and access events</p>
            </div>
          </div>
          <div className="space-y-2">
            {auditLogs.slice(0, 10).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full shrink-0", {
                    "bg-amber-400": log.action === "support_access_enabled",
                    "bg-green-500": log.action === "support_access_disabled",
                    "bg-blue-500": log.action === "data_exported",
                    "bg-muted-foreground": true,
                  })} />
                  <p className="text-xs font-medium text-foreground capitalize">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  {(log.first_name || log.last_name) && (
                    <p className="text-xs text-muted-foreground">by {log.first_name} {log.last_name}</p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{format(new Date(log.created_at), "MMM d, h:mm a")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// SUPPORT TAB
// ──────────────────────────────────────────────────────────────────────────────
function SupportTab() {
  const { data, isPending } = useTickets()
  const tickets: any[] = data?.data ?? []
  const [view, setView] = useState<"list" | "new" | "ticket">("list")
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [replyText, setReplyText] = useState("")
  const create = useCreateTicket()
  const { data: ticketData, isFetching: ticketLoading } = useTicket(activeTicketId)
  const send = useSendMessage(activeTicketId ?? 0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const openTickets = tickets.filter(t => ["open", "in_progress", "waiting_customer"].includes(t.status))
  const closedTickets = tickets.filter(t => ["resolved", "closed"].includes(t.status))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticketData?.messages?.length])

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return
    const res = await create.mutateAsync({ subject: subject.trim(), message: message.trim() })
    if (!res.error) { setSubject(""); setMessage(""); setView("list"); toast.success("Support ticket created") }
  }

  const handleReply = async () => {
    if (!replyText.trim() || !activeTicketId) return
    const msg = replyText.trim()
    setReplyText("")
    await send.mutateAsync(msg)
  }

  const ticket = ticketData?.ticket
  const messages: any[] = ticketData?.messages ?? []

  const FAQS = [
    { q: "How do I connect my WhatsApp number?", a: "Go to Settings → Connected Accounts → WhatsApp. You'll need a Meta Business account." },
    { q: "How do I invite team members?", a: "Go to Settings → Business → scroll to Team Management and click Invite Member." },
    { q: "Why can't I see some features?", a: "Feature access depends on your subscription plan. Visit the Billing page to upgrade." },
    { q: "How do I bulk import leads?", a: "On the Leads page, click the import icon and upload a CSV with the required columns." },
    { q: "How do I export my data?", a: "Go to Settings → Privacy & Security → Data Export and select what to export." },
    { q: "How do I reset my password?", a: "Sign out and use the 'Forgot Password' link on the sign-in page." },
  ]

  if (view === "new") return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          Back
        </button>
        <h3 className="text-base font-semibold text-foreground">New Support Ticket</h3>
      </div>
      <div className="glass-card p-6 space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            🔒 <strong className="text-foreground">Privacy reminder:</strong> Your business data remains private. Support staff cannot access your leads, conversations, or customer information unless you explicitly enable support access in the Privacy & Security tab.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Subject</label>
          <Input
            placeholder="Brief description of your issue"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className={surfaceInputClass}
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Message</label>
          <textarea
            className={cn(surfaceInputClass, "w-full resize-none min-h-[120px]")}
            placeholder="Describe your issue in detail..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={!subject.trim() || !message.trim() || create.isPending} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeadphonesIcon className="h-4 w-4" />}
            Submit Ticket
          </Button>
          <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
        </div>
      </div>
    </div>
  )

  if (view === "ticket" && activeTicketId) return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => { setView("list"); setActiveTicketId(null) }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          Back to Tickets
        </button>
        {ticket && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", STATUS_COLORS[ticket.status as TicketStatus])}>
            {STATUS_LABELS[ticket.status as TicketStatus]}
          </span>
        )}
        {ticketLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {ticket && <h3 className="text-base font-semibold text-foreground">{ticket.subject}</h3>}
      <div className="glass-card overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.map(msg => {
            const isSupport = msg.sender_type === "support"
            return (
              <div key={msg.id} className={cn("flex gap-3", isSupport ? "flex-row" : "flex-row-reverse")}>
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isSupport ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  {isSupport ? "🛡️" : `${msg.first_name?.[0] ?? ""}${msg.last_name?.[0] ?? ""}`}
                </div>
                <div className={cn("max-w-[75%] flex flex-col", isSupport ? "items-start" : "items-end")}>
                  <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isSupport
                      ? "bg-secondary text-foreground rounded-tl-none"
                      : "bg-primary text-primary-foreground rounded-tr-none"
                  )}>
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(msg.created_at), "MMM d, h:mm a")}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        {ticket && !["resolved", "closed"].includes(ticket.status) && (
          <div className="border-t p-3 flex gap-2">
            <textarea
              className={cn(surfaceInputClass, "flex-1 resize-none min-h-[40px] max-h-[100px] text-sm py-2")}
              placeholder="Reply to support..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply() } }}
              rows={1}
            />
            <Button onClick={handleReply} disabled={!replyText.trim() || send.isPending} size="sm">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Support Status */}
      <div className="glass-card p-5 border-l-4 border-l-green-500 bg-green-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-foreground">Support is Online</p>
              <p className="text-xs text-muted-foreground mt-0.5">Average response time: 2–4 hours during business hours</p>
            </div>
          </div>
          <Button onClick={() => setView("new")} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Trust message */}
      <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          🔒 <strong className="text-foreground">Your data stays private.</strong> Support staff cannot view your leads, conversations, documents, or customer data unless you enable Support Access in Privacy & Security settings.
        </p>
      </div>

      {/* Open tickets */}
      {openTickets.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Open Tickets ({openTickets.length})</h3>
          <div className="space-y-2">
            {openTickets.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTicketId(t.id); setView("ticket") }}
                className="w-full text-left rounded-xl border border-border/60 bg-background hover:border-primary/30 hover:bg-secondary/30 transition-all px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.message_count} message{t.message_count !== 1 ? "s" : ""} · {format(new Date(t.updated_at), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", STATUS_COLORS[t.status as TicketStatus])}>
                      {STATUS_LABELS[t.status as TicketStatus]}
                    </span>
                    <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Closed tickets */}
      {closedTickets.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Ticket History</h3>
          <div className="space-y-2">
            {closedTickets.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTicketId(t.id); setView("ticket") }}
                className="w-full text-left rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground truncate flex-1">{t.subject}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", STATUS_COLORS[t.status as TicketStatus])}>
                      {STATUS_LABELS[t.status as TicketStatus]}
                    </span>
                    <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tickets.length === 0 && !isPending && (
        <div className="glass-card p-10 text-center space-y-3">
          <HeadphonesIcon className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-sm font-medium text-foreground">No tickets yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a support ticket and our team will respond shortly</p>
          </div>
          <Button onClick={() => setView("new")} className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            Create First Ticket
          </Button>
        </div>
      )}

      {/* FAQ */}
      <div className="glass-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Frequently Asked Questions</h3>
            <p className="text-sm text-muted-foreground">Quick answers to common questions</p>
          </div>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors">
        <p className="text-sm font-medium text-foreground">{question}</p>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

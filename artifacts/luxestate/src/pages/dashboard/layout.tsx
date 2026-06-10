import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { Link } from "wouter"
import { Sidebar } from "@/components/dashboard/sidebar"
import { NotificationsPanel, type Notification } from "@/components/dashboard/notifications-panel"
import { SupportChatWidget } from "@/components/dashboard/support-chat-widget"
import { ReactNode } from "react"
import { motion } from "framer-motion"
import { Bell, Search, Clock, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PWAInstallButton } from "@/components/pwa-install-button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { useCurrentUser } from "@/lib/user-api"
import { useSettings, useUpdateSettings } from "@/lib/settings-api"
import { useLeads } from "@/lib/leads-api"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
  useDismissNotification,
  type ApiNotification,
} from "@/lib/notifications-api"
import { cn } from "@/lib/utils"
import { CRMTour } from "@/components/tour/CRMTour"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":              "Overview",
  "/dashboard/leads":        "Leads",
  "/dashboard/properties":   "Properties",
  "/dashboard/messages":     "Messages",
  "/dashboard/analytics":    "Analytics",
  "/dashboard/ai-intelligence": "AI Intelligence",
  "/dashboard/ai-usage":        "AI Intelligence",
  "/dashboard/automations":  "Automations",
  "/dashboard/team":         "Team",
  "/dashboard/deals":        "Deals",
  "/dashboard/documents":    "Documents",
  "/dashboard/calendar":     "Calendar",
  "/dashboard/settings":     "Settings",
  "/dashboard/integrations": "Lead Sources",
  "/dashboard/dealers":      "Dealers",
}


function getPageTitle(location: string): string {
  if (PAGE_TITLES[location]) return PAGE_TITLES[location]
  if (location.startsWith("/dashboard/leads/")) return "Lead Profile"
  return "Dashboard"
}

function toUiNotification(n: ApiNotification, now: Date): Notification {
  const created = new Date(n.createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  let time: string
  if (diffMin < 1) time = "Just now"
  else if (diffMin < 60) time = `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`
  else if (diffHr < 24) time = `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`
  else time = `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`

  const isToday = diffHr < 24

  const allowedTypes = ["lead", "message", "reminder", "deal", "property", "team", "system"] as const
  type AllowedType = typeof allowedTypes[number]
  const type: AllowedType = allowedTypes.includes(n.type as AllowedType) ? (n.type as AllowedType) : "system"

  return {
    id: n.id,
    type,
    title: n.title,
    description: n.body ?? "",
    time,
    read: n.read,
    group: isToday ? "today" : "earlier",
  }
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  const { data: settingsData } = useSettings()
  const updateSettings = useUpdateSettings()

  const savedFmt = (settingsData?.settings?.time_format as "12h" | "24h" | null | undefined) ?? "12h"
  const [fmt, setFmt] = useState<"12h" | "24h">(savedFmt)

  useEffect(() => {
    if (savedFmt) setFmt(savedFmt)
  }, [savedFmt])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: fmt === "12h",
  })

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const toggleFmt = () => {
    const next = fmt === "12h" ? "24h" : "12h"
    setFmt(next)
    updateSettings.mutate({ timeFormat: next })
  }

  return (
    <button
      onClick={toggleFmt}
      title={`Switch to ${fmt === "12h" ? "24-hour" : "12-hour"} format`}
      className="hidden sm:flex items-center gap-2.5 rounded-xl px-3 py-1.5 hover:bg-secondary/70 transition-colors group"
    >
      <Clock className="h-4 w-4 text-primary shrink-0" />
      <div className="flex flex-col items-start leading-none">
        <span className="text-sm font-semibold tabular-nums text-foreground tracking-tight">
          {timeStr}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {dateStr}
        </span>
      </div>
    </button>
  )
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const { data: leads = [] } = useLeads()
  const [, navigate] = useLocation()

  const trimmed = query.trim().toLowerCase()
  const results = trimmed.length < 2 ? [] : leads
    .filter((l) =>
      l.name?.toLowerCase().includes(trimmed) ||
      l.email?.toLowerCase().includes(trimmed) ||
      l.phone?.toLowerCase().includes(trimmed)
    )
    .slice(0, 8)

  const handleSelect = (id: number) => {
    onClose()
    setQuery("")
    navigate(`/dashboard/leads/${id}`)
  }

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name, email or phone…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {trimmed.length < 2 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No leads found for "{query}"
            </div>
          ) : (
            <div className="p-1.5">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Leads · {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => handleSelect(lead.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {lead.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.email || lead.phone || "No contact"}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GlobalHeader({
  unreadCount, notifOpen, onToggleNotif,
}: {
  unreadCount: number; notifOpen: boolean; onToggleNotif: () => void
}) {
  const [location] = useLocation()
  const { user } = useAuth()
  const { data: profile } = useCurrentUser(user?.id)
  const [searchOpen, setSearchOpen] = useState(false)
  const title = getPageTitle(location)

  const displayName =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : user?.email?.split("@")[0] || "User"

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border/40 bg-card/60 px-6 backdrop-blur-sm lg:px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-1">
          <LiveClock />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setSearchOpen(true)}
            title="Search leads"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleNotif}
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          <Link href="/dashboard/settings">
            <div className="ml-2 cursor-pointer">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-border/40 hover:ring-primary/50 transition-all"
                  title="Profile Settings"
                />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-sm font-semibold text-primary-foreground hover:ring-2 hover:ring-primary/40 transition-all"
                  title="Profile Settings"
                >
                  {initials}
                </div>
              )}
            </div>
          </Link>
        </div>
      </header>
    </>
  )
}

type DashboardLayoutProps = { children: ReactNode }

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true" } catch { return false }
  })

  const handleSetCollapsed = (v: boolean) => {
    setCollapsed(v)
    try { localStorage.setItem("sidebar-collapsed", String(v)) } catch {}
  }

  const [notifOpen, setNotifOpen] = useState(false)
  const nowRef = useRef(new Date())

  const { data: apiNotifs = [] }    = useNotifications()
  const markRead                    = useMarkNotificationRead()
  const markAllRead                 = useMarkAllRead()
  const dismiss                     = useDismissNotification()

  useEffect(() => { nowRef.current = new Date() })

  const notifications: Notification[] = apiNotifs.map((n) => toUiNotification(n, nowRef.current))
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkRead    = (id: number) => markRead.mutate(id)
  const handleMarkAllRead = ()           => markAllRead.mutate()
  const handleDismiss     = (id: number) => dismiss.mutate(id)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <PWAInstallButton variant="banner" />
      <Sidebar
        collapsed={collapsed}
        setCollapsed={handleSetCollapsed}
        notifOpen={notifOpen}
        onToggleNotif={() => setNotifOpen((v) => !v)}
        unreadCount={unreadCount}
      />
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDismiss={handleDismiss}
        sidebarWidth={collapsed ? 72 : 240}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <GlobalHeader
          unreadCount={unreadCount}
          notifOpen={notifOpen}
          onToggleNotif={() => setNotifOpen((v) => !v)}
        />
        <motion.main
          className="flex-1 overflow-y-auto"
          animate={{ marginLeft: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="min-h-full p-6 lg:p-8">
            {children}
          </div>
        </motion.main>
      </div>
      <SupportChatWidget />
      <CRMTour onExpand={() => handleSetCollapsed(false)} />
    </div>
  )
}

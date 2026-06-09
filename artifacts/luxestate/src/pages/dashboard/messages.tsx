import { useState, useEffect, useRef, useCallback } from "react"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { usePlan } from "@/lib/plan-context"
import { apiFetch } from "@/lib/api-fetch"
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  updateConversationStatus,
  formatMessageTime,
  type Conversation,
  type Message,
} from "@/lib/messaging-api"
import {
  MessageCircle, Search, Plus, Send, Phone, Mail,
  CheckCheck, Check, Clock, MoreVertical, X,
  Loader2, MessageSquare, Archive, RefreshCw, StickyNote,
  Sparkles, Copy, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { toast } from "sonner"
import { useWhatsAppStatus } from "@/lib/whatsapp-api"
import { useWaAccounts } from "@/lib/whatsapp-accounts-api"
import { useLocation } from "wouter"

// ─── Avatar ───────────────────────────────────────────────

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" }[size]
  return (
    <div className={cn("flex flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary", sz)}>
      {initials?.slice(0, 2).toUpperCase() || "?"}
    </div>
  )
}

// ─── Message status icon ──────────────────────────────────

function StatusIcon({ status, direction }: { status: string; direction: string }) {
  if (direction !== "outbound") return null
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
  return <Check className="h-3.5 w-3.5 text-muted-foreground" />
}

// ─── New Conversation Modal ───────────────────────────────

function NewConvModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (data: { name: string; phone?: string; email?: string }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined })
      onClose()
    } catch {
      toast.error("Failed to create conversation")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">New Conversation</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name" className="text-sm font-medium">Contact Name *</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Khan" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone" className="text-sm font-medium">Phone (WhatsApp)</Label>
            <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000" type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email" className="text-sm font-medium">Email</Label>
            <Input id="contact-email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com" type="email" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Conversation
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Conversation List Item ───────────────────────────────

function ConvItem({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  const name = conv.contact?.name ?? conv.title ?? "Unknown"
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
        active ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/50"
      )}
    >
      <div className="relative">
        <Avatar initials={initials} />
        {conv.channel === "whatsapp" && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[8px] text-white font-bold">W</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm", active ? "font-semibold text-foreground" : "font-medium text-foreground")}>{name}</p>
          <span className="flex-shrink-0 text-[10px] text-muted-foreground">{formatMessageTime(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="truncate text-xs text-muted-foreground">{conv.last_message ?? "No messages yet"}</p>
          {conv.unread_count > 0 && (
            <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {conv.unread_count > 9 ? "9+" : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message Bubble ───────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === "outbound"
  const isNote = msg.type === "note"
  return (
    <div className={cn("flex gap-2", isOut ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
        isNote
          ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 italic rounded-xl"
          : isOut
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-bl-sm"
      )}>
        {isNote && <span className="mr-1.5 text-[10px] font-semibold not-italic uppercase tracking-wide">Note · </span>}
        <p className="leading-relaxed">{msg.content}</p>
        <div className={cn("mt-1 flex items-center gap-1", isOut ? "justify-end" : "justify-start")}>
          <span className="text-[10px] opacity-60">{formatMessageTime(msg.created_at)}</span>
          <StatusIcon status={msg.status} direction={msg.direction} />
        </div>
      </div>
    </div>
  )
}

// ─── AI Reply Suggestions Strip ───────────────────────────

interface AISuggestionsProps {
  conversationId: string
  onSelect: (text: string) => void
  onSend: (text: string) => void
  disabled: boolean
}

function AISuggestions({ conversationId, onSelect, onSend, disabled }: AISuggestionsProps) {
  const [expanded, setExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchSuggestions = async () => {
    if (fetched) { setExpanded(true); return }
    setLoading(true)
    setExpanded(true)
    try {
      const res = await apiFetch("/ai/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      })
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setFetched(true)
    } catch {
      toast.error("Could not generate reply suggestions")
      setExpanded(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!")).catch(() => {})
  }

  const handleRefresh = async () => {
    setFetched(false)
    setSuggestions([])
    setLoading(true)
    try {
      const res = await apiFetch("/ai/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      })
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setFetched(true)
    } catch {
      toast.error("Could not refresh suggestions")
    } finally {
      setLoading(false)
    }
  }

  // Reset when conversation changes
  useEffect(() => {
    setExpanded(false)
    setSuggestions([])
    setFetched(false)
  }, [conversationId])

  return (
    <div className="border-t border-border/50">
      {/* Toggle bar */}
      <button
        onClick={expanded ? () => setExpanded(false) : fetchSuggestions}
        disabled={disabled || loading}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors",
          expanded
            ? "bg-violet-500/8 text-violet-600 dark:text-violet-400"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        )}
        <span>AI Reply Suggestions</span>
        {expanded
          ? <ChevronDown className="ml-auto h-3 w-3" />
          : <ChevronUp className="ml-auto h-3 w-3" />
        }
      </button>

      {/* Suggestions panel */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 bg-violet-500/5">
          {loading ? (
            <div className="flex items-center justify-center py-3 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating suggestions…
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-3">No suggestions available</p>
          ) : (
            <>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-2 rounded-lg border border-violet-200/50 dark:border-violet-800/30 bg-card/70 px-3 py-2 hover:border-violet-400/50 transition-colors"
                >
                  <p
                    className="flex-1 text-xs text-foreground leading-relaxed cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    onClick={() => onSelect(s)}
                    title="Click to edit"
                  >
                    {s}
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(s)}
                      title="Copy"
                      className="rounded p-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { onSend(s); setExpanded(false) }}
                      title="Send now"
                      className="rounded p-1 hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Refresh suggestions
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────

function EmptyThread() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary/60">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Select a conversation</p>
        <p className="text-sm text-muted-foreground">Choose a contact to view messages</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

// ─── WhatsApp Connect Banner ──────────────────────────────

function WhatsAppBanner() {
  const [, setLocation] = useLocation()
  return (
    <div className="mx-2 mt-2 mb-1 flex items-center gap-2.5 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-2.5">
      <FaWhatsapp className="h-4 w-4 text-[#25D366] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground leading-snug">Connect WhatsApp</p>
        <p className="text-[10px] text-muted-foreground truncate">Enable WhatsApp messaging with your leads</p>
      </div>
      <button
        onClick={() => setLocation("/dashboard/settings?tab=whatsapp")}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#20bd5c] transition-colors"
      >
        Connect <ExternalLink className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

export default function MessagesPage() {
  const { session, user } = useAuth()
  const { hasFeature, isSuperAdmin } = usePlan()
  const canUseAiSuggestions = isSuperAdmin || hasFeature("ai_reply_suggestions")
  const { data: waStatus } = useWhatsAppStatus()
  const { data: waAccounts = [] } = useWaAccounts()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgType, setMsgType] = useState<"text" | "note">("text")
  const [search, setSearch] = useState("")
  const [showNewModal, setShowNewModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "resolved">("all")
  const [inboxFilter, setInboxFilter] = useState<number | "all" | "crm">("all")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null
  const isWhatsApp = selectedConv?.channel === "whatsapp"

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations()
      setConversations(data)
    } catch {
      toast.error("Failed to load conversations")
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvId) { setMessages([]); return }
    setLoadingMsgs(true)
    getMessages(selectedConvId)
      .then((data) => { setMessages(data); markConversationRead(selectedConvId) })
      .catch(() => toast.error("Failed to load messages"))
      .finally(() => setLoadingMsgs(false))
  }, [selectedConvId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSelectConv = (id: string) => {
    setSelectedConvId(id)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    )
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSend = async (overrideText?: string) => {
    const content = (overrideText ?? text).trim()
    if (!content || !selectedConvId || !user?.id) return
    if (!overrideText) setText("")
    setSendingMsg(true)

    const channel = selectedConv?.channel ?? "crm"

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConvId,
      sender_id: user.id,
      content,
      type: msgType,
      status: "sent",
      direction: "outbound",
      whatsapp_message_id: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setConversations((prev) =>
      prev.map((c) => c.id === selectedConvId ? { ...c, last_message: content, last_message_at: new Date().toISOString() } : c)
    )

    try {
      const msg = await sendMessage(selectedConvId, user.id, content, msgType, channel)
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? msg : m))
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send message")
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      if (!overrideText) setText(content)
    } finally {
      setSendingMsg(false)
    }
  }

  const handleCreate = async (data: { name: string; phone?: string; email?: string }) => {
    if (!user?.id) return
    const conv = await createConversation(user.id, data)
    setConversations((prev) => [conv, ...prev])
    setSelectedConvId(conv.id)
    toast.success("Conversation started")
  }

  const handleArchive = async () => {
    if (!selectedConvId) return
    await updateConversationStatus(selectedConvId, "resolved")
    setConversations((prev) => prev.map((c) => c.id === selectedConvId ? { ...c, status: "resolved" } : c))
    toast.success("Conversation archived")
  }

  const filtered = conversations
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => {
      if (inboxFilter === "all") return true
      if (inboxFilter === "crm") return c.channel !== "whatsapp"
      // numeric: filter by wa_account_id stored in meta or just by channel for now
      return c.channel === "whatsapp"
    })
    .filter((c) => {
      if (!search) return true
      const name = (c.contact?.name ?? c.title ?? "").toLowerCase()
      return name.includes(search.toLowerCase())
    })

  const isResolved = selectedConv?.status === "resolved"

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardPageHeader
        title="Messages"
        description="Send and receive messages with your leads"
        actions={
          <Button size="sm" className="gap-2" onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4" /> New Conversation
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden border-t border-border">
        {/* ── Left: Conversation List ─────────────────── */}
        <div className="flex w-72 flex-shrink-0 flex-col border-r border-border bg-card/40">
          {/* WhatsApp connect banner */}
          {waStatus && !waStatus.connected && waAccounts.length === 0 && <WhatsAppBanner />}

          {/* Multi-inbox tabs */}
          {waAccounts.length > 0 && (
            <div className="flex gap-1 overflow-x-auto p-2 pb-1.5 border-b border-border/60 no-scrollbar">
              <button
                onClick={() => setInboxFilter("all")}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  inboxFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                All Inboxes
              </button>
              <button
                onClick={() => setInboxFilter("crm")}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                  inboxFilter === "crm"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                CRM
              </button>
              {waAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setInboxFilter(acc.id)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    inboxFilter === acc.id
                      ? "bg-[#25D366] text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                  title={acc.phoneNumber ?? acc.displayName ?? "WhatsApp"}
                >
                  <FaWhatsapp className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[80px]">
                    {acc.displayName ?? acc.phoneNumber ?? `Inbox ${acc.id}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="pl-8 h-8 text-sm bg-secondary/40"
              />
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1 overflow-x-auto p-2 border-b border-border/60 no-scrollbar">
            {(["all", "active", "pending", "resolved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >{s}</button>
            ))}
            <button onClick={loadConversations} className="ml-auto flex-shrink-0 rounded-full p-1 hover:bg-secondary transition-colors">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? "No matches found" : "No conversations yet"}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60 mt-1">Start one with a lead</p>
                  )}
                </div>
              </div>
            ) : (
              filtered.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={selectedConvId === conv.id}
                  onClick={() => handleSelectConv(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right: Thread ───────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">
          {!selectedConv ? (
            <EmptyThread />
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 bg-card/40">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    initials={(selectedConv.contact?.name ?? selectedConv.title ?? "?")
                      .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {selectedConv.contact?.name ?? selectedConv.title ?? "Unknown"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedConv.contact?.phone && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" />{selectedConv.contact.phone}
                        </span>
                      )}
                      {selectedConv.contact?.email && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Mail className="h-2.5 w-2.5" />{selectedConv.contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isWhatsApp && (
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-500/10 text-green-600">
                      <span className="font-bold">W</span> WhatsApp
                    </span>
                  )}
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                    selectedConv.status === "active" ? "bg-green-500/10 text-green-600" :
                    selectedConv.status === "pending" ? "bg-amber-500/10 text-amber-600" :
                    "bg-secondary text-muted-foreground"
                  )}>{selectedConv.status}</span>
                  {selectedConv.status !== "resolved" && (
                    <button
                      onClick={handleArchive}
                      title="Archive conversation"
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/60">Say hello to start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-border bg-card/40">
                {/* AI Reply Suggestions — WhatsApp + Professional+ only */}
                {isWhatsApp && canUseAiSuggestions && !isResolved && selectedConvId && (
                  <AISuggestions
                    conversationId={selectedConvId}
                    onSelect={(s) => { setText(s); setTimeout(() => inputRef.current?.focus(), 50) }}
                    onSend={(s) => handleSend(s)}
                    disabled={sendingMsg}
                  />
                )}

                <div className="p-3 space-y-2">
                  {/* Type toggle */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMsgType("text")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        msgType === "text" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </button>
                    <button
                      onClick={() => setMsgType("note")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        msgType === "note" ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <StickyNote className="h-3.5 w-3.5" /> Internal Note
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={msgType === "note" ? "Write an internal note..." : "Type a message…"}
                      className={cn(
                        "flex-1 text-sm",
                        msgType === "note" && "border-amber-500/30 focus-visible:ring-amber-500/30"
                      )}
                      disabled={sendingMsg || isResolved}
                    />
                    <Button
                      onClick={() => handleSend()}
                      disabled={!text.trim() || sendingMsg || isResolved}
                      size="icon"
                      className={cn(
                        "flex-shrink-0",
                        msgType === "note" && "bg-amber-500 hover:bg-amber-600 text-white"
                      )}
                    >
                      {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  {isResolved && (
                    <p className="text-center text-xs text-muted-foreground">This conversation is archived</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewConvModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

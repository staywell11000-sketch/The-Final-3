import { useState } from "react"
import { Link, useLocation } from "wouter"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  CalendarPlus,
  Edit2,
  Flame,
  CheckCircle2,
  Circle,
  Clock,
  Paperclip,
  Send,
  FileText,
  FileImage,
  File,
  Building2,
  User,
  DollarSign,
  Megaphone,
  ChevronDown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Tag,
  MoreHorizontal,
  Bell,
  Loader2,
  Trash2,
  Save,
  X,
  Zap,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { surfaceInputClass, surfaceSelectClass, surfaceSelectIconClass } from "@/lib/ui-classes"
import {
  statusConfig,
  priorityConfig,
  pipelineOrder,
  agents,
  propertyOptions,
  allSources,
  availableTags,
} from "@/components/dashboard/leads-data"
import { Lead, LeadPriority, LeadSource, LeadStatus } from "@/components/dashboard/leads-types"
import { useLeads, useUpdateLead, useDeleteLead } from "@/lib/leads-api"
import { useAutomations } from "@/lib/automations-api"
import { LeadMessagesTab } from "@/components/dashboard/lead-messages-tab"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead Created",
  lead_status_changed: "Status Changed",
  message_received: "Message Received",
  lead_score_updated: "Score Updated",
}

function TriggerAutomationDialog({
  open,
  onClose,
  leadId,
  leadName,
}: {
  open: boolean
  onClose: () => void
  leadId: number
  leadName: string
}) {
  const { data: automations = [] } = useAutomations()
  const { session } = useAuth()
  const [firing, setFiring] = useState<number | null>(null)

  const API = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api"
  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }

  const fireAutomation = async (automationId: number) => {
    setFiring(automationId)
    try {
      const res = await fetch(`${API}/automations/${automationId}/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({ leadId }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Automation triggered successfully")
      onClose()
    } catch {
      toast.error("Failed to trigger automation")
    } finally {
      setFiring(null)
    }
  }

  const active = automations.filter((a) => a.isActive)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Trigger Automation
          </DialogTitle>
          <DialogDescription>
            Manually fire an automation rule for <span className="font-medium text-foreground">{leadName}</span>
          </DialogDescription>
        </DialogHeader>
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Zap className="h-8 w-8 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No active automation rules.</p>
            <p className="text-xs text-muted-foreground">Enable rules on the Automations page first.</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {active.map((automation) => (
              <div
                key={automation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm text-foreground">{automation.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType}
                    {" · "}
                    {automation.actions.length} action{automation.actions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10"
                  disabled={firing === automation.id}
                  onClick={() => fireAutomation(automation.id)}
                >
                  {firing === automation.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Run
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type TimelineEvent = {
  id: string
  title: string
  description?: string
  time: string
  type: "message" | "call" | "email" | "meeting" | "deal" | "system"
}

const timelineIcon = (type: TimelineEvent["type"]) => {
  const map = {
    message: { Icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
    call: { Icon: Phone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    email: { Icon: Mail, color: "text-purple-500", bg: "bg-purple-500/10" },
    meeting: { Icon: CalendarPlus, color: "text-primary", bg: "bg-primary/10" },
    deal: { Icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    system: { Icon: Circle, color: "text-muted-foreground", bg: "bg-secondary/50" },
  }
  return map[type]
}

function ScoreRing({ score }: { score: number }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg width={64} height={64} className="-rotate-90">
        <circle cx={32} cy={32} r={r} stroke="var(--border)" strokeWidth={5} fill="none" />
        <circle
          cx={32} cy={32} r={r}
          stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-foreground">{score}</span>
    </div>
  )
}

function FileIcon({ type }: { type: Lead["attachments"][number]["type"] }) {
  if (type === "pdf") return <FileText className="h-4 w-4 text-red-500" />
  if (type === "img") return <FileImage className="h-4 w-4 text-blue-500" />
  return <File className="h-4 w-4 text-muted-foreground" />
}

function FieldLabel({ label }: { label: string }) {
  return <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
}

export default function LeadProfilePage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation()
  const [newNote, setNewNote] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<"activity" | "messages" | "notes" | "files">("activity")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false)

  const { data: leads = [], isLoading } = useLeads()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()

  const id = parseInt(params.id, 10)
  const lead = leads.find((l) => l.id === id) ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-semibold text-foreground">Lead not found</p>
        <p className="text-sm text-muted-foreground">This lead may have been removed or the link is invalid.</p>
        <Link href="/dashboard/leads">
          <Button variant="outline" className="mt-1 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Leads
          </Button>
        </Link>
      </div>
    )
  }

  const data = isEditing && editData ? editData : lead
  const stageIndex = pipelineOrder.indexOf(lead.status)
  const priorityCfg = priorityConfig[lead.priority]
  const statusCfg = statusConfig[lead.status]

  const startEdit = () => { setEditData({ ...lead }); setIsEditing(true) }
  const cancelEdit = () => { setEditData(null); setIsEditing(false) }

  const setField = <K extends keyof Lead>(key: K, value: Lead[K]) => {
    setEditData((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const saveEdit = async () => {
    if (!editData) return
    try {
      const { id: _id, ...updates } = editData
      await updateLead.mutateAsync({ id: lead.id, updates })
      toast.success("Lead updated")
      setIsEditing(false)
      setEditData(null)
    } catch {
      toast.error("Failed to update lead")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteLead.mutateAsync(lead.id)
      toast.success("Lead archived")
      navigate("/dashboard/leads")
    } catch {
      toast.error("Failed to archive lead")
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        updates: {
          notes: [newNote.trim(), ...(lead.notes ?? [])].slice(0, 20),
          timeline: [
            { id: `tl-${Date.now()}`, title: "Note added", time: "Just now" },
            ...(lead.timeline ?? []),
          ].slice(0, 30),
        },
      })
      setNewNote("")
    } catch {
      toast.error("Failed to add note")
    }
  }

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`Hi ${lead.name}, following up regarding ${lead.property}.`)
    window.open(`https://wa.me/${(lead.whatsappNumber ?? "").replace(/\D/g, "")}?text=${msg}`, "_blank", "noopener")
  }

  const suggestedActions = lead.suggestedActions?.length
    ? lead.suggestedActions
    : {
        new: ["Schedule discovery call", "Send welcome email", "Add to nurture campaign"],
        qualified: ["Send property shortlist", "Schedule property viewing", "Request proof of funds"],
        proposal: ["Follow up on proposal", "Address objections", "Adjust pricing if needed"],
        negotiation: ["Finalize offer terms", "Coordinate legal review", "Confirm move-in timeline"],
        won: ["Send congratulations", "Coordinate handover", "Request client referral"],
        lost: ["Send follow-up in 30 days", "Log loss reason", "Re-qualify next quarter"],
      }[lead.status] ?? []

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            All Leads
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">{lead.name}</span>
      </div>

      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/80 to-accent/80 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
                {lead.avatar}
              </div>
              {lead.priority === "hot" && (
                <Flame className="absolute -right-1.5 -top-1.5 h-5 w-5 text-red-500" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
                <Badge variant="outline" className={cn("font-semibold", priorityCfg.className)}>
                  {priorityCfg.label}
                </Badge>
                <Badge variant="outline" className={cn(statusCfg.className)}>
                  {statusCfg.label}
                </Badge>
                {lead.duplicateOf && (
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Possible Duplicate
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{lead.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>
                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{lead.source}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(lead.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="outline" className="border-border/50 bg-secondary/40 text-xs text-muted-foreground">
                    <Tag className="mr-1 h-2.5 w-2.5" />{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Lead Score</p>
              <ScoreRing score={lead.score ?? 50} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass">
                <DropdownMenuItem onClick={startEdit}>Edit lead</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Archive lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-5">
          <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
            <Phone className="h-4 w-4" />Call
          </Button>
          <Button onClick={openWhatsApp} variant="outline" className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10">
            <MessageCircle className="h-4 w-4" />WhatsApp
          </Button>
          <Button variant="outline" className="gap-2 border-border/50">
            <Mail className="h-4 w-4" />Email
          </Button>
          <Button variant="outline" className="gap-2 border-border/50">
            <CalendarPlus className="h-4 w-4" />Schedule Viewing
          </Button>
          <Button variant="outline" className="gap-2 border-border/50" onClick={startEdit}>
            <Edit2 className="h-4 w-4" />Edit Lead
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setTriggerDialogOpen(true)}
          >
            <Zap className="h-4 w-4" />Trigger Automation
          </Button>
        </div>

        {/* Pipeline stages */}
        <div className="mt-5 border-t border-border/50 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Progress</p>
          <div className="flex items-center gap-0">
            {pipelineOrder.filter((s) => s !== "lost").map((stage, i, arr) => {
              const isDone = pipelineOrder.indexOf(stage) < stageIndex
              const isCurrent = stage === lead.status
              const isLast = i === arr.length - 1
              return (
                <div key={stage} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                      isDone ? "border-primary bg-primary text-primary-foreground" :
                      isCurrent ? "border-primary bg-primary/10 text-primary" :
                      "border-border/50 bg-secondary/20 text-muted-foreground"
                    )}>
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium capitalize whitespace-nowrap",
                      isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {statusConfig[stage].label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={cn("mb-4 h-0.5 flex-1 transition-all", isDone ? "bg-primary" : "bg-border/50")} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Main content grid */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left: Timeline / Notes / Files */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-2 glass-card p-6"
        >
          {/* Tabs */}
          <div className="mb-5 flex gap-1 rounded-xl border border-border/40 bg-secondary/20 p-1">
            {(["activity", "messages", "notes", "files"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t as typeof activeTab)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors",
                  activeTab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "messages" ? "Messages" :
                 t === "notes" ? `Notes (${(lead.notes ?? []).length})` :
                 t === "files" ? `Files (${(lead.attachments ?? []).length})` :
                 "Activity"}
              </button>
            ))}
          </div>

          {/* ACTIVITY TIMELINE */}
          {activeTab === "activity" && (
            <ActivityTimeline leadId={lead.id} />
          )}

          {/* NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote() } }}
                  placeholder="Add a note about this lead…"
                  className={cn("flex-1", surfaceInputClass)}
                />
                <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="bg-primary hover:bg-primary/90 gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {(lead.notes ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No notes yet. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  {(lead.notes ?? []).map((note, i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                      <p className="text-sm text-foreground">{note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FILES */}
          {activeTab === "files" && (
            <div>
              {(lead.attachments ?? []).length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Paperclip className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No files attached to this lead.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(lead.attachments ?? []).map((file, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/20 p-3">
                      <FileIcon type={file.type} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === "messages" && (
            <LeadMessagesTab lead={lead} />
          )}
        </motion.div>

        {/* Right sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="space-y-4"
        >
          {/* AI Summary */}
          {lead.aiSummary && (
            <div className="glass-card p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">AI Summary</span>
                <Badge variant="outline" className="ml-auto border-primary/30 bg-primary/5 px-1.5 py-0 text-[9px] text-primary">Beta</Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{lead.aiSummary}</p>
            </div>
          )}

          {/* Suggested Actions */}
          {suggestedActions.length > 0 && (
            <div className="glass-card p-4">
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Suggested Actions</span>
              </div>
              <ul className="space-y-1.5">
                {suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deal Info */}
          <div className="glass-card p-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deal Info</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Budget</p>
                <p className="font-semibold text-foreground">{lead.budget || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Property</p>
                <p className="text-foreground truncate">{lead.property || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Assigned</p>
                <p className="text-foreground">{lead.assignedTo || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Source</p>
                <p className="text-foreground">{lead.source}</p>
              </div>
              {lead.campaign && (
                <div className="col-span-2">
                  <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Campaign</p>
                  <p className="text-foreground">{lead.campaign}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground/60 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Last Contact</p>
                <p className="text-foreground">{lead.lastContact || "—"}</p>
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="glass-card p-4 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scores</h4>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Lead Score</span>
                <span className="font-bold text-foreground">{lead.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/40">
                <div
                  className={cn("h-full rounded-full transition-all",
                    (lead.score ?? 0) >= 75 ? "bg-emerald-500" : (lead.score ?? 0) >= 50 ? "bg-amber-500" : "bg-red-400"
                  )}
                  style={{ width: `${lead.score ?? 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Urgency Score</span>
                <span className="font-bold text-foreground">{lead.urgencyScore}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/40">
                <div
                  className={cn("h-full rounded-full transition-all",
                    (lead.urgencyScore ?? 0) >= 75 ? "bg-red-500" : (lead.urgencyScore ?? 0) >= 50 ? "bg-amber-500" : "bg-blue-400"
                  )}
                  style={{ width: `${lead.urgencyScore ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Edit modal overlay */}
      {isEditing && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-lg rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Edit Lead — {lead.name}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Full Name</label>
                  <Input value={editData.name} onChange={(e) => setField("name", e.target.value)} className={cn("h-8 text-sm", surfaceInputClass)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                  <Input type="email" value={editData.email} onChange={(e) => setField("email", e.target.value)} className={cn("h-8 text-sm", surfaceInputClass)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
                  <Input value={editData.phone} onChange={(e) => setField("phone", e.target.value)} className={cn("h-8 text-sm", surfaceInputClass)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Budget</label>
                  <Input value={editData.budget} onChange={(e) => setField("budget", e.target.value)} className={cn("h-8 text-sm", surfaceInputClass)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline Status</label>
                  <div className="relative">
                    <select
                      value={editData.status}
                      onChange={(e) => setField("status", e.target.value as LeadStatus)}
                      className={cn("h-8 w-full text-xs", surfaceSelectClass)}
                    >
                      {pipelineOrder.map((s) => (
                        <option key={s} value={s}>{statusConfig[s].label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                  <div className="relative">
                    <select
                      value={editData.priority}
                      onChange={(e) => setField("priority", e.target.value as LeadPriority)}
                      className={cn("h-8 w-full text-xs", surfaceSelectClass)}
                    >
                      <option value="hot">🔴 Hot</option>
                      <option value="warm">🟠 Warm</option>
                      <option value="cold">🔵 Cold</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
                  <div className="relative">
                    <select
                      value={editData.source}
                      onChange={(e) => setField("source", e.target.value as LeadSource)}
                      className={cn("h-8 w-full text-xs", surfaceSelectClass)}
                    >
                      {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Assigned To</label>
                  <div className="relative">
                    <select
                      value={editData.assignedTo}
                      onChange={(e) => setField("assignedTo", e.target.value)}
                      className={cn("h-8 w-full text-xs", surfaceSelectIconClass)}
                    >
                      {agents.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Property Interest</label>
                <div className="relative">
                  <select
                    value={editData.property}
                    onChange={(e) => setField("property", e.target.value)}
                    className={cn("h-8 w-full text-xs", surfaceSelectIconClass)}
                  >
                    <option value="">Any property</option>
                    {propertyOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => {
                    const active = (editData.tags ?? []).includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => setField("tags", active ? (editData.tags ?? []).filter((t) => t !== tag) : [...(editData.tags ?? []), tag])}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                          active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-secondary/20 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => { cancelEdit(); setConfirmDelete(true) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Archive
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} className="border-border/50">Cancel</Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={updateLead.isPending}
                  className="gap-1.5 bg-primary hover:bg-primary/90"
                >
                  {updateLead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-foreground mb-2">Archive Lead?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This will permanently remove <strong>{lead.name}</strong> from your leads pipeline.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} className="border-border/50">Cancel</Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleteLead.isPending}
                className="gap-1.5 bg-destructive hover:bg-destructive/90 text-white"
              >
                {deleteLead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Archive
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <TriggerAutomationDialog
        open={triggerDialogOpen}
        onClose={() => setTriggerDialogOpen(false)}
        leadId={lead.id}
        leadName={lead.name}
      />
    </div>
  )
}

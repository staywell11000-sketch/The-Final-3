import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { surfaceInputClass, surfaceSelectClass, surfaceSelectIconClass } from "@/lib/ui-classes"
import {
  Phone,
  Mail,
  MessageCircle,
  Edit3,
  Save,
  Trash2,
  Sparkles,
  Zap,
  AlertTriangle,
  User,
  Building2,
  DollarSign,
  Globe,
  Megaphone,
  ChevronDown,
  Clock3,
  Paperclip,
  CheckCircle2,
  Send,
  UserCheck,
  FileText,
  FileImage,
  File,
  X,
  Tag,
  MousePointerClick,
  Hash,
  Layers,
} from "lucide-react"
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa"
import { FaTiktok } from "react-icons/fa6"
import {
  agents,
  propertyOptions,
  pipelineOrder,
  statusConfig,
  priorityConfig,
  sourceConfig,
  availableTags,
  allSources,
} from "@/components/dashboard/leads-data"
import { Lead, LeadPriority, LeadSource, LeadStatus } from "@/components/dashboard/leads-types"

type Props = {
  lead: Lead | null
  onClose: () => void
  onUpdate: (id: number, updates: Partial<Lead>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

type DetailTab = "overview" | "activity" | "files"

function getDefaultSuggestedActions(status: LeadStatus): string[] {
  const map: Record<LeadStatus, string[]> = {
    new: ["Schedule discovery call", "Send welcome email", "Add to nurture campaign"],
    qualified: ["Send property shortlist", "Schedule property viewing", "Request proof of funds"],
    proposal: ["Follow up on proposal", "Address objections", "Adjust pricing if needed"],
    negotiation: ["Finalize offer terms", "Coordinate legal review", "Confirm move-in timeline"],
    won: ["Send congratulations", "Coordinate handover", "Request client referral"],
    lost: ["Send follow-up in 30 days", "Log loss reason", "Re-qualify next quarter"],
  }
  return map[status] ?? []
}

const PLATFORM_ICON_MAP: Record<string, React.ElementType> = {
  facebook:  FaFacebook,
  instagram: FaInstagram,
  whatsapp:  FaWhatsapp,
  tiktok:    FaTiktok,
  website:   Globe,
  manual:    MousePointerClick,
}

function SourceBadge({ source }: { source: Lead["source"] }) {
  const cfg = sourceConfig[source] ?? {
    className: "bg-secondary/40 text-muted-foreground border-border/50",
    dotColor: "bg-muted-foreground",
    label: source,
  }
  const PlatformIcon = cfg.platform ? PLATFORM_ICON_MAP[cfg.platform] : null
  return (
    <Badge variant="outline" className={cn("text-xs gap-1.5", cfg.className)}>
      {PlatformIcon ? (
        <PlatformIcon className="h-3 w-3 shrink-0" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dotColor)} />
      )}
      {cfg.label}
    </Badge>
  )
}

function FileIcon({ type }: { type: Lead["attachments"][number]["type"] }) {
  if (type === "pdf") return <FileText className="h-5 w-5 text-red-500" />
  if (type === "img") return <FileImage className="h-5 w-5 text-blue-500" />
  if (type === "doc") return <FileText className="h-5 w-5 text-blue-600" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function FieldLabel({ label }: { label: string }) {
  return <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-border/40">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-bold tabular-nums text-foreground">{score}</span>
    </div>
  )
}

export function LeadDetailModal({ lead, onClose, onUpdate, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>("overview")
  const [newNote, setNewNote] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!lead) return null

  const data = isEditing && editData ? editData : lead

  const startEdit = () => {
    setEditData({ ...lead })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setEditData(null)
    setIsEditing(false)
  }

  const saveEdit = async () => {
    if (editData) {
      const { id, ...updates } = editData
      await onUpdate(id, updates)
      setIsEditing(false)
      setEditData(null)
    }
  }

  const setField = <K extends keyof Lead>(key: K, value: Lead[K]) => {
    setEditData((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    await onUpdate(lead.id, {
      notes: [newNote.trim(), ...lead.notes].slice(0, 10),
      timeline: [
        { id: `tl-${Date.now()}`, title: "Note added", time: "Just now" },
        ...lead.timeline,
      ].slice(0, 20),
    })
    setNewNote("")
  }

  const suggestedActions = lead.suggestedActions ?? getDefaultSuggestedActions(lead.status)

  const tabs: { key: DetailTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "overview", label: "Overview", icon: User },
    { key: "activity", label: "Activity", icon: Clock3, count: lead.notes.length + lead.timeline.length },
    { key: "files", label: "Files", icon: Paperclip, count: lead.attachments.length },
  ]

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`Hi ${lead.name}, just following up regarding ${lead.property}.`)
    const phone = lead.whatsappNumber.replace(/\D/g, "")
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog
      open={!!lead}
      onOpenChange={(open) => {
        if (!open && !confirmDelete) onClose()
      }}
    >
      <DialogContent className="glass flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0 mx-3 sm:mx-0 w-[calc(100%-1.5rem)] sm:w-full">
        <DialogTitle className="sr-only">Lead Details</DialogTitle>
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border/40 p-4 pr-12">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-sm font-bold text-primary-foreground">
            {lead.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-base font-semibold text-foreground">{lead.name}</h2>
              {lead.duplicateOf && (
                <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px]">
                  <AlertTriangle className="h-2.5 w-2.5" /> Duplicate
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px]", statusConfig[lead.status].className)}>
                {statusConfig[lead.status].label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", priorityConfig[lead.priority].className)}>
                {priorityConfig[lead.priority].label}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{lead.email} · {lead.phone}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {lead.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-border/40 bg-secondary/30 px-1.5 py-0 text-[10px] text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 mr-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={openWhatsApp}>
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Mail className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Phone className="h-3.5 w-3.5" />
            </Button>
            {isEditing ? (
              <>
                <Button size="sm" onClick={saveEdit} className="h-7 bg-primary hover:bg-primary/90 text-xs gap-1">
                  <Save className="h-3 w-3" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 text-xs border-border/50">
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit} className="h-7 text-xs border-border/50 gap-1">
                <Edit3 className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border/40 px-4 gap-0">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="rounded-full bg-secondary/60 px-1.5 text-[10px] font-semibold">{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              {/* Left: Edit fields */}
              <div className="space-y-5 lg:col-span-3">
                {/* Contact Details */}
                <section>
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel label="Full Name" />
                      {isEditing ? (
                        <div className="relative">
                          <User className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.name}
                            onChange={(e) => setField("name", e.target.value)}
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{data.name}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Email" />
                      {isEditing ? (
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            value={editData!.email}
                            onChange={(e) => setField("email", e.target.value)}
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="truncate text-sm text-foreground">{data.email}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Phone" />
                      {isEditing ? (
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.phone}
                            onChange={(e) => setField("phone", e.target.value)}
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{data.phone}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Budget" />
                      {isEditing ? (
                        <div className="relative">
                          <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.budget}
                            onChange={(e) => setField("budget", e.target.value)}
                            placeholder="e.g. ₨ 5–8 Cr"
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{data.budget}</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Deal Information */}
                <section>
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deal Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel label="Property" />
                      {isEditing ? (
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <select
                            value={editData!.property}
                            onChange={(e) => setField("property", e.target.value)}
                            className={cn("h-8 text-xs", surfaceSelectIconClass)}
                          >
                            <option value="—">Any property</option>
                            {propertyOptions.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{data.property}</p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Pipeline Status" />
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editData!.status}
                            onChange={(e) => setField("status", e.target.value as LeadStatus)}
                            className={cn("h-8 text-xs", surfaceSelectClass)}
                          >
                            {pipelineOrder.map((s) => (
                              <option key={s} value={s}>{statusConfig[s].label}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      ) : (
                        <Badge variant="outline" className={cn("text-xs", statusConfig[data.status].className)}>
                          {statusConfig[data.status].label}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Priority" />
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editData!.priority}
                            onChange={(e) => setField("priority", e.target.value as LeadPriority)}
                            className={cn("h-8 text-xs", surfaceSelectClass)}
                          >
                            <option value="hot">🔴 Hot</option>
                            <option value="warm">🟠 Warm</option>
                            <option value="cold">🔵 Cold</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      ) : (
                        <Badge variant="outline" className={cn("text-xs", priorityConfig[data.priority].className)}>
                          {priorityConfig[data.priority].label}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Assigned To" />
                      {isEditing ? (
                        <div className="relative">
                          <UserCheck className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <select
                            value={editData!.assignedTo}
                            onChange={(e) => setField("assignedTo", e.target.value)}
                            className={cn("h-8 text-xs", surfaceSelectIconClass)}
                          >
                            {agents.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{data.assignedTo}</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Campaign & Source */}
                <section>
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign & Source</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel label="Source" />
                      {isEditing ? (
                        <div className="relative">
                          <select
                            value={editData!.source}
                            onChange={(e) => setField("source", e.target.value as LeadSource)}
                            className={cn("h-8 text-xs", surfaceSelectClass)}
                          >
                            {allSources.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      ) : (
                        <SourceBadge source={data.source} />
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Campaign" />
                      {isEditing ? (
                        <div className="relative">
                          <Megaphone className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.campaign ?? ""}
                            onChange={(e) => setField("campaign", e.target.value || undefined)}
                            placeholder="e.g. Summer 2026"
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">
                          {data.campaign ?? <span className="text-muted-foreground">—</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Ad Set" />
                      {isEditing ? (
                        <div className="relative">
                          <Layers className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.adSetName ?? ""}
                            onChange={(e) => setField("adSetName", e.target.value || undefined)}
                            placeholder="e.g. Luxury Buyers 35-55"
                            className={cn("h-8 pl-8 text-sm", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">
                          {data.adSetName ?? <span className="text-muted-foreground">—</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <FieldLabel label="Creative ID" />
                      {isEditing ? (
                        <div className="relative">
                          <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={editData!.adCreativeId ?? ""}
                            onChange={(e) => setField("adCreativeId", e.target.value || undefined)}
                            placeholder="e.g. 23856734001"
                            className={cn("h-8 pl-8 text-sm font-mono", surfaceInputClass)}
                          />
                        </div>
                      ) : (
                        <p className="text-sm font-mono text-foreground">
                          {data.adCreativeId ?? <span className="font-sans text-muted-foreground">—</span>}
                        </p>
                      )}
                    </div>
                    {data.adSource && (
                      <div className="col-span-2">
                        <FieldLabel label="Ad / Creative" />
                        <p className="text-xs text-muted-foreground">{data.adSource}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Tags (edit mode) */}
                {isEditing && (
                  <section>
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => {
                        const active = editData!.tags.includes(tag)
                        return (
                          <button
                            key={tag}
                            onClick={() => {
                              const tags = active
                                ? editData!.tags.filter((t) => t !== tag)
                                : [...editData!.tags, tag]
                              setField("tags", tags)
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                              active
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border/50 bg-secondary/20 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* Right: AI + Actions + Scores */}
              <div className="space-y-3 lg:col-span-2">
                {/* Duplicate warning */}
                {lead.duplicateOf && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-xs font-semibold text-amber-500">Possible Duplicate</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This lead may be a duplicate of Lead #{lead.duplicateOf}. Review both records before advancing in the pipeline.
                    </p>
                  </div>
                )}

                {/* AI Summary */}
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">AI Summary</span>
                    <Badge variant="outline" className="ml-auto border-primary/30 bg-primary/5 px-1.5 py-0 text-[9px] text-primary">
                      Beta
                    </Badge>
                  </div>
                  {lead.aiSummary ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">{lead.aiSummary}</p>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="h-2 w-full rounded-full bg-border/40" />
                      <div className="h-2 w-4/5 rounded-full bg-border/40" />
                      <div className="h-2 w-3/5 rounded-full bg-border/40" />
                      <p className="mt-2 text-[10px] italic text-muted-foreground/50">
                        AI analysis pending — connect AI integration to generate insights
                      </p>
                    </div>
                  )}
                </div>

                {/* Suggested Actions */}
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Suggested Actions</span>
                  </div>
                  <div className="space-y-1.5">
                    {suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        className="flex w-full items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2.5 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Score + Urgency */}
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Lead Score</span>
                    </div>
                    <ScoreBar
                      score={lead.score}
                      color={lead.score >= 75 ? "bg-emerald-500" : lead.score >= 50 ? "bg-amber-500" : "bg-red-400"}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Urgency</span>
                    </div>
                    <ScoreBar
                      score={lead.urgencyScore}
                      color={lead.urgencyScore >= 75 ? "bg-red-500" : lead.urgencyScore >= 50 ? "bg-amber-500" : "bg-blue-400"}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Last contact: {lead.lastContact}</p>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="flex gap-2">
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Add a note and press Enter…"
                  className={cn("flex-1 text-sm", surfaceInputClass)}
                />
                <Button
                  onClick={addNote}
                  size="sm"
                  disabled={!newNote.trim()}
                  className="h-9 gap-1.5 bg-primary hover:bg-primary/90"
                >
                  <Send className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {/* Notes */}
              {lead.notes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes</h4>
                  {lead.notes.map((note, i) => (
                    <div key={i} className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5 text-sm text-foreground/90">
                      {note}
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              <div>
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeline</h4>
                <div className="space-y-0">
                  {lead.timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        {i < lead.timeline.length - 1 && (
                          <div className="my-1 w-px flex-1 bg-border/40" />
                        )}
                      </div>
                      <div className="min-w-0 pb-3">
                        <p className="text-sm text-foreground">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.time}</p>
                      </div>
                    </div>
                  ))}
                  {lead.timeline.length === 0 && (
                    <p className="text-sm text-muted-foreground">No activity yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FILES TAB */}
          {activeTab === "files" && (
            <div className="space-y-2">
              {lead.attachments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Paperclip className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No files attached to this lead</p>
                </div>
              ) : (
                lead.attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5">
                    <FileIcon type={file.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Last contact: {lead.lastContact}
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">Archive this lead?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={async () => {
                  await onDelete(lead.id)
                  onClose()
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-border/50"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Archive Lead
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useCallback } from "react"
import {
  Zap, GitBranch, MessageSquare, UserCheck, Bell, Play, Plus, Clock,
  Activity, Mail, RotateCcw, Calendar, Target, Trash2, Copy,
  ChevronDown, ChevronUp, Sparkles, AlertCircle, CheckCircle2,
  Edit2, ArrowDown, Tag, Filter, Loader2, X, Save, SkipForward,
  Info, Settings2, TestTube2,
} from "lucide-react"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import {
  useAutomations, useAutomationLogs, useCreateAutomation, useUpdateAutomation,
  useDeleteAutomation, useToggleAutomation, useCloneAutomation, useTestAutomation,
  type Automation, type Condition, type AutomationAction,
} from "@/lib/automations-api"

// ─── Constants ────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { value: "lead_created",         label: "New Lead Created",           icon: "⚡" },
  { value: "lead_status_changed",  label: "Lead Status Changed",         icon: "🔄" },
  { value: "lead_score_updated",   label: "Lead Score Updated",          icon: "📊" },
  { value: "message_received",     label: "WhatsApp Message Received",   icon: "💬" },
  { value: "deal_stage_changed",   label: "Deal Stage Changed",          icon: "🏷️" },
  { value: "appointment_created",  label: "Appointment Created",          icon: "📅" },
  { value: "tag_added",            label: "Tag Added to Lead",            icon: "🏷️" },
  { value: "lead_assigned",        label: "Lead Assigned to Agent",       icon: "👤" },
]

const CONDITION_FIELDS = [
  { value: "source",       label: "Lead Source" },
  { value: "status",       label: "Lead Status" },
  { value: "score",        label: "Lead Score" },
  { value: "priority",     label: "Lead Priority" },
  { value: "budget",       label: "Budget" },
  { value: "city",         label: "City" },
  { value: "propertyType", label: "Property Type" },
  { value: "assignedTo",   label: "Assigned Agent" },
  { value: "newStatus",    label: "New Status (after change)" },
  { value: "newScore",     label: "New Score (after update)" },
  { value: "dealStage",    label: "Deal Stage" },
  { value: "tag",          label: "Tag" },
]

const CONDITION_OPERATORS = [
  { value: "equals",               label: "equals" },
  { value: "not_equals",           label: "does not equal" },
  { value: "contains",             label: "contains" },
  { value: "not_contains",         label: "does not contain" },
  { value: "greater_than",         label: "is greater than" },
  { value: "less_than",            label: "is less than" },
  { value: "greater_than_or_equal",label: "≥" },
  { value: "less_than_or_equal",   label: "≤" },
  { value: "is_empty",             label: "is empty" },
  { value: "is_not_empty",         label: "is not empty" },
]

const ACTION_TYPES = [
  { value: "notify",          label: "Send CRM Notification",      icon: Bell,          color: "text-blue-500" },
  { value: "send_whatsapp",   label: "Send WhatsApp Message",       icon: MessageSquare, color: "text-green-500" },
  { value: "send_email",      label: "Send Email",                  icon: Mail,          color: "text-purple-500" },
  { value: "assign_agent",    label: "Assign Agent",                icon: UserCheck,     color: "text-amber-500" },
  { value: "update_status",   label: "Update Lead Status",          icon: RotateCcw,     color: "text-orange-500" },
  { value: "update_priority", label: "Update Lead Priority",        icon: Zap,           color: "text-rose-500" },
  { value: "add_tag",         label: "Add Tag to Lead",             icon: Tag,           color: "text-indigo-500" },
  { value: "remove_tag",      label: "Remove Tag from Lead",        icon: Tag,           color: "text-slate-500" },
  { value: "create_task",     label: "Create Task",                 icon: Target,        color: "text-teal-500" },
  { value: "log_activity",    label: "Log Activity",                icon: Activity,      color: "text-cyan-500" },
  { value: "delay",           label: "Wait / Delay",                icon: Clock,         color: "text-muted-foreground" },
]

const LEAD_STATUSES = ["new", "contacted", "qualified", "site_visit", "negotiating", "won", "lost", "cold"]
const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"]

// ─── Templates ────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "t1",
    name: "Lead Assignment",
    description: "Automatically assign every new lead to an agent and notify them instantly.",
    icon: UserCheck,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    triggerType: "lead_created",
    triggerConfig: {},
    conditions: [],
    actions: [
      { type: "assign_agent",  config: { agentName: "" } },
      { type: "notify",        config: { title: "New Lead Assigned", message: "New lead {{lead_name}} has been assigned to you." } },
    ],
  },
  {
    id: "t2",
    name: "WhatsApp Welcome Message",
    description: "Send a personalised WhatsApp welcome the moment a new lead comes in.",
    icon: MessageSquare,
    color: "text-green-500",
    bg: "bg-green-500/10",
    triggerType: "lead_created",
    triggerConfig: {},
    conditions: [{ field: "source", operator: "contains", value: "facebook" }],
    actions: [
      { type: "send_whatsapp", config: { message: "Welcome {{lead_name}}! 👋 Thank you for your interest. How can we help you today?" } },
    ],
  },
  {
    id: "t3",
    name: "Follow-Up Workflow",
    description: "Wait 24 hours, send a follow-up WhatsApp, and create a task for the agent.",
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    triggerType: "lead_created",
    triggerConfig: {},
    conditions: [],
    actions: [
      { type: "delay",         config: { days: 1, hours: 0, minutes: 0 } },
      { type: "send_whatsapp", config: { message: "Hi {{lead_name}}, just following up on your property inquiry. Have you had a chance to review our listings?" } },
      { type: "create_task",   config: { title: "Call {{lead_name}}", description: "Follow up call — no response to WhatsApp", dueInDays: 1 } },
    ],
  },
  {
    id: "t4",
    name: "Appointment Reminder",
    description: "Remind leads and agents about upcoming appointments via CRM notification.",
    icon: Calendar,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    triggerType: "appointment_created",
    triggerConfig: {},
    conditions: [],
    actions: [
      { type: "notify",        config: { title: "Appointment Reminder", message: "Upcoming appointment with {{lead_name}}" } },
      { type: "send_whatsapp", config: { message: "Hi {{lead_name}}, reminder about your appointment! Looking forward to seeing you." } },
    ],
  },
  {
    id: "t5",
    name: "Auto-Assign Hot Leads",
    description: "When AI scores a lead ≥ 80, auto-assign to top agent and send priority alert.",
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/10",
    triggerType: "lead_score_updated",
    triggerConfig: {},
    conditions: [{ field: "newScore", operator: "greater_than_or_equal", value: 80 }],
    actions: [
      { type: "update_priority", config: { priority: "urgent" } },
      { type: "assign_agent",    config: { agentName: "" } },
      { type: "notify",          config: { title: "🔥 Hot Lead Alert!", message: "{{lead_name}} scored {{lead_score}} — high priority follow-up needed!" } },
    ],
  },
  {
    id: "t6",
    name: "Re-Engagement Campaign",
    description: "Re-engage cold leads with a multi-channel follow-up sequence.",
    icon: RotateCcw,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    triggerType: "lead_status_changed",
    triggerConfig: {},
    conditions: [{ field: "newStatus", operator: "equals", value: "cold" }],
    actions: [
      { type: "send_whatsapp", config: { message: "Hi {{lead_name}}, we have exciting new properties matching your criteria! Would you like to know more?" } },
      { type: "send_email",    config: { subject: "New Properties for You", body: "Hi {{lead_name}},\n\nWe have some great new listings that match your requirements.\n\nBest regards" } },
      { type: "create_task",   config: { title: "Re-engagement call for {{lead_name}}", description: "Lead went cold — try phone call", dueInDays: 2 } },
    ],
  },
  {
    id: "t7",
    name: "Deal Stage Notification",
    description: "Alert the manager and create follow-up tasks whenever a deal enters a critical stage.",
    icon: Bell,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    triggerType: "deal_stage_changed",
    triggerConfig: {},
    conditions: [{ field: "dealStage", operator: "equals", value: "negotiation" }],
    actions: [
      { type: "notify",      config: { title: "Deal in Negotiation", message: "Deal with {{lead_name}} has moved to negotiation stage. Action required." } },
      { type: "create_task", config: { title: "Review negotiation terms for {{lead_name}}", description: "Deal entered negotiation — review pricing and terms", dueInDays: 1 } },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────

function triggerLabel(type: string) {
  return TRIGGER_OPTIONS.find(t => t.value === type)?.label ?? type
}

function triggerIcon(type: string) {
  return TRIGGER_OPTIONS.find(t => t.value === type)?.icon ?? "⚡"
}

function actionLabel(type: string) {
  return ACTION_TYPES.find(a => a.value === type)?.label ?? type
}

function statusColor(status: string | null | undefined) {
  if (!status) return "text-muted-foreground"
  if (status === "success") return "text-emerald-600"
  if (status === "partial") return "text-amber-600"
  if (status === "error")   return "text-destructive"
  if (status === "skipped") return "text-muted-foreground"
  return "text-muted-foreground"
}

function statusBg(status: string | null | undefined) {
  if (status === "success") return "bg-emerald-500/10 border-emerald-500/20"
  if (status === "partial") return "bg-amber-500/10 border-amber-500/20"
  if (status === "error")   return "bg-destructive/10 border-destructive/20"
  if (status === "skipped") return "bg-muted/50 border-border/40"
  return "bg-muted/50 border-border/40"
}

const inputCls = "h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
const textareaCls = "w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"

// ─── Action Config Editor ─────────────────────────────────

function ActionConfigEditor({
  action,
  onChange,
}: {
  action: AutomationAction
  onChange: (cfg: Record<string, unknown>) => void
}) {
  const cfg = action.config
  const set = (key: string, val: unknown) => onChange({ ...cfg, [key]: val })

  switch (action.type) {
    case "notify":
      return (
        <div className="space-y-2 mt-2">
          <input className={inputCls} placeholder="Title (e.g. New Lead Alert)" value={(cfg.title as string) ?? ""} onChange={e => set("title", e.target.value)} />
          <textarea className={textareaCls} placeholder="Message… Use {{lead_name}}, {{lead_status}}, {{lead_score}}" value={(cfg.message as string) ?? ""} onChange={e => set("message", e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Variables: {"{{lead_name}}"} {"{{lead_status}}"} {"{{lead_score}}"} {"{{lead_source}}"}</p>
        </div>
      )

    case "send_whatsapp":
      return (
        <div className="space-y-2 mt-2">
          <textarea className={textareaCls} placeholder="WhatsApp message… Use {{lead_name}}, {{lead_phone}}" value={(cfg.message as string) ?? ""} onChange={e => set("message", e.target.value)} />
          <input className={inputCls} placeholder="Template name (optional)" value={(cfg.templateName as string) ?? ""} onChange={e => set("templateName", e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Variables: {"{{lead_name}}"} {"{{lead_phone}}"} {"{{lead_source}}"}</p>
        </div>
      )

    case "send_email":
      return (
        <div className="space-y-2 mt-2">
          <input className={inputCls} placeholder="Subject" value={(cfg.subject as string) ?? ""} onChange={e => set("subject", e.target.value)} />
          <input className={inputCls} placeholder="To (email or {{lead_email}})" value={(cfg.to as string) ?? "{{lead_email}}"} onChange={e => set("to", e.target.value)} />
          <textarea className={textareaCls} placeholder="Email body… Use {{lead_name}}, {{lead_email}}" value={(cfg.body as string) ?? ""} onChange={e => set("body", e.target.value)} />
        </div>
      )

    case "assign_agent":
      return (
        <div className="mt-2">
          <input className={inputCls} placeholder="Agent name (e.g. Ali Khan)" value={(cfg.agentName as string) ?? ""} onChange={e => set("agentName", e.target.value)} />
        </div>
      )

    case "update_status":
      return (
        <div className="mt-2">
          <Select value={(cfg.status as string) ?? ""} onValueChange={v => set("status", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select new status…" /></SelectTrigger>
            <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )

    case "update_priority":
      return (
        <div className="mt-2">
          <Select value={(cfg.priority as string) ?? ""} onValueChange={v => set("priority", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select priority…" /></SelectTrigger>
            <SelectContent>{LEAD_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )

    case "add_tag":
    case "remove_tag":
      return (
        <div className="mt-2">
          <input className={inputCls} placeholder="Tag name (e.g. hot-lead)" value={(cfg.tag as string) ?? ""} onChange={e => set("tag", e.target.value)} />
        </div>
      )

    case "create_task":
      return (
        <div className="space-y-2 mt-2">
          <input className={inputCls} placeholder="Task title… Use {{lead_name}}" value={(cfg.title as string) ?? ""} onChange={e => set("title", e.target.value)} />
          <textarea className={textareaCls} placeholder="Task description" value={(cfg.description as string) ?? ""} onChange={e => set("description", e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Due in</label>
            <input type="number" min={0} className={cn(inputCls, "w-16")} value={(cfg.dueInDays as number) ?? 1} onChange={e => set("dueInDays", Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      )

    case "log_activity":
      return (
        <div className="space-y-2 mt-2">
          <input className={inputCls} placeholder="Activity title" value={(cfg.title as string) ?? ""} onChange={e => set("title", e.target.value)} />
          <textarea className={textareaCls} placeholder="Description" value={(cfg.description as string) ?? ""} onChange={e => set("description", e.target.value)} />
        </div>
      )

    case "delay":
      return (
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Wait</label>
          <input type="number" min={0} className={cn(inputCls, "w-14")} value={(cfg.days as number) ?? 0} onChange={e => set("days", Number(e.target.value))} />
          <span className="text-xs text-muted-foreground">days</span>
          <input type="number" min={0} max={23} className={cn(inputCls, "w-14")} value={(cfg.hours as number) ?? 0} onChange={e => set("hours", Number(e.target.value))} />
          <span className="text-xs text-muted-foreground">hours</span>
          <input type="number" min={0} max={59} className={cn(inputCls, "w-14")} value={(cfg.minutes as number) ?? 0} onChange={e => set("minutes", Number(e.target.value))} />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      )

    default:
      return <p className="text-xs text-muted-foreground mt-2 italic">No configuration needed for this action.</p>
  }
}

// ─── Action Block ─────────────────────────────────────────

function ActionBlock({
  action, index, total,
  onChange, onRemove,
}: {
  action:   AutomationAction
  index:    number
  total:    number
  onChange: (i: number, a: AutomationAction) => void
  onRemove: (i: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const def = ACTION_TYPES.find(a => a.value === action.type)
  const Icon = def?.icon ?? Settings2

  return (
    <div>
      {index > 0 && (
        <div className="flex justify-center my-1">
          <div className="flex flex-col items-center gap-0.5">
            <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/40" />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/30">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shrink-0">{index + 1}</div>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", def?.color ?? "text-muted-foreground")} />
          <Select value={action.type} onValueChange={v => onChange(index, { ...action, type: v, config: {} })}>
            <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(at => {
                const AT = at.icon
                return (
                  <SelectItem key={at.value} value={at.value}>
                    <div className="flex items-center gap-2">
                      <AT className={cn("h-3.5 w-3.5", at.color)} />
                      {at.label}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground p-0.5 transition-colors">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {total > 1 && (
              <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive p-0.5 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="px-3 pb-3">
            <ActionConfigEditor action={action} onChange={cfg => onChange(index, { ...action, config: cfg })} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Flow Editor ──────────────────────────────────────────

interface FlowEditorProps {
  initial?:  Partial<Automation>
  onSave:    (data: Partial<Automation>) => Promise<void>
  onCancel?: () => void
  saving?:   boolean
}

function FlowEditor({ initial, onSave, onCancel, saving }: FlowEditorProps) {
  const [name,        setName]        = useState(initial?.name        ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "lead_created")
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(initial?.triggerConfig ?? {})
  const [conditions,  setConditions]  = useState<Condition[]>(initial?.conditions ?? [])
  const [actions,     setActions]     = useState<AutomationAction[]>(
    initial?.actions?.length ? initial.actions : [{ type: "notify", config: { title: "Alert", message: "Automation triggered for {{lead_name}}" } }]
  )

  const addCondition = () => setConditions(p => [...p, { field: "source", operator: "equals", value: "" }])
  const removeCondition = (i: number) => setConditions(p => p.filter((_, idx) => idx !== i))
  const updateCondition = useCallback((i: number, patch: Partial<Condition>) =>
    setConditions(p => p.map((c, idx) => idx === i ? { ...c, ...patch } : c)), [])

  const addAction = () => setActions(p => [...p, { type: "notify", config: { title: "Alert", message: "Triggered for {{lead_name}}" } }])
  const removeAction = (i: number) => setActions(p => p.filter((_, idx) => idx !== i))
  const updateAction = useCallback((i: number, a: AutomationAction) =>
    setActions(p => p.map((old, idx) => idx === i ? a : old)), [])

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Automation name is required"); return }
    await onSave({ name: name.trim(), description: description.trim() || null, triggerType, triggerConfig, conditions, actions })
  }

  const trig = TRIGGER_OPTIONS.find(t => t.value === triggerType)

  return (
    <div className="space-y-4">
      {/* Name + Description */}
      <div className="space-y-2">
        <input
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Automation name…"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-input bg-background px-4 py-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Short description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      {/* TRIGGER */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-b border-primary/20">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">W</div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">When — Trigger</span>
        </div>
        <div className="p-4">
          <Select value={triggerType} onValueChange={v => { setTriggerType(v); setTriggerConfig({}) }}>
            <SelectTrigger className="text-sm">
              <SelectValue>
                {trig && <span>{trig.icon} {trig.label}</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trigger-specific config */}
          {triggerType === "lead_score_updated" && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Min score</label>
              <input type="number" className={cn(inputCls, "w-20")} placeholder="e.g. 80" value={(triggerConfig.minScore as number) ?? ""} onChange={e => setTriggerConfig(c => ({ ...c, minScore: Number(e.target.value) }))} />
              <label className="text-xs text-muted-foreground whitespace-nowrap">Max score</label>
              <input type="number" className={cn(inputCls, "w-20")} placeholder="optional" value={(triggerConfig.maxScore as number) ?? ""} onChange={e => setTriggerConfig(c => ({ ...c, maxScore: Number(e.target.value) || undefined }))} />
            </div>
          )}
          {triggerType === "lead_status_changed" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From status</label>
              <Select value={(triggerConfig.fromStatus as string) ?? ""} onValueChange={v => setTriggerConfig(c => ({ ...c, fromStatus: v }))}>
                <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <label className="text-xs text-muted-foreground whitespace-nowrap">→ To</label>
              <Select value={(triggerConfig.toStatus as string) ?? ""} onValueChange={v => setTriggerConfig(c => ({ ...c, toStatus: v }))}>
                <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {triggerType === "tag_added" && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Tag</label>
              <input className={cn(inputCls, "flex-1")} placeholder="e.g. hot-lead (leave blank for any)" value={(triggerConfig.tag as string) ?? ""} onChange={e => setTriggerConfig(c => ({ ...c, tag: e.target.value }))} />
            </div>
          )}
        </div>
      </div>

      {/* CONDITIONS */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">IF</div>
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Conditions (optional)</span>
          <Filter className="h-3 w-3 text-amber-600 ml-0.5" />
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs gap-1 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" onClick={addCondition}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        <div className="p-4 space-y-2">
          {conditions.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No conditions — automation runs on every trigger event.</p>
          )}
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              {i > 0 && <span className="text-[10px] font-semibold text-amber-600 w-6">AND</span>}
              {i === 0 && <span className="text-[10px] font-semibold text-muted-foreground w-6">IF</span>}
              <Select value={c.field} onValueChange={v => updateCondition(i, { field: v })}>
                <SelectTrigger className="h-7 text-xs w-36 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={c.operator} onValueChange={v => updateCondition(i, { operator: v })}>
                <SelectTrigger className="h-7 text-xs w-36 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              {!["is_empty", "is_not_empty"].includes(c.operator) && (
                <input
                  className={cn(inputCls, "h-7 flex-1 min-w-[80px]")}
                  placeholder="Value…"
                  value={c.value as string ?? ""}
                  onChange={e => updateCondition(i, { value: e.target.value })}
                />
              )}
              <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">→</div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Then — Actions</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs gap-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" onClick={addAction}>
            <Plus className="h-3 w-3" /> Add Action
          </Button>
        </div>
        <div className="p-4 space-y-0">
          {actions.map((a, i) => (
            <ActionBlock key={i} action={a} index={i} total={actions.length} onChange={updateAction} onRemove={removeAction} />
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-2 justify-end pt-1">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Automation
        </Button>
      </div>
    </div>
  )
}

// ─── Automation Row Card ──────────────────────────────────

function AutomationRow({ automation }: { automation: Automation }) {
  const [editing,  setEditing]  = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [testing,  setTesting]  = useState(false)

  const toggle  = useToggleAutomation()
  const del     = useDeleteAutomation()
  const clone   = useCloneAutomation()
  const update  = useUpdateAutomation()
  const testAuto = useTestAutomation()
  const { data: logs = [] } = useAutomationLogs(showLogs ? automation.id : undefined)

  const handleDelete = () => {
    if (!confirm(`Delete "${automation.name}"? This cannot be undone.`)) return
    del.mutateAsync(automation.id).then(() => toast.success("Automation deleted")).catch(() => toast.error("Failed to delete"))
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      await testAuto.mutateAsync({ id: automation.id })
      toast.success("Test triggered — check Logs tab for results")
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed")
    } finally {
      setTesting(false) }
  }

  const handleSaveEdit = async (data: Partial<Automation>) => {
    await update.mutateAsync({ id: automation.id, ...data })
    toast.success("Automation updated")
    setEditing(false)
  }

  const isActive = automation.isActive

  return (
    <div className={cn("rounded-xl border transition-all duration-200", isActive ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card")}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base mt-0.5", isActive ? "bg-primary/10" : "bg-muted")}>
          {triggerIcon(automation.triggerType)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className="text-sm font-semibold truncate">{automation.name}</p>
              {isActive
                ? <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 shrink-0">Active</Badge>
                : <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Inactive</Badge>
              }
              {automation.lastRunStatus && (
                <Badge variant="outline" className={cn("text-[10px] shrink-0", statusBg(automation.lastRunStatus))}>
                  <span className={statusColor(automation.lastRunStatus)}>
                    {automation.lastRunStatus === "success" ? "✓ " : automation.lastRunStatus === "error" ? "✕ " : ""}
                    {automation.lastRunStatus}
                  </span>
                </Badge>
              )}
            </div>
            {/* Toggle */}
            <button
              onClick={() => toggle.mutate(automation.id)}
              disabled={toggle.isPending}
              className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", isActive ? "bg-primary" : "bg-muted-foreground/30")}
            >
              <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", isActive ? "translate-x-4" : "translate-x-0.5")} />
            </button>
          </div>

          {automation.description && <p className="text-xs text-muted-foreground mb-2">{automation.description}</p>}

          {/* Flow summary */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 font-medium text-[11px]">
              ⚡ {triggerLabel(automation.triggerType)}
            </span>
            {automation.conditions.length > 0 && (
              <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[11px]">
                {automation.conditions.length} condition{automation.conditions.length !== 1 ? "s" : ""}
              </span>
            )}
            {automation.actions.map((a, i) => (
              <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{actionLabel(a.type)}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-border/40 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <Activity className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          {automation.runCount} run{automation.runCount !== 1 ? "s" : ""}
          {automation.lastRunAt && ` · Last: ${new Date(automation.lastRunAt).toLocaleDateString()}`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowLogs(v => !v)}>
            <Activity className="h-3 w-3" /> Logs{showLogs ? " ▴" : ""}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleTest} disabled={testing || testAuto.isPending}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube2 className="h-3 w-3" />} Test
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { clone.mutate(automation.id); toast.success("Cloned!") }} disabled={clone.isPending}>
            <Copy className="h-3 w-3" /> Clone
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(v => !v)}>
            <Edit2 className="h-3 w-3" /> {editing ? "Close" : "Edit"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={del.isPending}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Inline logs */}
      <AnimatePresence>
        {showLogs && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border/40 px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground">Recent Executions</p>
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No executions yet</p>
              ) : logs.slice(0, 10).map(log => (
                <div key={log.id} className={cn("rounded-lg border px-3 py-2 text-xs", statusBg(log.status))}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={cn("font-medium", statusColor(log.status))}>
                      {log.status === "success" ? "✓" : log.status === "error" ? "✕" : log.status === "skipped" ? "⟩" : "~"} {log.status}
                    </span>
                    <span className="text-muted-foreground text-[10px]">{new Date(log.createdAt).toLocaleString()} · {log.durationMs}ms</span>
                  </div>
                  {log.actionsExecuted?.map((a, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate">↳ {a.type}: {a.result}{a.error ? ` ✕ ${a.error}` : ""}</p>
                  ))}
                  {log.errorMessage && <p className="text-[10px] text-destructive mt-1">Error: {log.errorMessage}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline editor */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-border/40 p-4">
              <FlowEditor
                initial={automation}
                onSave={handleSaveEdit}
                onCancel={() => setEditing(false)}
                saving={update.isPending}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────

function TemplateCard({ tpl, onCreate }: { tpl: typeof TEMPLATES[0]; onCreate: (tpl: typeof TEMPLATES[0]) => void }) {
  const Icon = tpl.icon
  return (
    <div className="rounded-xl border border-border/60 bg-card flex flex-col">
      <div className="flex items-start gap-3 p-4 flex-1">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5", tpl.bg)}>
          <Icon className={cn("h-4 w-4", tpl.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold mb-1">{tpl.name}</p>
          <p className="text-xs text-muted-foreground mb-2">{tpl.description}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">
              ⚡ {triggerLabel(tpl.triggerType)}
            </span>
            {tpl.conditions.length > 0 && (
              <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[11px]">
                {tpl.conditions.length} condition{tpl.conditions.length !== 1 ? "s" : ""}
              </span>
            )}
            {tpl.actions.map((a, i) => (
              <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{actionLabel(a.type)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={() => onCreate(tpl)}>
          <Sparkles className="h-3.5 w-3.5" /> Use Template
        </Button>
      </div>
    </div>
  )
}

// ─── Logs Tab ─────────────────────────────────────────────

function LogsTab() {
  const { data: logs = [], isLoading } = useAutomationLogs(undefined, 100)

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (!logs.length) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-16 text-center gap-3">
      <Activity className="h-8 w-8 text-muted-foreground opacity-40" />
      <p className="text-sm font-medium">No automation runs yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">Enable automations and they'll appear here when they run. Logs include timestamps, lead IDs, and action outcomes.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{logs.length} execution{logs.length !== 1 ? "s" : ""} recorded</p>
        <div className="flex gap-1.5">
          {["success","partial","error","skipped"].map(s => (
            <span key={s} className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", statusBg(s), statusColor(s))}>
              {logs.filter(l => l.status === s).length} {s}
            </span>
          ))}
        </div>
      </div>
      {logs.map(log => (
        <div key={log.id} className={cn("rounded-xl border px-4 py-3", statusBg(log.status))}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {log.status === "success" ? <CheckCircle2 className={cn("h-3.5 w-3.5", statusColor(log.status))} /> :
               log.status === "error"   ? <AlertCircle  className={cn("h-3.5 w-3.5", statusColor(log.status))} /> :
               log.status === "skipped" ? <SkipForward  className={cn("h-3.5 w-3.5", statusColor(log.status))} /> :
                                          <Info         className={cn("h-3.5 w-3.5", statusColor(log.status))} />}
              <span className={cn("text-xs font-semibold capitalize", statusColor(log.status))}>{log.status}</span>
              <span className="text-xs text-muted-foreground">{triggerLabel(log.triggerType)}</span>
              {log.leadId && <span className="text-[10px] text-muted-foreground">Lead #{log.leadId}</span>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
              {log.durationMs && <p className="text-[10px] text-muted-foreground">{log.durationMs}ms</p>}
            </div>
          </div>
          {log.actionsExecuted?.length > 0 && (
            <div className="space-y-1">
              {log.actionsExecuted.map((a, i) => (
                <div key={i} className={cn("flex items-start gap-2 rounded-md px-2 py-1.5", a.error ? "bg-destructive/5" : "bg-background/50")}>
                  {a.error ? <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium">{actionLabel(a.type)}</span>
                    <p className="text-[10px] text-muted-foreground truncate">{a.result}</p>
                    {a.error && <p className="text-[10px] text-destructive">{a.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {log.errorMessage && (
            <p className="text-[11px] text-destructive mt-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {log.errorMessage}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────

export default function AutomationsPage() {
  const [tab,    setTab]    = useState("automations")
  const [saving, setSaving] = useState(false)

  const { data: automationsList = [], isLoading } = useAutomations()
  const create = useCreateAutomation()
  const clone  = useCloneAutomation()

  const handleCreate = async (data: Partial<Automation>) => {
    setSaving(true)
    try {
      await create.mutateAsync({ ...data, isActive: false })
      toast.success("Automation created!")
      setTab("automations")
    } catch {
      toast.error("Failed to create automation")
    } finally {
      setSaving(false)
    }
  }

  const handleUseTemplate = async (tpl: typeof TEMPLATES[0]) => {
    try {
      await create.mutateAsync({
        name:          tpl.name,
        description:   tpl.description,
        triggerType:   tpl.triggerType,
        triggerConfig: tpl.triggerConfig,
        conditions:    tpl.conditions as Condition[],
        actions:       tpl.actions as AutomationAction[],
        isActive:      false,
      })
      toast.success(`"${tpl.name}" added to your automations — customize and activate it there.`)
      setTab("automations")
    } catch {
      toast.error("Failed to add template")
    }
  }

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        title="Automations"
        description="Build, customize, and manage automated workflows. Every field is fully editable."
        actions={
          <Button size="sm" className="gap-2" onClick={() => setTab("builder")}>
            <Plus className="h-4 w-4" /> New Automation
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="automations" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            My Automations
            {automationsList.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{automationsList.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Builder
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* ── My Automations ── */}
        <TabsContent value="automations" className="mt-0 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : automationsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card py-16 text-center gap-3">
              <Zap className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium">No automations yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Start from a template or build a custom workflow from scratch.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setTab("templates")}><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Browse Templates</Button>
                <Button size="sm" onClick={() => setTab("builder")}><Plus className="h-3.5 w-3.5 mr-1.5" /> Build Custom</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{automationsList.filter(a => a.isActive).length} active · {automationsList.filter(a => !a.isActive).length} inactive</span>
                <span>Toggle to activate · Edit to customize · Clone to duplicate</span>
              </div>
              {automationsList.map(a => <AutomationRow key={a.id} automation={a} />)}
            </>
          )}
        </TabsContent>

        {/* ── Templates ── */}
        <TabsContent value="templates" className="mt-0">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Template Library</p>
              <p className="text-xs text-muted-foreground">Click "Use Template" to add a fully customizable copy to your automations.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} onCreate={handleUseTemplate} />
            ))}
          </div>
        </TabsContent>

        {/* ── Builder ── */}
        <TabsContent value="builder" className="mt-0">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/40 bg-muted/30">
              <GitBranch className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Visual Flow Builder</p>
              <p className="text-xs text-muted-foreground ml-1">— Design a new automation from scratch</p>
            </div>
            <div className="p-5">
              <FlowEditor onSave={handleCreate} saving={saving} />
            </div>
          </div>
        </TabsContent>

        {/* ── Logs ── */}
        <TabsContent value="logs" className="mt-0">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

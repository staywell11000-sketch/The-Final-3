import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Brain, MessageSquare, TrendingUp, Star, BarChart3, Zap, AlertTriangle,
  Send, Bot, User, Loader2, Activity, Hash, DollarSign, Lock, Home,
  FileText, ArrowRight, ChevronDown, ChevronUp, Sparkles, CreditCard,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import { format } from "date-fns"
import { usePlan } from "@/lib/plan-context"
import { meetsRequirement, type PlanSlug, PLAN_DISPLAY } from "@/lib/plan-features"

// ── Types ─────────────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "assistant"; content: string; ts: Date }

type ModuleAction = "bulk-analysis" | "deal-insights" | "business-insights" | "risk-detection" | "contextual" | "open-chat" | "open-usage"

interface AIModule {
  id: string
  icon: React.ElementType
  title: string
  description: string
  requiredPlan: PlanSlug
  action: ModuleAction
  contextNote?: string
  actionLabel?: string
  category: "professional" | "agency"
}

const AI_MODULES: AIModule[] = [
  {
    id: "ai_summaries",
    icon: FileText,
    title: "AI Lead Summaries",
    description: "Concise summaries of lead budget, interests, property requirements, conversation history, and recommended next action — generated for every lead.",
    requiredPlan: "professional",
    action: "contextual",
    contextNote: "Open any lead profile → AI Summary tab",
    category: "professional",
  },
  {
    id: "ai_reply_suggestions",
    icon: MessageSquare,
    title: "AI Reply Suggestions",
    description: "Generate 3 tailored WhatsApp reply options inside any conversation. Copy, edit, or send directly without leaving the chat.",
    requiredPlan: "professional",
    action: "contextual",
    contextNote: "Open any WhatsApp conversation → AI Replies",
    category: "professional",
  },
  {
    id: "ai_scoring",
    icon: Star,
    title: "AI Lead Scoring",
    description: "Auto-score all leads 0–100 using 5 signals: budget fit, engagement level, message frequency, activity recency, and deal stage.",
    requiredPlan: "agency",
    action: "bulk-analysis",
    actionLabel: "Run Bulk Analysis",
    category: "agency",
  },
  {
    id: "ai_deal_insights",
    icon: TrendingUp,
    title: "AI Deal Insights",
    description: "Analyze conversion probability, deal risk, opportunity strength, and follow-up priorities across your entire pipeline.",
    requiredPlan: "agency",
    action: "deal-insights",
    actionLabel: "Generate Insights",
    category: "agency",
  },
  {
    id: "ai_business_insights",
    icon: BarChart3,
    title: "AI Business Insights",
    description: "Daily, weekly, and monthly business summaries — leads received, deals closed, top agent, top campaign, and conversion trends.",
    requiredPlan: "agency",
    action: "business-insights",
    actionLabel: "Generate Summary",
    category: "agency",
  },
  {
    id: "ai_risk_detection",
    icon: AlertTriangle,
    title: "AI Risk Detection",
    description: "Identify uncontacted leads, cold leads, stalled deals, and missed opportunities before they fall through the cracks.",
    requiredPlan: "agency",
    action: "risk-detection",
    actionLabel: "Scan for Risks",
    category: "agency",
  },
  {
    id: "ai_property_matching",
    icon: Home,
    title: "AI Property Matching",
    description: "Match each lead's requirements — budget, location, and plot size — with available properties in your portfolio.",
    requiredPlan: "agency",
    action: "contextual",
    contextNote: "Open any lead profile → Property Matches tab",
    category: "agency",
  },
  {
    id: "ai_chat",
    icon: Bot,
    title: "AI Chatbot",
    description: "Interactive GPT-4o Mini assistant with full CRM context. Ask about any lead, deal, pipeline health, or closing strategy.",
    requiredPlan: "agency",
    action: "open-chat",
    actionLabel: "Open Chat",
    category: "agency",
  },
]

// ── Plan badge ─────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: PlanSlug }) {
  const colors: Record<PlanSlug, string> = {
    free: "bg-slate-100 text-slate-600 border-slate-200",
    trial: "bg-slate-100 text-slate-600 border-slate-200",
    starter: "bg-blue-50 text-blue-700 border-blue-200",
    professional: "bg-purple-50 text-purple-700 border-purple-200",
    agency: "bg-amber-50 text-amber-700 border-amber-200",
  }
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", colors[plan])}>
      {PLAN_DISPLAY[plan].name}
    </Badge>
  )
}

// ── Module Card ────────────────────────────────────────────────────────────────
function AIModuleCard({
  module, available, loading, result, onAction, onSwitchTab,
}: {
  module: AIModule
  available: boolean
  loading: boolean
  result: any
  onAction: (module: AIModule) => void
  onSwitchTab: (tab: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = module.icon
  const hasResult = result != null

  useEffect(() => {
    if (hasResult) setExpanded(true)
  }, [hasResult])

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200",
      available
        ? "border-border/60 bg-card hover:border-border"
        : "border-dashed border-border/40 bg-muted/10"
    )}>
      <div className="flex items-start gap-3.5 p-4">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5",
          available ? "bg-primary/10" : "bg-muted"
        )}>
          {available
            ? <Icon className="h-4 w-4 text-primary" />
            : <Lock className="h-4 w-4 text-muted-foreground/50" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={cn("text-sm font-semibold", available ? "text-foreground" : "text-muted-foreground/70")}>{module.title}</p>
            <PlanBadge plan={module.requiredPlan} />
            {available && <Badge className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">Active</Badge>}
          </div>
          <p className={cn("text-xs leading-relaxed", available ? "text-muted-foreground" : "text-muted-foreground/50")}>{module.description}</p>

          {available && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {module.action === "contextual" && module.contextNote && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 rounded-md px-2.5 py-1">
                  <ArrowRight className="h-3 w-3" /> {module.contextNote}
                </span>
              )}
              {module.action === "open-chat" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onSwitchTab("chat")}>
                  <Bot className="h-3.5 w-3.5" /> {module.actionLabel}
                </Button>
              )}
              {module.action === "open-usage" && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onSwitchTab("usage")}>
                  <Activity className="h-3.5 w-3.5" /> {module.actionLabel}
                </Button>
              )}
              {["bulk-analysis", "deal-insights", "business-insights", "risk-detection"].includes(module.action) && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onAction(module)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {loading ? "Analyzing…" : module.actionLabel}
                </Button>
              )}
              {hasResult && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setExpanded(v => !v)}>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expanded ? "Hide results" : "View results"}
                </Button>
              )}
            </div>
          )}

          {!available && (
            <div className="mt-2">
              <span className="text-[11px] text-muted-foreground/50">
                Upgrade to {PLAN_DISPLAY[module.requiredPlan].name} to unlock
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Results panel */}
      {available && expanded && hasResult && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <ResultPanel moduleId={module.id} result={result} />
        </div>
      )}
    </div>
  )
}

// ── Result Panels ─────────────────────────────────────────────────────────────
function ResultPanel({ moduleId, result }: { moduleId: string; result: any }) {
  if (moduleId === "ai_scoring") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground mb-2">Bulk Analysis Results</p>
        {result.processed > 0
          ? <p className="text-xs text-muted-foreground">✓ Analyzed {result.processed} lead{result.processed !== 1 ? "s" : ""}. Scores updated in lead profiles.</p>
          : <p className="text-xs text-muted-foreground">No leads found to analyze.</p>
        }
      </div>
    )
  }

  if (moduleId === "ai_deal_insights") {
    const ins = result.insights ?? {}
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold">Pipeline Score</p>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            ins.pipelineScore >= 70 ? "bg-green-100 text-green-700" :
            ins.pipelineScore >= 40 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          )}>{ins.pipelineScore ?? "—"}/100</span>
          {ins.conversionProbability && <span className="text-xs text-muted-foreground">{ins.conversionProbability}</span>}
        </div>
        {ins.summary && <p className="text-xs text-muted-foreground leading-relaxed">{ins.summary}</p>}
        {(ins.riskItems ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Risks</p>
            <div className="space-y-1">
              {ins.riskItems.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                    r.severity === "high" ? "bg-red-500" : r.severity === "medium" ? "bg-amber-500" : "bg-blue-400"
                  )} />
                  <span className="font-medium">{r.deal}</span>
                  <span className="text-muted-foreground">— {r.risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(ins.followUpPriorities ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Follow-Up Priorities</p>
            <div className="space-y-1">
              {ins.followUpPriorities.slice(0, 3).map((f: any, i: number) => (
                <div key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{f.deal}</span> — {f.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (moduleId === "ai_business_insights") {
    const ins = result.insights ?? {}
    return (
      <div className="space-y-3">
        {ins.summary && <p className="text-xs text-muted-foreground leading-relaxed">{ins.summary}</p>}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Leads Received", value: ins.leadsReceived },
            { label: "Deals Closed", value: ins.dealsClosed },
            { label: "Top Agent", value: ins.topAgent },
            { label: "Conversion Rate", value: ins.conversionRate },
          ].filter(i => i.value != null).map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold">{String(value)}</p>
            </div>
          ))}
        </div>
        {(ins.keyInsights ?? []).length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Key Insights</p>
            <ul className="space-y-1">
              {ins.keyInsights.map((insight: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary shrink-0">•</span>{insight}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (moduleId === "ai_risk_detection") {
    const risks = result.risks ?? {}
    const allRisks = [
      ...(risks.uncontactedLeads ?? []).map((l: string) => ({ label: l, type: "Uncontacted" })),
      ...(risks.coldLeads ?? []).map((l: string) => ({ label: l, type: "Cold Lead" })),
      ...(risks.stalledDeals ?? []).map((d: string) => ({ label: d, type: "Stalled Deal" })),
      ...(risks.missedOpportunities ?? []).map((o: string) => ({ label: o, type: "Missed" })),
    ]
    return (
      <div className="space-y-2">
        {risks.summary && <p className="text-xs text-muted-foreground leading-relaxed">{risks.summary}</p>}
        {allRisks.length === 0
          ? <p className="text-xs text-green-600">✓ No major risks detected. Pipeline looks healthy.</p>
          : (
            <div className="space-y-1.5">
              {allRisks.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5",
                    r.type === "Uncontacted" ? "border-red-200 text-red-600" :
                    r.type === "Cold Lead" ? "border-blue-200 text-blue-600" :
                    r.type === "Stalled Deal" ? "border-amber-200 text-amber-600" :
                    "border-muted text-muted-foreground"
                  )}>{r.type}</Badge>
                  <span className="text-foreground truncate">{r.label}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    )
  }

  return <p className="text-xs text-muted-foreground">{JSON.stringify(result)}</p>
}

// ── Modules Tab ───────────────────────────────────────────────────────────────
function ModulesTab({ plan, isSuperAdmin, onSwitchTab }: { plan: string; isSuperAdmin: boolean; onSwitchTab: (tab: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, any>>({})
  const [period, setPeriod] = useState("weekly")

  const isAvailable = (requiredPlan: PlanSlug) => isSuperAdmin || meetsRequirement(plan, requiredPlan)

  const runAction = async (module: AIModule) => {
    setLoading(module.id)
    try {
      if (module.action === "bulk-analysis") {
        const res = await apiFetch("/ai/analyze-all", { method: "POST" })
        const data = await res.json()
        setResults(prev => ({ ...prev, [module.id]: data }))
      } else if (module.action === "deal-insights") {
        const res = await apiFetch("/ai/deal-insights", { method: "POST" })
        const data = await res.json()
        setResults(prev => ({ ...prev, [module.id]: data }))
      } else if (module.action === "business-insights") {
        const res = await apiFetch("/ai/business-insights", { method: "POST", body: JSON.stringify({ period }), headers: { "Content-Type": "application/json" } })
        const data = await res.json()
        setResults(prev => ({ ...prev, [module.id]: data }))
      } else if (module.action === "risk-detection") {
        const res = await apiFetch("/ai/risk-detection", { method: "POST" })
        const data = await res.json()
        setResults(prev => ({ ...prev, [module.id]: data }))
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase?.() ?? ""
      const errorText = msg.includes("action") || msg.includes("exhausted") || msg.includes("limit")
        ? "AI Actions exhausted. Purchase a Booster or upgrade your plan."
        : msg.includes("upgrade") || msg.includes("plan")
        ? "Upgrade your plan to access this AI feature."
        : "AI service temporarily unavailable. Please try again."
      setResults(prev => ({ ...prev, [module.id]: { error: errorText } }))
    } finally {
      setLoading(null)
    }
  }

  const professional = AI_MODULES.filter(m => m.category === "professional")
  const agency = AI_MODULES.filter(m => m.category === "agency")

  return (
    <div className="space-y-6">
      {/* Professional features */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-foreground">Professional Features</p>
          <Badge variant="outline" className="text-[10px] px-1.5 bg-purple-50 text-purple-700 border-purple-200">Professional +</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {professional.map(module => (
            <AIModuleCard
              key={module.id}
              module={module}
              available={isAvailable(module.requiredPlan)}
              loading={loading === module.id}
              result={results[module.id]}
              onAction={runAction}
              onSwitchTab={onSwitchTab}
            />
          ))}
        </div>
      </div>

      {/* Agency features */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-semibold text-foreground">Agency Features</p>
          <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-50 text-amber-700 border-amber-200">Agency</Badge>
        </div>

        {/* Period selector for business insights */}
        {isAvailable("agency") && (
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-muted-foreground">Business Insights period:</p>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agency.map(module => (
            <AIModuleCard
              key={module.id}
              module={module}
              available={isAvailable(module.requiredPlan)}
              loading={loading === module.id}
              result={results[module.id]}
              onAction={runAction}
              onSwitchTab={onSwitchTab}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── AI Chat Tab ───────────────────────────────────────────────────────────────
function AIChatTab({ plan, isSuperAdmin }: { plan: string; isSuperAdmin: boolean }) {
  const isAgency = isSuperAdmin || meetsRequirement(plan, "agency")
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm your AI CRM assistant with full context of your leads, deals, and pipeline. Ask me anything — who to follow up with, pipeline health, closing strategies, or lead scores.", ts: new Date() }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const userMsg: ChatMsg = { role: "user", content: text, ts: new Date() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)
    try {
      const payload = updated.map(m => ({ role: m.role, content: m.content }))
      const res = await apiFetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data.error === "ai_actions_exhausted"
          ? "AI Actions exhausted. Purchase a Booster or upgrade your plan."
          : data.error === "ai_plan_upgrade_required"
          ? "Upgrade your plan to use AI Chat."
          : "AI service temporarily unavailable."
        setMessages(prev => [...prev, { role: "assistant", content: errMsg, ts: new Date() }])
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond.", ts: new Date() }])
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "AI service temporarily unavailable. Please try again.", ts: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const suggestions = [
    "Which leads should I follow up with today?",
    "What's my pipeline health looking like?",
    "Who are my hottest leads right now?",
    "Give me a closing strategy for my top deal",
  ]

  if (!isAgency) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10 py-16 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <Bot className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <p className="text-base font-semibold">AI Chatbot — Agency Feature</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Upgrade to Agency to unlock the GPT-4o Mini CRM assistant with full pipeline context.</p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1">Agency Plan Required</Badge>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 480 }}>
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3.5 bg-muted/30">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">CRM AI Assistant</p>
          <p className="text-xs text-muted-foreground">GPT-4o Mini · Full CRM context</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px] px-2 py-0.5 text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20">Live</Badge>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs mt-0.5",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted text-foreground rounded-tl-sm"
            )}>
              {msg.content}
              <p className={cn("text-[10px] mt-1 opacity-60", msg.role === "user" ? "text-right" : "")}>
                {format(msg.ts, "h:mm a")}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {messages.length <= 1 && (
        <div className="px-5 pb-2 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="border-t border-border/60 px-4 py-3 flex gap-2 items-end bg-background">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your leads, deals, or pipeline… (Enter to send)"
          className="resize-none min-h-[42px] max-h-32 text-sm border-border/50 focus-visible:ring-primary/30"
          rows={1}
        />
        <Button size="icon" onClick={send} disabled={!input.trim() || loading} className="h-10 w-10 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

// ── Usage Tab ─────────────────────────────────────────────────────────────────
function UsageTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage-detail"],
    queryFn: () => apiFetch("/ai/usage").then(r => r.json()),
  })

  const usage = data?.usage
  const log: any[] = data?.log ?? []

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading usage…</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tokens", value: (usage?.totalTokens ?? 0).toLocaleString(), icon: Hash, sub: "This month" },
          { label: "Prompt Tokens", value: (usage?.promptTokens ?? 0).toLocaleString(), icon: Activity, sub: "Input" },
          { label: "Completion Tokens", value: (usage?.completionTokens ?? 0).toLocaleString(), icon: Activity, sub: "Output" },
          { label: "Est. Cost", value: `$${(usage?.estimatedCost ?? 0).toFixed(4)}`, icon: DollarSign, sub: "USD · GPT-4o Mini" },
        ].map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border/60">
          <p className="text-sm font-semibold">AI Operation Log</p>
          <p className="text-xs text-muted-foreground">Last 50 AI calls across all features</p>
        </div>
        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Activity className="h-5 w-5 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {log.map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">{(entry.feature ?? "—").replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-muted-foreground">{entry.model ?? "gpt-4o-mini"}</span>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span>{(entry.total_tokens ?? 0).toLocaleString()} tokens</span>
                  <span className="font-mono">${Number(entry.estimated_cost ?? 0).toFixed(5)}</span>
                  <span>{entry.created_at ? format(new Date(entry.created_at), "MMM d · h:mm a") : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AIIntelligencePage() {
  const [tab, setTab] = useState("modules")
  const { org, isSuperAdmin } = usePlan()
  const plan = (org?.plan ?? "free") as PlanSlug
  const showChatLock = !isSuperAdmin && !meetsRequirement(plan, "agency")

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        title="AI Intelligence"
        description="8 AI modules powered by GPT-4o Mini — summaries, scoring, insights, risk detection, and more."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="modules" className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Modules
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
            {showChatLock && <Lock className="h-3 w-3 text-muted-foreground ml-0.5" />}
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Usage
          </TabsTrigger>
        </TabsList>
        <TabsContent value="modules" className="mt-0">
          <ModulesTab plan={plan} isSuperAdmin={isSuperAdmin} onSwitchTab={setTab} />
        </TabsContent>
        <TabsContent value="chat" className="mt-0">
          <AIChatTab plan={plan} isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        <TabsContent value="usage" className="mt-0">
          <UsageTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

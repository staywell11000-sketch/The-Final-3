import { useState } from "react"
import { FaWhatsapp } from "react-icons/fa"
import {
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Unplug, Zap,
  Copy, CheckCheck, ExternalLink, Webhook, Activity, ChevronDown,
  Plus, ShieldCheck, WifiOff, Lock, Users, Phone, Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWhatsAppHealth, useWhatsAppSyncTemplates, useWhatsAppDisconnect, type WhatsAppTemplate } from "@/lib/whatsapp-api"
import {
  useWaAccounts,
  useWaLimit,
  useDisconnectWaAccount,
  useSyncWaTemplates,
  useWaAccountHealth,
  type WhatsAppAccount,
} from "@/lib/whatsapp-accounts-api"
import { WhatsAppEmbeddedSignup } from "./WhatsAppConnect"
import { WhatsAppAccessPanel } from "./WhatsAppAccessPanel"
import { usePlan } from "@/lib/plan-context"
import { toast } from "sonner"

// ─── Shared helpers ───────────────────────────────────────

function TemplateBadge({ status }: { status: string }) {
  const cls =
    status === "APPROVED" ? "bg-green-500/10 text-green-600 border-green-500/20" :
    status === "PENDING"  ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
    status === "REJECTED" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                            "bg-secondary text-muted-foreground border-border/50"
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>
      {status}
    </span>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="rounded p-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function InfoRow({ label, value, mono = false, copyable = false }: {
  label: string; value: string | null | undefined; mono?: boolean; copyable?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn("text-xs text-foreground truncate", mono && "font-mono")}>{value}</span>
        {copyable && <CopyBtn value={value} />}
      </div>
    </div>
  )
}

function HealthDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", ok ? "bg-green-500" : "bg-red-500")} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function TemplatesTable({ templates }: { templates: WhatsAppTemplate[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? templates : templates.slice(0, 5)
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground hidden sm:table-cell">Language</th>
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground hidden sm:table-cell">Category</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{t.name}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{t.language}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell capitalize">{t.category?.toLowerCase()}</td>
                <td className="px-3 py-2 text-right"><TemplateBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {templates.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Show fewer" : `Show all ${templates.length} templates`}
        </button>
      )}
    </div>
  )
}

// ─── Per-account card ─────────────────────────────────────

function AccountCard({ account }: { account: WhatsAppAccount }) {
  const [expanded, setExpanded]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const syncMut     = useSyncWaTemplates(account.id)
  const disconnMut  = useDisconnectWaAccount()
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useWaAccountHealth(account.id, expanded)

  const handleSync = async () => {
    try {
      const r = await syncMut.mutateAsync()
      toast.success(`Synced ${r.synced} template${r.synced !== 1 ? "s" : ""}`)
    } catch (err: any) {
      toast.error(err?.message ?? "Sync failed")
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnMut.mutateAsync(account.id)
      setConfirming(false)
      toast.success("WhatsApp account disconnected")
    } catch (err: any) {
      toast.error(err?.message ?? "Disconnect failed")
    }
  }

  const templates: WhatsAppTemplate[] = account.templates ?? []

  return (
    <div className="glass-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/10">
          <FaWhatsapp className="h-5 w-5 text-[#25D366]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {account.displayName ?? account.businessName ?? "WhatsApp Account"}
          </p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
            {account.phoneNumber
              ? <><Phone className="h-3 w-3 shrink-0" />{account.phoneNumber}</>
              : <span className="italic">No phone number fetched</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn("text-[10px] border", account.status === "active" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
            {account.status}
          </Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {/* Account info */}
          <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 divide-y divide-border/40">
            <InfoRow label="Business Name"   value={account.businessName} />
            <InfoRow label="Phone Number"    value={account.phoneNumber} />
            <InfoRow label="Phone Number ID" value={account.phoneNumberId} mono copyable />
            <InfoRow label="WABA ID"         value={account.wabaId}        mono copyable />
            <InfoRow
              label="Last Synced"
              value={account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : "—"}
            />
          </div>

          {/* Health */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Connection Health</span>
              </div>
              <button
                onClick={() => refetchHealth()}
                className="rounded-lg p-1.5 hover:bg-secondary transition-colors text-muted-foreground"
                title="Refresh"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", healthLoading && "animate-spin")} />
              </button>
            </div>
            {health ? (
              <div className="flex flex-wrap gap-4">
                <HealthDot ok={(health as any).tokenValid} label="Token valid" />
                <HealthDot ok={(health as any).phoneValid} label="Phone accessible" />
                {(health as any).warnings?.map((w: string, i: number) => (
                  <div key={i} className="w-full flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
                {(health as any).healthy && (
                  <div className="w-full flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All checks passed
                  </div>
                )}
              </div>
            ) : healthLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" /> Health check not run yet
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  Templates {templates.length > 0 ? `(${templates.length})` : ""}
                </span>
              </div>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSync} disabled={syncMut.isPending}>
                {syncMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Sync
              </Button>
            </div>
            {templates.length > 0
              ? <TemplatesTable templates={templates} />
              : (
                <p className="text-xs text-muted-foreground italic px-1">
                  No templates synced — click Sync to pull from Meta
                </p>
              )
            }
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <WhatsAppEmbeddedSignup compact onSuccess={() => toast.success("Account reconnected")} />
            {!confirming ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => setConfirming(true)}
              >
                <Unplug className="h-3.5 w-3.5" /> Disconnect
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Disconnect this number?</span>
                <Button size="sm" variant="destructive" className="h-7 px-3 text-xs" onClick={handleDisconnect} disabled={disconnMut.isPending}>
                  {disconnMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, remove"}
                </Button>
                <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Plan limit bar ───────────────────────────────────────

function PlanLimitBar({ used, limit, plan }: { used: number; limit: number | null; plan: string }) {
  if (limit === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        Unlimited WhatsApp numbers on your <span className="capitalize font-medium text-foreground">{plan}</span> plan
      </div>
    )
  }
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const atLimit = used >= limit
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {used} / {limit} WhatsApp {limit === 1 ? "number" : "numbers"} used
        </span>
        {atLimit && (
          <span className="text-amber-600 font-medium flex items-center gap-1">
            <Lock className="h-3 w-3" /> Limit reached
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", atLimit ? "bg-amber-500" : "bg-[#25D366]")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main WhatsApp settings tab ───────────────────────────

export function WhatsAppSettingsTab() {
  const { data: accounts = [], isLoading }   = useWaAccounts()
  const { data: limit }                       = useWaLimit()
  const { isSuperAdmin }                      = usePlan()

  const atLimit = !isSuperAdmin && limit !== undefined
    ? (limit.limit !== null && limit.used >= (limit.limit ?? 0))
    : false

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading WhatsApp accounts…
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header + plan limit */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/10">
              <FaWhatsapp className="h-5 w-5 text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">WhatsApp Multi-Inbox</h3>
              <p className="text-sm text-muted-foreground">Connect multiple WhatsApp Business numbers for your organization</p>
            </div>
          </div>
        </div>

        {limit && (
          <PlanLimitBar used={limit.used} limit={limit.limit} plan={limit.plan} />
        )}

        {/* Connect new account button */}
        {!atLimit ? (
          <WhatsAppEmbeddedSignup
            onSuccess={() => toast.success("WhatsApp account connected")}
          />
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-amber-600" />
              <span className="text-amber-600 font-medium">Inbox limit reached</span>
              <span className="text-muted-foreground">— upgrade to add more numbers</span>
            </div>
            <a href="/dashboard/billing" className="text-xs text-primary hover:underline shrink-0">
              Upgrade plan
            </a>
          </div>
        )}
      </div>

      {/* Webhook info */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Webhook Configuration</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Use a single webhook for all your WhatsApp accounts. Configure in{" "}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Meta App Dashboard <ExternalLink className="inline h-3 w-3" />
          </a>
        </p>
        {process.env.NODE_ENV !== "production" && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <ShieldCheck className="h-3.5 w-3.5" /> Webhook verify token is configured
          </div>
        )}
      </div>

      {/* Connected accounts list */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10 mx-auto">
            <FaWhatsapp className="h-7 w-7 text-[#25D366]/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No WhatsApp accounts connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect your first WhatsApp Business number to start messaging leads
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Connected Accounts ({accounts.length})
          </h3>
          {accounts.map(account => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {/* ─── Team Access Management ──────────────────── */}
      <div className="border-t border-border/40 pt-6">
        <WhatsAppAccessPanel />
      </div>
    </div>
  )
}

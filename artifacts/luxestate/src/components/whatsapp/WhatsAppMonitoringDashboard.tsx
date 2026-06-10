import { useState } from "react"
import {
  Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Wifi, WifiOff, Clock, MessageSquare, Phone, Zap,
  ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWaAccounts, useWaAccountHealth, type WhatsAppAccount } from "@/lib/whatsapp-accounts-api"
import { useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"

function StatusDot({ status }: { status: "healthy" | "warning" | "error" | "loading" }) {
  return (
    <span className={cn(
      "inline-block h-2 w-2 rounded-full shrink-0",
      status === "healthy"  && "bg-emerald-500",
      status === "warning"  && "bg-amber-500 animate-pulse",
      status === "error"    && "bg-red-500",
      status === "loading"  && "bg-muted animate-pulse",
    )} />
  )
}

function MetricCard({ label, value, icon: Icon, color = "text-foreground", sub }: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn("text-lg font-bold leading-none", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function AccountHealthCard({ account }: { account: WhatsAppAccount }) {
  const [expanded, setExpanded] = useState(false)
  const { data: health, isLoading, refetch } = useWaAccountHealth(account.id, true)

  const overallStatus =
    isLoading ? "loading" :
    !health    ? "error" :
    (health.tokenValid && health.phoneValid) ? "healthy" :
    health.tokenValid ? "warning" : "error"

  const statusLabel =
    isLoading ? "Checking…" :
    overallStatus === "healthy" ? "Connected" :
    overallStatus === "warning" ? "Partial" : "Error"

  const statusColor =
    overallStatus === "healthy" ? "text-emerald-600 dark:text-emerald-400" :
    overallStatus === "warning" ? "text-amber-600 dark:text-amber-400" :
    overallStatus === "loading" ? "text-muted-foreground" :
    "text-red-600 dark:text-red-400"

  const connectedSince = account.connectedAt
    ? formatDistanceToNow(new Date(account.connectedAt), { addSuffix: true })
    : "Unknown"

  const lastSync = account.lastSyncedAt
    ? formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })
    : "Never"

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366]/10 shrink-0">
          <FaWhatsapp className="h-4.5 w-4.5 text-[#25D366]" style={{ width: 18, height: 18 }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {account.displayName ?? account.phoneNumber ?? `Account #${account.id}`}
            </p>
            <StatusDot status={overallStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {account.phoneNumber ?? "No number"} · {account.businessName ?? ""}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-xs font-semibold", statusColor)}>{statusLabel}</span>
          <button
            onClick={(e) => { e.stopPropagation(); refetch() }}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh health check"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Token Status"
              value={isLoading ? "…" : health?.tokenValid ? "Valid" : "Invalid"}
              icon={isLoading ? RotateCcw : health?.tokenValid ? CheckCircle2 : XCircle}
              color={isLoading ? "text-muted-foreground" : health?.tokenValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
            />
            <MetricCard
              label="Number Status"
              value={isLoading ? "…" : health?.phoneValid ? "Active" : "Unreachable"}
              icon={isLoading ? RotateCcw : health?.phoneValid ? Phone : XCircle}
              color={isLoading ? "text-muted-foreground" : health?.phoneValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
            />
            <MetricCard
              label="Templates"
              value={account.templates.length}
              icon={MessageSquare}
              sub={account.templatesSyncedAt ? `Synced ${formatDistanceToNow(new Date(account.templatesSyncedAt), { addSuffix: true })}` : "Not synced yet"}
            />
            <MetricCard
              label="Connected"
              value={account.connectedAt ? format(new Date(account.connectedAt), "MMM d") : "—"}
              icon={Clock}
              sub={connectedSince}
            />
          </div>

          {health?.warnings && health.warnings.length > 0 && (
            <div className="space-y-1.5">
              {health.warnings.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
                </div>
              ))}
            </div>
          )}

          {health?.details && (
            <div className="rounded-lg bg-secondary/30 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Meta API Details</p>
              {health.details.fbName && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">FB Account</span>
                  <span className="text-foreground font-medium">{health.details.fbName as string}</span>
                </div>
              )}
              {health.details.displayPhone && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Phone Number</span>
                  <span className="text-foreground font-medium">{health.details.displayPhone as string}</span>
                </div>
              )}
              {health.details.verifiedName && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Verified Name</span>
                  <span className="text-foreground font-medium">{health.details.verifiedName as string}</span>
                </div>
              )}
              {health.details.qualityRating && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Quality Rating</span>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      health.details.qualityRating === "GREEN" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                      health.details.qualityRating === "YELLOW" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                      "bg-red-500/10 text-red-600 border-red-500/20"
                    )}
                    variant="outline"
                  >
                    {health.details.qualityRating as string}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
            <span>Last sync: {lastSync}</span>
            <span>Account ID: {account.id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function WhatsAppMonitoringDashboard() {
  const { data: accounts = [], isLoading, refetch } = useWaAccounts()
  const qc = useQueryClient()

  const refreshAll = () => {
    refetch()
    accounts.forEach(a => qc.invalidateQueries({ queryKey: ["waAccountHealth", a.id] }))
  }

  const totalConnected = accounts.filter(a => a.status === "active").length
  const totalAccounts  = accounts.length
  const hasExpired     = accounts.some(a => a.status === "expired" || a.status === "error")

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
          <h3 className="text-sm font-semibold text-foreground">WhatsApp Health Monitor</h3>
          {hasExpired && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
              Action Required
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refreshAll}
          className="h-7 gap-1.5 text-xs border-border/50"
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          Refresh All
        </Button>
      </div>

      {totalAccounts > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Total Numbers"
            value={totalAccounts}
            icon={FaWhatsapp as any}
            color="text-foreground"
          />
          <MetricCard
            label="Connected"
            value={totalConnected}
            icon={Wifi}
            color={totalConnected > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}
          />
          <MetricCard
            label="Status"
            value={hasExpired ? "Issues" : totalConnected === 0 ? "Offline" : "Healthy"}
            icon={hasExpired ? AlertTriangle : totalConnected === 0 ? WifiOff : Zap}
            color={hasExpired ? "text-amber-600 dark:text-amber-400" : totalConnected === 0 ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading accounts…
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center space-y-2">
          <WifiOff className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">No WhatsApp accounts connected</p>
          <p className="text-xs text-muted-foreground/70">Connect a number above to start monitoring</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <AccountHealthCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import { motion } from "framer-motion"
import { Users, Shield, ChevronDown, Eye, MessageCircle, UserCheck, Loader2, AlertCircle, Crown, Lock } from "lucide-react"
import { toast } from "sonner"
import {
  useWaPermissions,
  useSetWaPermission,
  useRevokeWaPermission,
  useWaAccounts,
  type OrgMemberPermission,
} from "@/lib/whatsapp-accounts-api"

// ─── Permission level helpers ─────────────────────────────

type PermLevel = "none" | "view" | "reply" | "full"

function toLevel(canView: boolean, canReply: boolean, canAssign: boolean): PermLevel {
  if (!canView) return "none"
  if (canView && !canReply && !canAssign) return "view"
  if (canView && canReply && !canAssign) return "reply"
  return "full"
}

const LEVEL_CONFIG: Record<PermLevel, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  none:  { label: "No Access",   color: "text-muted-foreground",    bg: "bg-muted/40",           border: "border-border/40",      icon: Lock },
  view:  { label: "View Only",   color: "text-blue-600",            bg: "bg-blue-500/10",         border: "border-blue-500/20",    icon: Eye },
  reply: { label: "Can Reply",   color: "text-amber-600",           bg: "bg-amber-500/10",        border: "border-amber-500/20",   icon: MessageCircle },
  full:  { label: "Full Access", color: "text-emerald-600",         bg: "bg-emerald-500/10",      border: "border-emerald-500/20", icon: UserCheck },
}

function levelToPerms(level: PermLevel): { canView: boolean; canReply: boolean; canAssign: boolean } {
  if (level === "none")  return { canView: false, canReply: false, canAssign: false }
  if (level === "view")  return { canView: true,  canReply: false, canAssign: false }
  if (level === "reply") return { canView: true,  canReply: true,  canAssign: false }
  return                        { canView: true,  canReply: true,  canAssign: true  }
}

// ─── PermDropdown ─────────────────────────────────────────

function PermDropdown({
  value,
  onChange,
  disabled,
  loading,
}: {
  value:    PermLevel
  onChange: (level: PermLevel) => void
  disabled: boolean
  loading:  boolean
}) {
  const [open, setOpen] = useState(false)
  const cfg = LEVEL_CONFIG[value]
  const Icon = cfg.icon

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium
          transition-all duration-150 select-none
          ${cfg.bg} ${cfg.color} ${cfg.border}
          ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"}
        `}
      >
        {loading
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Icon className="h-3 w-3" />
        }
        <span className="hidden sm:inline">{cfg.label}</span>
        {!disabled && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 min-w-[130px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden">
            {(["none", "view", "reply", "full"] as PermLevel[]).map(lvl => {
              const c = LEVEL_CONFIG[lvl]
              const LvlIcon = c.icon
              return (
                <button
                  key={lvl}
                  onClick={() => { onChange(lvl); setOpen(false) }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left
                    transition-colors hover:bg-muted/60
                    ${lvl === value ? `${c.color} ${c.bg}` : "text-foreground"}
                  `}
                >
                  <LvlIcon className={`h-3 w-3 ${c.color}`} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── OrgRole badge ────────────────────────────────────────

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null
  const map: Record<string, { label: string; className: string }> = {
    admin:   { label: "Admin",   className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    manager: { label: "Manager", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    agent:   { label: "Agent",   className: "bg-muted/60 text-muted-foreground border-border/40" },
    custom:  { label: "Custom",  className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  }
  const cfg = map[role] ?? { label: role, className: "bg-muted/60 text-muted-foreground border-border/40" }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ─── Member row ───────────────────────────────────────────

function MemberRow({
  member,
  accounts,
  ownerId,
}: {
  member:   OrgMemberPermission
  accounts: Array<{ id: number; displayName: string | null; phoneNumber: string | null }>
  ownerId?: string
}) {
  const setPermission   = useSetWaPermission()
  const revokePermission = useRevokeWaPermission()
  const [pending, setPending] = useState<Record<number, boolean>>({})

  const isOwner   = member.userId === ownerId
  const isAdmin   = member.orgRole === "admin"
  const autoAccess = isOwner || isAdmin

  const initials = (() => {
    const parts = (member.userName ?? member.userEmail ?? "U").split(" ").filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0]?.[0]?.toUpperCase() ?? "U"
  })()

  const handleChange = async (accountId: number, level: PermLevel) => {
    setPending(p => ({ ...p, [accountId]: true }))
    try {
      if (level === "none") {
        await revokePermission.mutateAsync({ userId: member.userId, accountId })
      } else {
        await setPermission.mutateAsync({
          userId:           member.userId,
          whatsappAccountId: accountId,
          ...levelToPerms(level),
        })
      }
      toast.success("Permission updated")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update permission")
    } finally {
      setPending(p => ({ ...p, [accountId]: false }))
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
      {/* Avatar + name */}
      <div className="flex items-center gap-2.5 w-44 shrink-0">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate">{member.userName ?? "Unknown"}</span>
            {isOwner && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                <Crown className="h-2.5 w-2.5" /> Owner
              </span>
            )}
            {!isOwner && <RoleBadge role={member.orgRole} />}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{member.userEmail ?? ""}</p>
        </div>
      </div>

      {/* Permission dropdowns per account */}
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        {accounts.map(acct => {
          const perm  = member.accounts.find(a => a.accountId === acct.id)
          const level = autoAccess
            ? "full"
            : toLevel(perm?.canView ?? false, perm?.canReply ?? false, perm?.canAssign ?? false)

          return (
            <div key={acct.id} className="flex flex-col gap-0.5 min-w-[110px]">
              <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                {acct.phoneNumber ?? acct.displayName ?? `Inbox ${acct.id}`}
              </span>
              <PermDropdown
                value={level}
                onChange={newLevel => handleChange(acct.id, newLevel)}
                disabled={autoAccess || !!pending[acct.id]}
                loading={!!pending[acct.id]}
              />
            </div>
          )
        })}

        {accounts.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No WhatsApp accounts connected</p>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────

export function WhatsAppAccessPanel() {
  const { data: members = [], isLoading: loadingPerms, error: permsError, refetch } = useWaPermissions()
  const { data: accounts = [], isLoading: loadingAccounts } = useWaAccounts()

  const loading = loadingPerms || loadingAccounts

  // Find owner (first member with null orgRole that isn't an admin, or detect from context)
  const ownerMember = members.find(m => m.orgRole === null) ?? members[0]

  const accountCols = accounts.map(a => ({
    id:          a.id,
    displayName: a.displayName,
    phoneNumber: a.phoneNumber,
  }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Team WhatsApp Access</h3>
            <p className="text-xs text-muted-foreground">Control which team members can access each inbox</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
        >
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">Permission levels:</span>
        {(["none", "view", "reply", "full"] as PermLevel[]).map(lvl => {
          const cfg = LEVEL_CONFIG[lvl]
          const Icon = cfg.icon
          return (
            <span key={lvl} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              <Icon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : permsError ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Could not load permissions. Only org owners and admins can manage this.</span>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No team members found</p>
          <p className="text-xs text-muted-foreground/60">Invite team members first to manage their access</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/50 bg-card/50 px-4 divide-y divide-border/20"
        >
          {/* Column headers */}
          {accountCols.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-44 shrink-0" />
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {accountCols.map(acct => (
                  <div key={acct.id} className="min-w-[110px]">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate max-w-[110px]">
                      {acct.phoneNumber ?? acct.displayName ?? `Inbox ${acct.id}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member rows */}
          {members.map(member => (
            <MemberRow
              key={member.userId}
              member={member}
              accounts={accountCols}
              ownerId={ownerMember?.userId}
            />
          ))}
        </motion.div>
      )}

      {/* Info note */}
      <p className="text-[11px] text-muted-foreground px-1">
        <strong>Owners</strong> and <strong>Admins</strong> always have full access to all inboxes.
        <strong> No Access</strong> hides the inbox completely from that team member.
      </p>
    </div>
  )
}

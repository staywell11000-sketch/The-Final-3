import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DashboardPageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Users2, Plus, Shield, Phone, Mail, MoreHorizontal,
  Loader2, Trash2, X, ClipboardList, UserCheck, UserX,
  TrendingUp, Star, ChevronDown, Key, Copy, CheckCheck,
  Send, ShieldCheck, ShieldX, Settings2, Users, Clock,
  AlertTriangle, BarChart2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { surfaceInputClass, surfaceSelectClass } from "@/lib/ui-classes"
import {
  useTeamMembers, useCreateTeamMember, useUpdateTeamMember,
  useDeleteTeamMember, useAssignLead, TeamMember, TeamRole, CreateMemberInput,
} from "@/lib/team-api"
import {
  useOrgMembers, useInvitations, useCreateInvitation, useDeleteInvitation,
  useUpdateMemberStatus, useUpdateMemberRole, usePasswordReset,
  useRolePermissions, useUpdateRolePermissions, OrgMember,
} from "@/lib/org-members-api"
import { usePermissions } from "@/lib/permissions-context"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
const RESOURCES = [
  "dashboard", "leads", "messages", "properties", "dealers",
  "analytics", "ai_intelligence", "automations", "team",
  "deals", "documents", "calendar", "settings",
] as const

const ACTIONS = ["view", "create", "edit", "delete"] as const

type TabId = "members" | "invitations" | "permissions" | "agents"

const ORG_ROLES = ["admin", "manager", "agent", "custom"] as const
type OrgRoleType = typeof ORG_ROLES[number]

const roleConfig: Record<OrgRoleType, { label: string; color: string; bg: string }> = {
  admin:   { label: "Admin",   color: "text-red-500",     bg: "bg-red-500/10 border-red-500/20" },
  manager: { label: "Manager", color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20" },
  agent:   { label: "Agent",   color: "text-primary",     bg: "bg-primary/10 border-primary/20" },
  custom:  { label: "Custom",  color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
}

const resourceLabels: Record<string, string> = {
  dashboard: "Dashboard", leads: "Leads", messages: "Messages",
  properties: "Properties", dealers: "Dealers", analytics: "Analytics",
  ai_intelligence: "AI Intelligence", automations: "Automations",
  team: "Team", deals: "Deals", documents: "Documents",
  calendar: "Calendar", settings: "Settings",
}

function initials(name: string | null | undefined) {
  return (name ?? "").split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const createInvite = useCreateInvitation()
  const [form, setForm] = useState({ name: "", email: "", phone: "", orgRole: "agent" })
  const [result, setResult] = useState<{ invitationCode: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required")
      return
    }
    try {
      const data = await createInvite.mutateAsync({ name: form.name, email: form.email, phone: form.phone, orgRole: form.orgRole })
      setResult(data)
      toast.success("Invitation created")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create invitation")
    }
  }

  const copyCode = () => {
    if (result?.invitationCode) {
      navigator.clipboard.writeText(result.invitationCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareViaWhatsApp = () => {
    if (!result?.invitationCode) return
    const appUrl = window.location.origin + "/accept-invite"
    const msg = encodeURIComponent(
      `Hi ${form.name}! You've been invited to join our team on LuxeState CRM.\n\n` +
      `To accept your invitation:\n` +
      `1. Visit: ${appUrl}\n` +
      `2. Enter your email: ${form.email}\n` +
      `3. Enter your invitation code: *${result.invitationCode}*\n\n` +
      `Your code expires in 7 days. Welcome to the team! 🎉`
    )
    const phone = form.phone.replace(/\D/g, "")
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`
    window.open(waUrl, "_blank")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <p className="font-semibold text-foreground">Invite Team Member</p>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="space-y-3">
              <Input
                placeholder="Full name *"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={surfaceInputClass}
                required
              />
              <Input
                type="email"
                placeholder="Email address *"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={surfaceInputClass}
                required
              />
              <Input
                type="tel"
                placeholder="Phone / WhatsApp number (optional)"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={surfaceInputClass}
              />
              <div className="relative">
                <select
                  value={form.orgRole}
                  onChange={(e) => setForm((p) => ({ ...p, orgRole: e.target.value }))}
                  className={surfaceSelectClass}
                >
                  {ORG_ROLES.map((r) => (
                    <option key={r} value={r}>{roleConfig[r].label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="border-border/50">Cancel</Button>
              <Button type="submit" disabled={createInvite.isPending} className="bg-primary hover:bg-primary/90 gap-2">
                {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Generate Invitation
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Invitation Created!</p>
                <p className="text-sm text-muted-foreground">Share this code with {form.name}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Invitation Code</p>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-3xl font-bold tracking-widest text-foreground">
                  {result.invitationCode}
                </p>
                <Button size="sm" variant="outline" onClick={copyCode} className="shrink-0 border-border/50">
                  {copied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Instructions:</strong> Ask {form.name} to visit the CRM and click "Accept Invitation". They'll enter their email <strong>{form.email}</strong> and this code to create their account.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={shareViaWhatsApp}
                className="flex-1 gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                <Phone className="h-4 w-4" />
                Share via WhatsApp
              </Button>
              <Button variant="outline" onClick={onClose} className="border-border/50">Done</Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Member Performance Modal ──────────────────────────────────────────────────

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""

function MemberPerformanceModal({ member, open, onClose }: {
  member: OrgMember | null; open: boolean; onClose: () => void
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !member) return
    setLoading(true)
    setError(null)
    fetch(`${BASE_URL}/api/analytics/member/${member.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError("Failed to load performance data"); setLoading(false) })
  }, [open, member])

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toLocaleString()}`

  const fmtDate = (s: string | null) => {
    if (!s) return "Never"
    const d = new Date(s)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Member Performance
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Member info */}
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/10 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-sm font-bold text-primary-foreground">
                {(member?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{member?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{member?.orgRole} · {member?.email}</p>
              </div>
            </div>

            {/* Lead stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Leads</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Leads", value: data.leads.total, color: "text-foreground" },
                  { label: "Active", value: data.leads.active, color: "text-blue-500" },
                  { label: "Won", value: data.leads.won, color: "text-emerald-500" },
                  { label: "Conversion", value: `${data.leads.conversionRate}%`, color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/40 bg-secondary/10 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Deal stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deals</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Open Deals", value: data.deals.open, color: "text-foreground" },
                  { label: "Won Deals", value: data.deals.won, color: "text-emerald-500" },
                  { label: "Pipeline Value", value: fmt(data.deals.pipelineValue), color: "text-blue-500" },
                  { label: "Revenue Won", value: fmt(data.deals.wonValue), color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/40 bg-secondary/10 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Activities */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/10 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Activities</p>
                <p className="text-lg font-bold text-foreground">{data.activities.total}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Last Active</p>
                <p className="text-sm font-medium text-foreground">{fmtDate(data.activities.lastActive)}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({ member, isCurrentUser }: { member: OrgMember; isCurrentUser: boolean }) {
  const updateStatus = useUpdateMemberStatus()
  const updateRole = useUpdateMemberRole()
  const passwordReset = usePasswordReset()
  const [showPerf, setShowPerf] = useState(false)

  const cfg = roleConfig[member.orgRole as OrgRoleType] ?? roleConfig.agent

  const handleStatus = async (isActive: boolean) => {
    try {
      await updateStatus.mutateAsync({ userId: member.id, isActive })
      toast.success(isActive ? "Member reactivated" : "Member deactivated")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update status")
    }
  }

  const handleRole = async (orgRole: string) => {
    try {
      await updateRole.mutateAsync({ userId: member.id, orgRole })
      toast.success("Role updated")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update role")
    }
  }

  const handlePasswordReset = async () => {
    try {
      await passwordReset.mutateAsync(member.id)
      toast.success("Password reset email sent")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reset password")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-secondary/20 transition-colors border-b border-border/20 last:border-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          member.isActive ? "bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {initials(member.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn("truncate text-sm font-medium", !member.isActive && "text-muted-foreground line-through")}>
              {member.name}
            </p>
            {member.isOwner && (
              <Badge variant="outline" className="h-4 text-[9px] border-amber-500/30 text-amber-600 bg-amber-500/10 shrink-0">Owner</Badge>
            )}
            {isCurrentUser && (
              <Badge variant="outline" className="h-4 text-[9px] border-primary/30 text-primary bg-primary/5 shrink-0">You</Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-xs capitalize", cfg.bg, cfg.color)}>
          {cfg.label}
        </Badge>
        <Badge variant="outline" className={cn("text-xs", member.isActive ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/10" : "border-border/40 text-muted-foreground")}>
          {member.isActive ? "Active" : "Inactive"}
        </Badge>
        <p className="text-xs text-muted-foreground hidden lg:block">{fmtDate(member.createdAt)}</p>
      </div>

      {!member.isOwner && !isCurrentUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">Change Role</p>
            </div>
            {ORG_ROLES.filter((r) => r !== "admin" || !member.isOwner).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => handleRole(r)}
                className={cn("gap-2 text-xs", member.orgRole === r && "text-primary font-medium")}
              >
                <div className={cn("h-2 w-2 rounded-full", roleConfig[r].color.replace("text-", "bg-"))} />
                {roleConfig[r].label}
                {member.orgRole === r && " ✓"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowPerf(true)} className="gap-2">
              <BarChart2 className="h-3.5 w-3.5" /> View Performance
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePasswordReset} className="gap-2">
              <Key className="h-3.5 w-3.5" /> Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {member.isActive ? (
              <DropdownMenuItem
                onClick={() => handleStatus(false)}
                className="gap-2 text-amber-600 focus:text-amber-600"
              >
                <UserX className="h-3.5 w-3.5" /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleStatus(true)}
                className="gap-2 text-emerald-600 focus:text-emerald-600"
              >
                <UserCheck className="h-3.5 w-3.5" /> Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <MemberPerformanceModal member={member} open={showPerf} onClose={() => setShowPerf(false)} />
    </motion.div>
  )
}

// ── Permissions Matrix ────────────────────────────────────────────────────────

function PermissionsMatrix() {
  const { data, isLoading } = useRolePermissions()
  const updateRolePerms = useUpdateRolePermissions()
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, boolean>>({})

  const startEdit = (roleName: string) => {
    const rolePerms = data?.roles[roleName] ?? []
    const map: Record<string, boolean> = {}
    for (const res of RESOURCES) {
      for (const act of ACTIONS) {
        map[`${res}:${act}`] = rolePerms.some((p) => p.resource === res && p.action === act)
      }
    }
    setDraft(map)
    setEditingRole(roleName)
  }

  const cancelEdit = () => { setEditingRole(null); setDraft({}) }

  const saveEdit = async () => {
    if (!editingRole) return
    const permissions = Object.entries(draft)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [resource, action] = key.split(":")
        return { resource, action }
      })
    try {
      await updateRolePerms.mutateAsync({ roleName: editingRole, permissions })
      toast.success(`${editingRole} permissions updated`)
      setEditingRole(null)
      setDraft({})
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update permissions")
    }
  }

  const toggle = (res: string, act: string) => {
    const key = `${res}:${act}`
    setDraft((p) => ({ ...p, [key]: !p[key] }))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const roles = ["manager", "agent", "custom"] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Role Permissions</p>
          <p className="text-xs text-muted-foreground mt-0.5">Configure what each role can access. Admin role always has full access.</p>
        </div>
      </div>

      {roles.map((roleName) => {
        const isEditing = editingRole === roleName
        const rolePerms = isEditing ? null : data?.roles[roleName] ?? []
        const cfg = roleConfig[roleName]

        return (
          <div key={roleName} className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <Badge variant="outline" className={cn("capitalize font-semibold", cfg.bg, cfg.color)}>
                {cfg.label}
              </Badge>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={cancelEdit} className="h-7 text-xs border-border/50">Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={updateRolePerms.isPending} className="h-7 text-xs bg-primary hover:bg-primary/90">
                      {updateRolePerms.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => startEdit(roleName)} className="h-7 gap-1 text-xs border-border/50">
                    <Settings2 className="h-3 w-3" /> Edit
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">Resource</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {RESOURCES.map((res) => (
                    <tr key={res} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-2 text-xs font-medium text-foreground">
                        {resourceLabels[res] ?? res}
                      </td>
                      {ACTIONS.map((act) => {
                        const key = `${res}:${act}`
                        const checked = isEditing
                          ? draft[key] ?? false
                          : (rolePerms as any[])?.some((p: any) => p.resource === res && p.action === act) ?? false
                        return (
                          <td key={act} className="px-3 py-2 text-center">
                            {isEditing ? (
                              <button
                                onClick={() => toggle(res, act)}
                                className={cn(
                                  "mx-auto flex h-5 w-5 items-center justify-center rounded border transition-colors",
                                  checked
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border/50 hover:border-primary/50"
                                )}
                              >
                                {checked && <CheckCheck className="h-3 w-3" />}
                              </button>
                            ) : (
                              <div className={cn(
                                "mx-auto h-2.5 w-2.5 rounded-full",
                                checked ? "bg-emerald-500" : "bg-border/30"
                              )} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Invitations Tab ───────────────────────────────────────────────────────────

function InvitationsTab({ onInvite }: { onInvite: () => void }) {
  const { data: invitations = [], isLoading } = useInvitations()
  const deleteInvite = useDeleteInvitation()
  const [revokeId, setRevokeId] = useState<number | null>(null)

  const pending = invitations.filter((i) => !i.acceptedAt && new Date(i.expiresAt) > new Date())
  const accepted = invitations.filter((i) => !!i.acceptedAt)
  const expired = invitations.filter((i) => !i.acceptedAt && new Date(i.expiresAt) <= new Date())

  const handleRevoke = async () => {
    if (!revokeId) return
    try {
      await deleteInvite.mutateAsync(revokeId)
      toast.success("Invitation revoked")
    } catch {
      toast.error("Failed to revoke invitation")
    }
    setRevokeId(null)
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} pending · {accepted.length} accepted
        </p>
        <Button onClick={onInvite} className="gap-2 bg-primary hover:bg-primary/90 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Invitation
        </Button>
      </div>

      {invitations.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
          <Send className="h-8 w-8 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No invitations yet</p>
          <p className="text-sm text-muted-foreground">Invite your team members to join the CRM.</p>
          <Button onClick={onInvite} className="mt-2 gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Invite Member
          </Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-border/20">
          {[...pending, ...accepted, ...expired].map((inv) => {
            const isPending = !inv.acceptedAt && new Date(inv.expiresAt) > new Date()
            const isExpired = !inv.acceptedAt && new Date(inv.expiresAt) <= new Date()
            const cfg = roleConfig[inv.orgRole as OrgRoleType] ?? roleConfig.agent
            return (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    inv.acceptedAt ? "bg-emerald-500/10 text-emerald-600" :
                    isExpired ? "bg-muted text-muted-foreground" :
                    "bg-amber-500/10 text-amber-600"
                  )}>
                    {initials(inv.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{inv.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{inv.email}</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0 ml-4">
                  <Badge variant="outline" className={cn("text-xs", cfg.bg, cfg.color)}>{cfg.label}</Badge>
                  {isPending && (
                    <Badge variant="outline" className="text-xs border-amber-500/20 text-amber-600 bg-amber-500/10 gap-1">
                      <Clock className="h-2.5 w-2.5" /> Pending
                    </Badge>
                  )}
                  {inv.acceptedAt && (
                    <Badge variant="outline" className="text-xs border-emerald-500/20 text-emerald-600 bg-emerald-500/10">Accepted</Badge>
                  )}
                  {isExpired && (
                    <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground">Expired</Badge>
                  )}
                  <p className="text-xs text-muted-foreground hidden lg:block">
                    Code: <span className="font-mono font-bold">{inv.invitationCode}</span>
                  </p>
                </div>
                {isPending && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setRevokeId(inv.id)}
                    title="Revoke invitation"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the invitation. The invited person will no longer be able to use this code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { user } = useAuth()
  const { isAdmin } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabId>("members")
  const [showInvite, setShowInvite] = useState(false)

  const { data: orgMembers = [], isLoading: orgLoading } = useOrgMembers()
  const { data: legacyMembers = [], isLoading: legacyLoading } = useTeamMembers()

  const activeMembers = orgMembers.filter((m) => m.isActive)
  const adminCount = orgMembers.filter((m) => m.orgRole === "admin" || m.isOwner).length

  const tabs: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "members", label: "Organization Members", icon: Users, count: orgMembers.length },
    ...(isAdmin ? [
      { id: "invitations" as TabId, label: "Invitations", icon: Send },
      { id: "permissions" as TabId, label: "Permissions", icon: Shield },
    ] : []),
    { id: "agents", label: "Agent Profiles", icon: Users2, count: legacyMembers.length },
  ]

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Team Management"
        description="Manage your organization members, invitations, and permissions."
        actions={
          isAdmin && (
            <Button
              onClick={() => { setActiveTab("invitations"); setShowInvite(true) }}
              className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
            >
              <Plus className="h-4 w-4" /> Invite Member
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Members",  value: orgMembers.length,           icon: Users,    color: undefined },
          { label: "Active",         value: activeMembers.length,         icon: UserCheck, color: "text-emerald-500" },
          { label: "Admins",         value: adminCount,                   icon: Shield,   color: "text-red-500" },
          { label: "Agent Profiles", value: legacyMembers.length,         icon: Users2,   color: "text-primary" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <s.icon className={cn("h-4 w-4", s.color ?? "text-muted-foreground")} />
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <Badge variant="secondary" className="h-4 text-[10px] px-1 min-w-[16px]">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "members" && (
          <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {orgLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : orgMembers.length === 0 ? (
              <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No organization members yet</p>
                {isAdmin && (
                  <Button onClick={() => { setActiveTab("invitations"); setShowInvite(true) }} className="mt-2 gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4" /> Invite Member
                  </Button>
                )}
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {orgMembers.length} member{orgMembers.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  {orgMembers.map((m) => (
                    <MemberRow key={m.id} member={m} isCurrentUser={m.id === user?.id} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "invitations" && isAdmin && (
          <motion.div key="invitations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InvitationsTab onInvite={() => setShowInvite(true)} />
          </motion.div>
        )}

        {activeTab === "permissions" && isAdmin && (
          <motion.div key="permissions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PermissionsMatrix />
          </motion.div>
        )}

        {activeTab === "agents" && (
          <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LegacyAgentsTab />
          </motion.div>
        )}
      </AnimatePresence>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}

// ── Legacy Agents Tab (preserves existing functionality) ──────────────────────

function LegacyAgentsTab() {
  const { data: members = [], isLoading, error } = useTeamMembers()
  const createMember = useCreateTeamMember()
  const updateMember = useUpdateTeamMember()
  const deleteMember = useDeleteTeamMember()
  const assignLead = useAssignLead()

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const legacyRoles = ["admin", "manager", "agent"] as const
  type LegacyRole = typeof legacyRoles[number]
  const legacyRoleConfig = roleConfig

  const handleCreate = async (data: CreateMemberInput) => {
    try {
      await createMember.mutateAsync(data)
      toast.success("Agent profile added")
      setShowCreate(false)
    } catch {
      toast.error("Failed to add agent")
    }
  }

  const handleUpdate = async (id: number, data: CreateMemberInput) => {
    try {
      await updateMember.mutateAsync({ id, updates: data })
      toast.success("Agent updated")
      setEditingId(null)
    } catch {
      toast.error("Failed to update agent")
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteMember.mutateAsync(deleteId)
      toast.success("Agent removed")
    } catch {
      toast.error("Failed to remove agent")
    }
    setDeleteId(null)
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Agent profiles for lead assignment and performance tracking</p>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary hover:bg-primary/90 h-8 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Agent
        </Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <AgentForm
            title="Add Agent Profile"
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={createMember.isPending}
          />
        )}
      </AnimatePresence>

      {members.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 py-16 text-center">
          <Users2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No agent profiles yet</p>
          <Button onClick={() => setShowCreate(true)} className="mt-2 gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Agent
          </Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-border/20">
          {members.map((m) => {
            const cfg = legacyRoleConfig[(m.role as LegacyRole) ?? "agent"] ?? legacyRoleConfig.agent
            const isEditing = editingId === m.id
            return (
              <div key={m.id}>
                {isEditing ? (
                  <div className="p-4">
                    <AgentForm
                      title={`Edit — ${m.name}`}
                      initial={m}
                      onSave={(data) => handleUpdate(m.id, data)}
                      onCancel={() => setEditingId(null)}
                      saving={updateMember.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-sm font-bold text-primary-foreground">
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-xs capitalize", cfg.bg, cfg.color)}>{cfg.label}</Badge>
                      <Badge variant="outline" className="text-xs">{m.assignedLeadsCount} leads</Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingId(m.id)} className="gap-2">
                          <Settings2 className="h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(m.id)} className="gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agent Profile?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the agent profile. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AgentForm({ initial, onSave, onCancel, saving, title }: {
  initial?: Partial<CreateMemberInput>
  onSave: (data: CreateMemberInput) => Promise<void>
  onCancel: () => void
  saving: boolean
  title: string
}) {
  const [form, setForm] = useState<CreateMemberInput>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    role: initial?.role ?? "agent",
    performanceScore: initial?.performanceScore ?? null,
    dateOfEmployment: initial?.dateOfEmployment ?? "",
  })

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    if (!form.email.trim()) { toast.error("Email is required"); return }
    await onSave(form)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="glass-card overflow-hidden border-primary/20"
    >
      <div className="p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input placeholder="Full name *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={surfaceInputClass} />
          <Input placeholder="Email address *" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={surfaceInputClass} />
          <Input placeholder="Phone number" value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={surfaceInputClass} />
          <div className="relative">
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as TeamRole }))} className={surfaceSelectClass}>
              {(["admin", "manager", "agent"] as TeamRole[]).map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="border-border/50">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

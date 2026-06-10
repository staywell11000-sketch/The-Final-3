import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { LeadImportModal } from "@/components/dashboard/lead-import-modal"
import { Lead } from "@/components/dashboard/leads-types"
import {
  Download, Upload, FileText, FileSpreadsheet,
  Users, Flame, Trophy, Handshake, CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── CSV export ────────────────────────────────────────────────────────────────
const ALL_FIELDS: { key: keyof Lead | string; label: string; default: boolean }[] = [
  { key: "name",        label: "Name",          default: true  },
  { key: "email",       label: "Email",         default: true  },
  { key: "phone",       label: "Phone",         default: true  },
  { key: "status",      label: "Status",        default: true  },
  { key: "priority",    label: "Priority",      default: true  },
  { key: "source",      label: "Source",        default: true  },
  { key: "campaign",    label: "Campaign",      default: true  },
  { key: "budget",      label: "Budget",        default: true  },
  { key: "property",    label: "Property",      default: true  },
  { key: "assignedTo",  label: "Assigned To",   default: true  },
  { key: "score",       label: "Score",         default: false },
  { key: "urgencyScore",label: "Urgency Score", default: false },
  { key: "lastContact", label: "Last Contact",  default: true  },
  { key: "tags",        label: "Tags",          default: false },
  { key: "whatsappNumber", label: "WhatsApp",   default: false },
]

function getVal(lead: Lead, key: string): string {
  const v = (lead as any)[key]
  if (v === null || v === undefined) return ""
  if (Array.isArray(v)) return v.join("; ")
  return String(v)
}

function buildCSV(leads: Lead[], fields: string[]): string {
  const header = fields.map((k) => ALL_FIELDS.find((f) => f.key === k)?.label ?? k)
  const rows = leads.map((l) => fields.map((k) => `"${getVal(l, k).replace(/"/g, '""')}"`))
  return [header, ...rows].map((r) => r.join(",")).join("\n")
}

function buildExcel(leads: Lead[], fields: string[]): string {
  const header = fields.map((k) => ALL_FIELDS.find((f) => f.key === k)?.label ?? k)
  const rows = leads.map((l) => fields.map((k) => getVal(l, k)))
  return [header, ...rows].map((r) => r.join("\t")).join("\n")
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Export Tab ────────────────────────────────────────────────────────────────
function ExportTab({ leads }: { leads: Lead[] }) {
  const [format, setFormat] = useState<"csv" | "excel">("csv")
  const [scope, setScope] = useState<"all" | "available" | "sold" | "hot">("all")
  const [fields, setFields] = useState<Set<string>>(
    () => new Set(ALL_FIELDS.filter((f) => f.default).map((f) => f.key as string))
  )

  const toggleField = (key: string) => {
    setFields((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const selectAll = () => setFields(new Set(ALL_FIELDS.map((f) => f.key as string)))
  const selectNone = () => setFields(new Set())

  const filteredLeads = leads.filter((l) => {
    if (scope === "available" || scope === "sold") return (l.status as string) === scope
    if (scope === "hot") return l.priority === "hot"
    return true
  })

  const handleDownload = () => {
    const fieldArr = ALL_FIELDS.filter((f) => fields.has(f.key as string)).map((f) => f.key as string)
    const date = new Date().toISOString().slice(0, 10)
    if (format === "csv") {
      triggerDownload(buildCSV(filteredLeads, fieldArr), `leads-${date}.csv`, "text/csv;charset=utf-8;")
    } else {
      triggerDownload(buildExcel(filteredLeads, fieldArr), `leads-${date}.xls`, "application/vnd.ms-excel")
    }
  }

  const stats = [
    { label: "Total",       value: leads.length,                                              icon: Users,     color: "text-sky-500",    bg: "bg-sky-500/10" },
    { label: "Hot Leads",   value: leads.filter((l) => l.priority === "hot").length,          icon: Flame,     color: "text-rose-500",   bg: "bg-rose-500/10" },
    { label: "Deals Won",   value: leads.filter((l) => l.status === "won").length,            icon: Trophy,    color: "text-emerald-500",bg: "bg-emerald-500/10" },
    { label: "Negotiation", value: leads.filter((l) => l.status === "negotiation").length,    icon: Handshake, color: "text-amber-500",  bg: "bg-amber-500/10" },
  ]

  return (
    <div className="space-y-5 p-1">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
            <div className={cn("mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Format */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</p>
          <div className="flex flex-col gap-2">
            {(["csv", "excel"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                  format === f ? "border-primary/40 bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                {f === "csv"
                  ? <FileText className="h-5 w-5 text-emerald-500 shrink-0" />
                  : <FileSpreadsheet className="h-5 w-5 text-sky-500 shrink-0" />
                }
                <div>
                  <p className="text-sm font-medium">{f === "csv" ? "CSV" : "Excel (.xls)"}</p>
                  <p className="text-[10px] text-muted-foreground">{f === "csv" ? "Universal — works in Excel, Sheets, Numbers" : "Opens directly in Microsoft Excel"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Which Leads</p>
          <div className="flex flex-col gap-2">
            {([
              { v: "all",       label: "All Leads",         count: leads.length },
              { v: "hot",       label: "Hot Leads Only",    count: leads.filter((l) => l.priority === "hot").length },
              { v: "available", label: "Status: Available", count: leads.filter((l) => l.status === "available" as any).length },
              { v: "sold",      label: "Status: Won",       count: leads.filter((l) => l.status === "won").length },
            ] as const).map((s) => (
              <button
                key={s.v}
                onClick={() => setScope(s.v)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all text-sm",
                  scope === s.v ? "border-primary/40 bg-primary/5 font-medium text-foreground" : "border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                {s.label}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums">{s.count}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Columns to Export</p>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-[11px] text-primary hover:underline">Select all</button>
            <span className="text-muted-foreground text-[11px]">·</span>
            <button onClick={selectNone} className="text-[11px] text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
          {ALL_FIELDS.map((f) => (
            <label key={f.key as string} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={fields.has(f.key as string)}
                onCheckedChange={() => toggleField(f.key as string)}
                className="h-3.5 w-3.5"
              />
              <span className="text-xs text-foreground">{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Download button */}
      <Button
        className="w-full gap-2"
        disabled={fields.size === 0 || filteredLeads.length === 0}
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" />
        Download {filteredLeads.length} Lead{filteredLeads.length !== 1 ? "s" : ""} as {format.toUpperCase()}
      </Button>
    </div>
  )
}

// ── Import Tab ────────────────────────────────────────────────────────────────
function ImportTab({ leads, onImport, onOpenImport }: { leads: Lead[]; onImport: (imported: Lead[]) => void; onOpenImport: () => void }) {
  return (
    <div className="space-y-4 p-1">
      <div className="rounded-xl border-2 border-dashed border-border/50 bg-muted/20 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
          <Upload className="h-7 w-7 text-primary/70" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">Import Leads from CSV or Excel</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Upload a spreadsheet with your leads. We'll map the columns, detect duplicates, and let you configure the import before anything is saved.
        </p>
        <Button className="mt-5 gap-2" onClick={onOpenImport}>
          <Upload className="h-4 w-4" /> Launch Import Wizard
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What the wizard supports</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { icon: FileText,       title: "CSV & Excel",          desc: ".csv, .xlsx, .xls files" },
            { icon: CheckSquare,    title: "Smart Column Mapping",  desc: "Auto-detects name, email, phone, etc." },
            { icon: Users,          title: "Duplicate Detection",   desc: "Flags duplicate emails & phone numbers" },
            { icon: FileSpreadsheet,title: "Bulk Configuration",    desc: "Set pipeline stage, agent, and tags" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card p-3">
              <item.icon className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
type Props = {
  open: boolean
  onClose: () => void
  leads: Lead[]
  onImport: (imported: Lead[]) => Promise<void>
  defaultTab?: "export" | "import"
}

export function LeadExportImportModal({ open, onClose, leads, onImport, defaultTab = "export" }: Props) {
  const [tab, setTab] = useState<"export" | "import">(defaultTab)
  const [importWizardOpen, setImportWizardOpen] = useState(false)

  const handleClose = () => {
    setTab(defaultTab)
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Export Leads
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "export" | "import")}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="export" className="flex-1 gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </TabsTrigger>
              <TabsTrigger value="import" className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Import Leads
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="mt-0">
              <ExportTab leads={leads} />
            </TabsContent>

            <TabsContent value="import" className="mt-0">
              <ImportTab
                leads={leads}
                onImport={onImport}
                onOpenImport={() => {
                  handleClose()
                  setImportWizardOpen(true)
                }}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Import wizard opens as its own full-screen dialog */}
      <LeadImportModal
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        existingLeads={leads}
        onImport={async (imported) => {
          setImportWizardOpen(false)
          await onImport(imported)
        }}
      />
    </>
  )
}

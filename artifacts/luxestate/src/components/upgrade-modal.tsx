import { Link } from "wouter"
import { Lock, CheckCircle2, ArrowRight, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PLAN_DISPLAY, FEATURE_CONFIG, type PlanSlug } from "@/lib/plan-features"
import { cn } from "@/lib/utils"

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  featureKey: string
  currentPlan: string
}

export function UpgradeModal({ open, onClose, featureKey, currentPlan }: UpgradeModalProps) {
  const config = FEATURE_CONFIG[featureKey]
  if (!config) return null

  const requiredPlan = config.requiredPlan as PlanSlug
  const required = PLAN_DISPLAY[requiredPlan]
  const current = PLAN_DISPLAY[(currentPlan as PlanSlug) ?? "free"]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Upgrade Plan</DialogTitle>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 px-6 pt-8 pb-6 border-b border-border/60">
          <button onClick={onClose} className="absolute right-4 top-4 h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>

          <h2 className="text-lg font-bold text-foreground mb-1">{config.name}</h2>
          <p className="text-sm text-muted-foreground">
            This feature is not available on your current plan.
          </p>

          <div className="flex items-center gap-2 mt-4">
            <Badge variant="outline" className="text-xs">
              Current: {current?.name ?? currentPlan}
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge className={cn("text-xs text-white border-0", required?.color ?? "bg-primary")}>
              Required: {required?.name}
            </Badge>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">What you'll get</p>
          </div>
          <ul className="space-y-2">
            {config.benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2 space-y-2.5">
          <Link href="/dashboard/billing" onClick={onClose}>
            <Button className="w-full gap-2 font-semibold">
              <ArrowRight className="h-4 w-4" />
              Upgrade to {required?.name} — Rs. {(required?.price ?? 0).toLocaleString()}/mo
            </Button>
          </Link>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

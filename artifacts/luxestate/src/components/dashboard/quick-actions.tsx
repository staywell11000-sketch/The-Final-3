import { useState } from "react"
import { useLocation } from "wouter"
import { motion } from "framer-motion"
import {
  UserPlus,
  Calendar,
  FileText,
  Send,
  Building2,
  Calculator,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddLeadModal } from "@/components/dashboard/add-lead-modal"
import { MortgageCalculatorModal } from "@/components/dashboard/mortgage-calculator-modal"
import { Lead } from "@/components/dashboard/leads-types"

type QuickActionsProps = {
  onLeadAdded?: (lead: Lead) => void
}

export function QuickActions({ onLeadAdded }: QuickActionsProps) {
  const [, navigate] = useLocation()
  const [showAddLead, setShowAddLead] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState("")
  const [broadcastSent, setBroadcastSent] = useState(false)

  const handleBroadcastSend = () => {
    if (!broadcastMsg.trim()) return
    setBroadcastSent(true)
    setTimeout(() => {
      setBroadcastSent(false)
      setBroadcastMsg("")
      setShowBroadcast(false)
    }, 1800)
  }

  const actions = [
    {
      name: "Add Lead",
      description: "Create new prospect",
      icon: UserPlus,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      hoverBg: "hover:bg-blue-500/20",
      onClick: () => setShowAddLead(true),
    },
    {
      name: "Schedule",
      description: "Book a viewing",
      icon: Calendar,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      hoverBg: "hover:bg-emerald-500/20",
      onClick: () => navigate("/dashboard/calendar"),
    },
    {
      name: "New Listing",
      description: "Add property",
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      hoverBg: "hover:bg-primary/20",
      onClick: () => navigate("/dashboard/properties"),
    },
    {
      name: "Send Proposal",
      description: "Create offer",
      icon: FileText,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      hoverBg: "hover:bg-purple-500/20",
      onClick: () => navigate("/dashboard/messages"),
    },
    {
      name: "Calculator",
      description: "Mortgage calc",
      icon: Calculator,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      hoverBg: "hover:bg-orange-500/20",
      onClick: () => setShowCalculator(true),
    },
    {
      name: "Broadcast",
      description: "Send to all",
      icon: Send,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      hoverBg: "hover:bg-green-500/20",
      onClick: () => setShowBroadcast(true),
    },
  ]

  return (
    <>
      <div className="glass-card p-6 h-full">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">Shortcuts for common tasks</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <motion.button
              key={action.name}
              onClick={action.onClick}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border/50 transition-all",
                action.hoverBg
              )}
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", action.bgColor)}>
                <action.icon className={cn("h-5 w-5", action.color)} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">{action.name}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        onAdd={async (lead) => {
          onLeadAdded?.(lead as any)
          navigate("/dashboard/leads")
          return undefined as any
        }}
      />

      {/* Mortgage Calculator */}
      <MortgageCalculatorModal open={showCalculator} onClose={() => setShowCalculator(false)} />

      {/* Broadcast modal */}
      {showBroadcast && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBroadcast(false) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass mx-4 w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10">
                <Send className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Broadcast Message</p>
                <p className="text-xs text-muted-foreground">Send to all active leads (7)</p>
              </div>
            </div>
            {broadcastSent ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <Send className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="font-semibold text-foreground">Broadcast sent!</p>
                <p className="text-sm text-muted-foreground">Message delivered to 7 leads via WhatsApp</p>
              </div>
            ) : (
              <>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Type your broadcast message to all leads..."
                  rows={4}
                  className="mb-4 w-full resize-none rounded-xl border border-border/50 bg-secondary/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBroadcast(false)}
                    className="flex-1 rounded-xl border border-border/50 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBroadcastSend}
                    disabled={!broadcastMsg.trim()}
                    className={cn(
                      "flex-1 rounded-xl py-2 text-sm font-semibold text-white transition-all",
                      broadcastMsg.trim()
                        ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                        : "bg-primary/30 cursor-not-allowed"
                    )}
                  >
                    Send to 7 Leads
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </>
  )
}

export type PlanSlug = "free" | "trial" | "starter" | "professional" | "agency"

export const PLAN_DISPLAY: Record<PlanSlug, { name: string; price: number; color: string }> = {
  free:         { name: "Free",         price: 0,     color: "bg-slate-500" },
  trial:        { name: "Free Trial",   price: 0,     color: "bg-slate-400" },
  starter:      { name: "Starter",      price: 9999,  color: "bg-blue-500" },
  professional: { name: "Professional", price: 19999, color: "bg-purple-500" },
  agency:       { name: "Agency",       price: 29999, color: "bg-amber-500" },
}

export const PLAN_ORDER: PlanSlug[] = ["free", "trial", "starter", "professional", "agency"]

export function meetsRequirement(currentPlan: string, requiredPlan: PlanSlug): boolean {
  const ci = PLAN_ORDER.indexOf(currentPlan as PlanSlug)
  const ri = PLAN_ORDER.indexOf(requiredPlan)
  return ci >= ri
}

export interface FeatureConfig {
  name: string
  requiredPlan: PlanSlug
  benefits: string[]
}

export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  lead_sources: {
    name: "Lead Sources & Integrations",
    requiredPlan: "professional",
    benefits: [
      "Connect WhatsApp, Facebook & Instagram",
      "Auto-import leads from Facebook Lead Ads",
      "Real-time sync with all lead channels",
      "Duplicate detection and smart merging",
    ],
  },
  messages: {
    name: "WhatsApp Messages",
    requiredPlan: "professional",
    benefits: [
      "WhatsApp conversation threads",
      "Template messages & broadcast lists",
      "Lead conversation history",
      "Multi-channel inbox",
    ],
  },
  documents: {
    name: "Documents",
    requiredPlan: "starter",
    benefits: [
      "Upload contracts, agreements & brochures",
      "Attach documents to leads and properties",
      "Secure cloud storage with access controls",
      "Document sharing with clients",
    ],
  },
  analytics: {
    name: "Analytics & Insights",
    requiredPlan: "starter",
    benefits: [
      "Conversion rate trends and forecasts",
      "Lead source performance breakdown",
      "Agent leaderboards and win rates",
      "Export reports as PDF",
    ],
  },
  calculator: {
    name: "Property Calculator",
    requiredPlan: "starter",
    benefits: [
      "EMI and mortgage calculator",
      "ROI projections for investments",
      "Commission breakdown tool",
      "Shareable client reports",
    ],
  },
  team: {
    name: "Team Management",
    requiredPlan: "professional",
    benefits: [
      "Invite unlimited team members",
      "Role-based access control",
      "Lead assignment by rules or manually",
      "Team performance dashboards",
    ],
  },
  deals: {
    name: "Deals Pipeline",
    requiredPlan: "professional",
    benefits: [
      "Visual Kanban deal pipeline",
      "Revenue forecasting by stage",
      "Deal value tracking and history",
      "Win/loss analysis and reports",
    ],
  },
  ai_intelligence: {
    name: "AI Intelligence",
    requiredPlan: "professional",
    benefits: [
      "AI Lead Summaries & Reply Suggestions",
      "GPT-4o powered CRM assistant (Agency)",
      "Lead scoring, deal insights & risk detection (Agency)",
      "AI property matching & business reports (Agency)",
    ],
  },
  ai_summaries: {
    name: "AI Lead Summaries",
    requiredPlan: "professional",
    benefits: [
      "Budget, interests & property requirement summaries",
      "Conversation history digest",
      "Recommended next action",
      "Available on every lead profile",
    ],
  },
  ai_reply_suggestions: {
    name: "AI Reply Suggestions",
    requiredPlan: "professional",
    benefits: [
      "3 tailored WhatsApp reply options per conversation",
      "Copy, edit, or send directly",
      "Context-aware based on conversation history",
      "Available inside WhatsApp conversations",
    ],
  },
  ai_scoring: {
    name: "AI Lead Scoring",
    requiredPlan: "agency",
    benefits: [
      "0–100 lead score based on 5 signals",
      "Urgency score and closing probability",
      "Bulk analysis across entire pipeline",
      "Auto-updated on new messages",
    ],
  },
  ai_deal_insights: {
    name: "AI Deal Insights",
    requiredPlan: "agency",
    benefits: [
      "Conversion probability per deal",
      "Deal risk and opportunity strength",
      "Follow-up priorities",
      "Pipeline health score",
    ],
  },
  ai_business_insights: {
    name: "AI Business Insights",
    requiredPlan: "agency",
    benefits: [
      "Daily, weekly, and monthly summaries",
      "Top agent and top campaign ranking",
      "Leads, deals, and conversion trends",
      "Exportable business reports",
    ],
  },
  ai_risk_detection: {
    name: "AI Risk Detection",
    requiredPlan: "agency",
    benefits: [
      "Uncontacted lead alerts",
      "Cold lead identification",
      "Stalled deal warnings",
      "Missed opportunity surfacing",
    ],
  },
  ai_property_matching: {
    name: "AI Property Matching",
    requiredPlan: "agency",
    benefits: [
      "Match lead budget, location & plot size",
      "Available properties ranked by fit",
      "Smart match score per property",
      "Available inside lead profiles",
    ],
  },
  ai_chat: {
    name: "AI Chatbot",
    requiredPlan: "agency",
    benefits: [
      "Full CRM context — leads, deals, pipeline",
      "Ask in plain language about any lead",
      "Closing strategies and follow-up advice",
      "Powered by AI Assistant",
    ],
  },
  automations: {
    name: "Automations",
    requiredPlan: "agency",
    benefits: [
      "No-code workflow builder",
      "Auto-send WhatsApp on lead events",
      "Automatic lead assignment by rules",
      "Full execution logs and history",
    ],
  },
  advanced_reporting: {
    name: "Advanced Reporting",
    requiredPlan: "agency",
    benefits: [
      "Custom report builder",
      "Multi-agent performance comparison",
      "Revenue attribution by channel",
      "White-label PDF exports",
    ],
  },
}

// Nav item → feature gate mapping
export const NAV_FEATURE_MAP: Record<string, string> = {
  "/dashboard/integrations":    "lead_sources",
  "/dashboard/messages":        "messages",
  "/dashboard/documents":       "documents",
  "/dashboard/analytics":       "analytics",
  "/dashboard/calculator":      "calculator",
  "/dashboard/team":            "team",
  "/dashboard/deals":           "deals",
  "/dashboard/ai-intelligence": "ai_intelligence",
  "/dashboard/automations":     "automations",
}

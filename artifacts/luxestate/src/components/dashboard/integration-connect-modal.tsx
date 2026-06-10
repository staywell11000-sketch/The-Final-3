import { useState } from "react"
import {
  Check, ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, Globe, X, Shield, RefreshCw, Phone, Hash,
} from "lucide-react"
import { FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa"
import { FaTiktok } from "react-icons/fa6"
import { motion, AnimatePresence } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { surfaceInputClass, surfaceSelectClass } from "@/lib/ui-classes"
import { agents } from "@/components/dashboard/leads-data"
import {
  Platform, PlatformConfig, PLATFORM_CONFIGS,
  MOCK_META_PROFILES, MOCK_TIKTOK_PROFILES, MOCK_WHATSAPP_PROFILES,
  MOCK_WEBSITE_FORMS, WEBSITE_PLATFORMS,
  MockBusiness, MockAdAccount, MockWhatsAppProfile,
  Integration, upsertIntegration, generateWebhookUrl, getNextSyncTime, addSyncEvent,
} from "@/components/dashboard/integrations-data"

// ── Platform icon ────────────────────────────────────────────────────────
export function PlatformIcon({ platform, size = "md" }: { platform: Platform; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5"
  const cfg = PLATFORM_CONFIGS[platform]
  const Icon = {
    facebook: FaFacebook,
    instagram: FaInstagram,
    tiktok: FaTiktok,
    whatsapp: FaWhatsapp,
    website: null,
  }[platform]

  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center rounded-xl",
      size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10",
      `bg-gradient-to-br ${cfg.gradient}`
    )}>
      {Icon ? (
        <Icon className={cn(sz, "text-white")} />
      ) : (
        <Globe className={cn(sz, "text-white")} />
      )}
    </div>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i < current ? "w-4 bg-primary" : i === current ? "w-4 bg-primary/60" : "w-1.5 bg-border/50"
          )}
        />
      ))}
    </div>
  )
}

// ── Connect wizard state ──────────────────────────────────────────────────
type Step =
  | "overview"
  | "auth_loading"
  | "select_profile"
  | "select_business"
  | "select_account"
  | "phone_entry"
  | "phone_verify"
  | "select_whatsapp"
  | "website_platform"
  | "website_form"
  | "configure"
  | "connecting"
  | "done"

const META_FLOW: Step[] = ["overview", "auth_loading", "select_profile", "select_business", "select_account", "configure", "connecting", "done"]
const TIKTOK_FLOW: Step[] = ["overview", "auth_loading", "select_profile", "select_account", "configure", "connecting", "done"]
const WHATSAPP_FLOW: Step[] = ["overview", "phone_entry", "phone_verify", "select_whatsapp", "configure", "connecting", "done"]
const WEBSITE_FLOW: Step[] = ["overview", "website_platform", "website_form", "configure", "connecting", "done"]

function getFlow(platform: Platform): Step[] {
  if (platform === "facebook" || platform === "instagram") return META_FLOW
  if (platform === "tiktok") return TIKTOK_FLOW
  if (platform === "whatsapp") return WHATSAPP_FLOW
  return WEBSITE_FLOW
}

// ── Main modal ────────────────────────────────────────────────────────────
export function IntegrationConnectModal({
  platform,
  open,
  onClose,
  onConnected,
}: {
  platform: Platform
  open: boolean
  onClose: () => void
  onConnected: (integration: Integration) => void
}) {
  const cfg = PLATFORM_CONFIGS[platform]
  const flow = getFlow(platform)

  const [stepIdx, setStepIdx] = useState(0)
  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0)
  const [selectedBusiness, setSelectedBusiness] = useState<MockBusiness | null>(null)
  const [selectedAdAccount, setSelectedAdAccount] = useState<MockAdAccount | null>(null)
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<MockWhatsAppProfile | null>(null)
  const [phoneInput, setPhoneInput] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [websitePlatform, setWebsitePlatform] = useState("Custom HTML")
  const [selectedFormIdx, setSelectedFormIdx] = useState(0)
  const [config, setConfig] = useState({
    syncInterval: 30,
    defaultPipeline: "new",
    defaultAgent: agents[0],
    extraTags: "",
    autoCreate: true,
  })

  const step = flow[stepIdx]
  const isFirstStep = stepIdx === 0
  const isLastInteractiveStep = step === "configure"
  const progressSteps = flow.filter((s) => !["auth_loading", "connecting"].includes(s)).length

  const currentProgressStep = flow
    .slice(0, stepIdx + 1)
    .filter((s) => !["auth_loading", "connecting"].includes(s)).length - 1

  const handleClose = () => {
    setStepIdx(0)
    setSelectedBusiness(null)
    setSelectedAdAccount(null)
    setSelectedWhatsApp(null)
    setPhoneInput("")
    setVerifyCode("")
    onClose()
  }

  const goNext = () => {
    if (stepIdx < flow.length - 1) setStepIdx((i) => i + 1)
  }
  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1)
  }

  const handleAuthSimulate = () => {
    goNext()
    setTimeout(() => goNext(), 2000)
  }

  const runConnect = () => {
    setStepIdx(flow.indexOf("connecting"))
    setTimeout(() => {
      const profiles = platform === "tiktok" ? MOCK_TIKTOK_PROFILES : MOCK_META_PROFILES
      const profile = (platform === "facebook" || platform === "instagram" || platform === "tiktok")
        ? profiles[selectedProfileIdx]
        : null
      const wa = selectedWhatsApp ?? MOCK_WHATSAPP_PROFILES[0]
      const form = MOCK_WEBSITE_FORMS[selectedFormIdx]

      const accountName =
        platform === "whatsapp" ? wa.name :
        (platform as string) === "website" ? (form?.name ?? "Website Form") :
        (profile?.displayName ?? "Account")

      const adAccountName = selectedAdAccount?.name ?? undefined

      const integrationId = `int_${platform}_${Date.now()}`
      const campaigns = selectedAdAccount?.campaigns ?? []

      const integration: Integration = {
        id: integrationId,
        platform,
        status: "connected",
        accountName,
        accountId: integrationId,
        adAccountName,
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        nextSync: getNextSyncTime(config.syncInterval),
        leadsTotal: selectedAdAccount?.leadsEstimate ?? Math.floor(Math.random() * 30) + 5,
        leadsSyncedToday: Math.floor(Math.random() * 8) + 1,
        leadsSyncedThisWeek: Math.floor(Math.random() * 25) + 5,
        campaigns,
        syncIntervalMinutes: config.syncInterval,
        defaultPipeline: config.defaultPipeline,
        defaultAgent: config.defaultAgent,
        extraTags: config.extraTags.split(",").map((t) => t.trim()).filter(Boolean),
        webhookUrl: (platform as string) === "website" ? generateWebhookUrl(platform, integrationId) : undefined,
      }

      upsertIntegration(integration)
      addSyncEvent({
        platform,
        accountName,
        timestamp: new Date().toISOString(),
        leadsAdded: integration.leadsSyncedToday,
        status: "success",
        message: `Initial sync completed — ${integration.leadsSyncedToday} leads imported`,
      })

      onConnected(integration)
      setStepIdx(flow.indexOf("done"))
    }, 2500)
  }

  const showFooter = !["auth_loading", "connecting", "done"].includes(step)
  const canProceed = () => {
    if (step === "select_profile") return true
    if (step === "select_business") return selectedBusiness !== null
    if (step === "select_account") return selectedAdAccount !== null
    if (step === "phone_entry") return phoneInput.replace(/\D/g, "").length >= 10
    if (step === "phone_verify") return verifyCode.length === 6
    if (step === "select_whatsapp") return selectedWhatsApp !== null
    if (step === "website_platform") return true
    if (step === "website_form") return true
    return true
  }

  const profiles = platform === "tiktok" ? MOCK_TIKTOK_PROFILES : MOCK_META_PROFILES

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Coloured header strip */}
        <div className={cn("relative flex flex-col items-center justify-center gap-3 px-6 py-6 bg-gradient-to-br", cfg.gradient)}>
          <div className="absolute inset-0 bg-black/20" />
          <DialogHeader className="relative z-10 text-center">
            <div className="flex justify-center mb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/30">
                {platform === "facebook" && <FaFacebook className="h-7 w-7 text-white" />}
                {platform === "instagram" && <FaInstagram className="h-7 w-7 text-white" />}
                {platform === "tiktok" && <FaTiktok className="h-7 w-7 text-white" />}
                {platform === "whatsapp" && <FaWhatsapp className="h-7 w-7 text-white" />}
                {(platform as string) === "website" && <Globe className="h-7 w-7 text-white" />}
              </div>
            </div>
            <DialogTitle className="text-white text-base font-semibold">{cfg.name}</DialogTitle>
            <p className="text-white/70 text-xs mt-0.5">{cfg.category}</p>
          </DialogHeader>
          {!["auth_loading", "connecting", "done"].includes(step) && (
            <div className="relative z-10">
              <StepDots total={progressSteps} current={currentProgressStep} />
            </div>
          )}
        </div>

        {/* Step content */}
        <div className="max-h-[440px] overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="p-6"
            >
              {step === "overview" && (
                <OverviewStep cfg={cfg} />
              )}
              {step === "auth_loading" && (
                <AuthLoadingStep platform={platform} cfg={cfg} />
              )}
              {step === "select_profile" && (
                <SelectProfileStep
                  profiles={profiles}
                  selectedIdx={selectedProfileIdx}
                  setSelectedIdx={setSelectedProfileIdx}
                  platform={platform}
                />
              )}
              {step === "select_business" && (
                <SelectBusinessStep
                  businesses={profiles[selectedProfileIdx]?.businesses ?? []}
                  selected={selectedBusiness}
                  onSelect={setSelectedBusiness}
                />
              )}
              {step === "select_account" && (
                <SelectAdAccountStep
                  accounts={(
                    platform === "tiktok"
                      ? profiles[selectedProfileIdx]?.adAccounts
                      : selectedBusiness?.adAccounts
                  ) ?? []}
                  selected={selectedAdAccount}
                  onSelect={setSelectedAdAccount}
                  platform={platform}
                />
              )}
              {step === "phone_entry" && (
                <PhoneEntryStep value={phoneInput} onChange={setPhoneInput} />
              )}
              {step === "phone_verify" && (
                <PhoneVerifyStep phone={phoneInput} value={verifyCode} onChange={setVerifyCode} />
              )}
              {step === "select_whatsapp" && (
                <SelectWhatsAppStep
                  profiles={MOCK_WHATSAPP_PROFILES}
                  selected={selectedWhatsApp}
                  onSelect={setSelectedWhatsApp}
                />
              )}
              {step === "website_platform" && (
                <WebsitePlatformStep platform={websitePlatform} onChange={setWebsitePlatform} />
              )}
              {step === "website_form" && (
                <WebsiteFormStep
                  forms={MOCK_WEBSITE_FORMS}
                  selectedIdx={selectedFormIdx}
                  setSelectedIdx={setSelectedFormIdx}
                />
              )}
              {step === "configure" && (
                <ConfigureStep
                  platform={platform}
                  config={config}
                  setConfig={(patch) => setConfig((c) => ({ ...c, ...patch }))}
                  webhookPreview={(platform as string) === "website" ? generateWebhookUrl(platform, "preview") : undefined}
                />
              )}
              {step === "connecting" && (
                <ConnectingStep platform={platform} cfg={cfg} />
              )}
              {step === "done" && (
                <DoneStep cfg={cfg} onClose={handleClose} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-between border-t border-border/40 px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={isFirstStep ? handleClose : goBack}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              {isFirstStep ? "Cancel" : "Back"}
            </Button>
            {step === "overview" ? (
              <Button
                size="sm"
                className={cn("gap-1.5 text-white shadow-lg", `bg-gradient-to-r ${cfg.gradient}`)}
                onClick={handleAuthSimulate}
              >
                Connect {cfg.name}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : isLastInteractiveStep ? (
              <Button
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                onClick={runConnect}
              >
                Finish & Connect
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canProceed()}
                className="gap-1.5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                onClick={goNext}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Step sub-components ───────────────────────────────────────────────────

function OverviewStep({ cfg }: { cfg: PlatformConfig }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">{cfg.tagline}</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>
      </div>
      <div className="flex flex-col gap-2">
        {cfg.features.map((f) => (
          <div key={f} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Check className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">{f}</span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-border/30 bg-secondary/10 p-3">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your ad account credentials are never stored. We use secure OAuth for read-only access to your leads. You can disconnect at any time.
        </p>
      </div>
    </div>
  )
}

function AuthLoadingStep({ platform, cfg }: { platform: Platform; cfg: PlatformConfig }) {
  const platformName = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok Ads", whatsapp: "Meta", website: "" }[platform]
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", cfg.gradient)}>
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">Connecting to {platformName}…</p>
        <p className="mt-1 text-xs text-muted-foreground">Completing secure authentication</p>
      </div>
    </div>
  )
}

function SelectProfileStep({ profiles, selectedIdx, setSelectedIdx, platform }: {
  profiles: { id: string; displayName: string; email?: string }[]
  selectedIdx: number
  setSelectedIdx: (i: number) => void
  platform: Platform
}) {
  const label = platform === "tiktok" ? "Select your TikTok Ads account" : "Select your Meta account"
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">You're logged in with {profiles.length} account{profiles.length !== 1 ? "s" : ""}.</p>
      </div>
      <div className="flex flex-col gap-2">
        {profiles.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setSelectedIdx(i)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              selectedIdx === i ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {p.displayName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.displayName}</p>
              {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
            </div>
            {selectedIdx === i && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function SelectBusinessStep({ businesses, selected, onSelect }: {
  businesses: MockBusiness[]
  selected: MockBusiness | null
  onSelect: (b: MockBusiness) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Select a Business Manager</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose which business account to connect.</p>
      </div>
      <div className="flex flex-col gap-2">
        {businesses.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              selected?.id === b.id ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/40 text-xs font-bold">
              {b.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.adAccounts.length} ad account{b.adAccounts.length !== 1 ? "s" : ""}</p>
            </div>
            {selected?.id === b.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function SelectAdAccountStep({ accounts, selected, onSelect, platform }: {
  accounts: MockAdAccount[]
  selected: MockAdAccount | null
  onSelect: (a: MockAdAccount) => void
  platform: Platform
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Select an Ad Account</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Leads from all active campaigns in this account will be synced.</p>
      </div>
      <div className="flex flex-col gap-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              selected?.id === a.id ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/40">
              <Hash className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.campaigns.length} active campaigns · ~{a.leadsEstimate} leads/mo</p>
            </div>
            {selected?.id === a.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
      {selected && (
        <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Active Campaigns</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.campaigns.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] border-border/40">{c}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhoneEntryStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Enter your WhatsApp Business number</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">This must be a verified WhatsApp Business phone number.</p>
      </div>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="tel"
          placeholder="+1 (555) 000-0000"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-10 w-full rounded-md border pl-9 pr-3 text-sm placeholder:text-muted-foreground/50",
            surfaceInputClass
          )}
        />
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-[10px] text-amber-400/80 leading-relaxed">
          A verification code will be sent to this number. Standard SMS rates may apply.
        </p>
      </div>
    </div>
  )
}

function PhoneVerifyStep({ phone, value, onChange }: { phone: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Enter verification code</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">A 6-digit code was sent to <span className="font-medium text-foreground">{phone || "+1 (555) 000-0000"}</span>.</p>
      </div>
      <input
        type="text"
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={cn(
          "h-12 w-full rounded-md border px-3 text-center text-2xl font-bold tracking-[0.5em] placeholder:text-muted-foreground/30 placeholder:text-base placeholder:tracking-normal",
          surfaceInputClass
        )}
      />
      <p className="text-center text-xs text-muted-foreground">
        Didn't receive it? <button className="text-primary font-medium">Resend code</button>
      </p>
      <div className="flex items-start gap-2 rounded-lg border border-border/30 bg-secondary/10 p-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          For demo: enter any 6 digits to continue.
        </p>
      </div>
    </div>
  )
}

function SelectWhatsAppStep({ profiles, selected, onSelect }: {
  profiles: MockWhatsAppProfile[]
  selected: MockWhatsAppProfile | null
  onSelect: (p: MockWhatsAppProfile) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Select your WhatsApp Business profile</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose the profile to capture inquiries from.</p>
      </div>
      <div className="flex flex-col gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              selected?.id === p.id ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
              <FaWhatsapp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.phone} · {p.category}</p>
            </div>
            {selected?.id === p.id && <Check className="h-4 w-4 shrink-0 text-emerald-500" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function WebsitePlatformStep({ platform, onChange }: { platform: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Select your website platform</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">We support all major platforms via our universal webhook.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {WEBSITE_PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-all",
              platform === p ? "border-primary/40 bg-primary/5 font-medium" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            {p}
            {platform === p && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function WebsiteFormStep({ forms, selectedIdx, setSelectedIdx }: {
  forms: typeof MOCK_WEBSITE_FORMS
  selectedIdx: number
  setSelectedIdx: (i: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Select a form to connect</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">We detected these forms on your website.</p>
      </div>
      <div className="flex flex-col gap-2">
        {forms.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setSelectedIdx(i)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
              selectedIdx === i ? "border-primary/40 bg-primary/5" : "border-border/40 hover:bg-secondary/20"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
              <Globe className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground truncate">{f.url} · {f.fields.length} fields detected</p>
            </div>
            {selectedIdx === i && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConfigureStep({ platform, config, setConfig, webhookPreview }: {
  platform: Platform
  config: { syncInterval: number; defaultPipeline: string; defaultAgent: string; extraTags: string; autoCreate: boolean }
  setConfig: (patch: Partial<typeof config>) => void
  webhookPreview?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Configure sync settings</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Set how new leads are handled when they sync.</p>
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sync Every</label>
          <div className="relative">
            <select value={config.syncInterval} onChange={(e) => setConfig({ syncInterval: Number(e.target.value) })} className={cn(surfaceSelectClass, "h-8 text-xs")}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={360}>6 hours</option>
            </select>
            <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 -rotate-90 text-muted-foreground" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default Pipeline</label>
          <div className="relative">
            <select value={config.defaultPipeline} onChange={(e) => setConfig({ defaultPipeline: e.target.value })} className={cn(surfaceSelectClass, "h-8 text-xs")}>
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
            </select>
            <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 -rotate-90 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assign To Agent</label>
        <div className="relative">
          <select value={config.defaultAgent} onChange={(e) => setConfig({ defaultAgent: e.target.value })} className={cn(surfaceSelectClass, "h-8 text-xs")}>
            {agents.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 -rotate-90 text-muted-foreground" />
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/40 bg-secondary/10 p-3">
        <div>
          <p className="text-xs font-medium">Auto-create leads</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Automatically add synced leads to your pipeline</p>
        </div>
        <div
          onClick={() => setConfig({ autoCreate: !config.autoCreate })}
          className={cn("relative flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer", config.autoCreate ? "bg-primary" : "bg-secondary/60")}
        >
          <span className={cn("absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-all", config.autoCreate ? "left-[18px]" : "left-[3px]")} />
        </div>
      </label>

      {webhookPreview && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Webhook URL</label>
          <div className="flex items-center gap-2 rounded-md border border-border/40 bg-secondary/20 px-3 py-2">
            <code className="flex-1 truncate text-[10px] text-primary">{webhookPreview}</code>
            <button className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard?.writeText(webhookPreview)}>Copy</button>
          </div>
          <p className="text-[10px] text-muted-foreground">Paste this URL in your form settings to route submissions here.</p>
        </div>
      )}
    </div>
  )
}

function ConnectingStep({ cfg }: { platform: Platform; cfg: PlatformConfig }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", cfg.gradient)}>
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background">
          <RefreshCw className="h-3 w-3 text-primary animate-spin" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">Setting up {cfg.name}…</p>
        <p className="mt-1 text-xs text-muted-foreground">Connecting account and running first sync</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        {["Authenticating account", "Fetching campaigns", "Syncing leads"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15">
              <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" style={{ animationDelay: `${i * 0.3}s` }} />
            </div>
            <span className="text-xs text-muted-foreground">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DoneStep({ cfg, onClose }: { cfg: PlatformConfig; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="relative">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", cfg.gradient)}>
          <CheckCircle2 className="h-8 w-8 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">{cfg.name} connected</p>
        <p className="mt-1 text-xs text-muted-foreground">Initial sync complete. New leads will sync every {30} minutes.</p>
      </div>
      <Button
        size="sm"
        className="gap-1.5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
        onClick={onClose}
      >
        <Check className="h-4 w-4" /> Done
      </Button>
    </div>
  )
}

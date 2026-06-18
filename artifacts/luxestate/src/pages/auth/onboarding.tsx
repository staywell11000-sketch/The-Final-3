import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import {
  ArrowRight, ArrowLeft, Check, Loader2, Camera,
  CheckCircle2, Zap, Crown, Star, X, Plus,
} from "lucide-react"

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")
const TOTAL_STEPS = 4

const BUSINESS_TYPES = [
  "Real Estate Agency",
  "Property Dealer",
  "Developer",
  "Builder",
  "Marketing Agency",
  "Other",
]

const TEAM_SIZES = ["1", "2-5", "6-10", "10+"]

const ONBOARDING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "Rs. 0",
    period: "forever",
    description: "Get started with the basics",
    icon: Star,
    color: "text-muted-foreground",
    features: ["Dashboard", "Leads (50)", "Properties", "Dealers", "Calendar", "1 User"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "Rs. 9,999",
    period: "/month",
    description: "For solo agents growing their business",
    icon: Zap,
    color: "text-blue-500",
    features: ["500 Leads", "WhatsApp Integration", "Facebook Lead Ads", "Analytics", "Documents"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "Rs. 19,999",
    period: "/month",
    description: "For teams that need more power",
    icon: Crown,
    color: "text-primary",
    popular: true,
    features: ["5,000 Leads", "Team Management", "Deals Pipeline", "AI Summaries", "Lead Assignment"],
  },
  {
    id: "agency",
    name: "Agency",
    price: "Rs. 29,999",
    period: "/month",
    description: "Full AI & automation suite",
    icon: Crown,
    color: "text-amber-500",
    features: ["Unlimited Leads", "Full AI Intelligence", "Automations", "AI Chatbot", "Advanced Reports"],
  },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadImage(base64: string, filename: string, field: "avatar" | "logo", token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/settings/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field, base64, filename }),
    })
    if (!res.ok) return null
    const data = await res.json() as { url: string }
    return data.url
  } catch { return null }
}

// ── Step 1: Company Information ──────────────────────────────────────────────
function StepCompanyInfo({ form, update }: { form: any; update: (k: string, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Company Information</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Tell us about your business</p>
      </div>

      <div className="space-y-1.5">
        <Label>Company / Agency Name <span className="text-destructive">*</span></Label>
        <Input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Al-Noor Real Estate Agency" />
      </div>

      <div className="space-y-1.5">
        <Label>Owner Name <span className="text-destructive">*</span></Label>
        <Input value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="Muhammad Ali" />
      </div>

      <div className="space-y-1.5">
        <Label>Business Email <span className="text-destructive">*</span></Label>
        <Input type="email" value={form.businessEmail} onChange={(e) => update("businessEmail", e.target.value)} placeholder="info@agency.com" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Phone Number</Label>
          <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+92 300 1234567" />
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Lahore" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Office Address</Label>
        <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main Blvd, DHA Phase 5" />
      </div>
    </div>
  )
}

// ── Step 2: Company Logo ─────────────────────────────────────────────────────
function StepLogo({ preview, onPreview }: {
  preview: string | null
  onPreview: (url: string | null, file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) { alert("Max file size is 4 MB"); return }
    onPreview(URL.createObjectURL(file), file)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Company Logo</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Upload your logo — used in reports and client materials. You can skip this and add it later.</p>
      </div>

      <div className="flex flex-col items-center gap-5 py-4">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          className={cn(
            "relative cursor-pointer overflow-hidden border-2 border-dashed transition-all hover:border-primary/60 h-36 w-64 rounded-2xl",
            dragOver ? "border-primary bg-primary/10" : "border-border bg-secondary/20",
            preview && "border-solid border-primary/40"
          )}
        >
          {preview ? (
            <img src={preview} alt="Logo" className="h-full w-full object-contain p-2" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Camera className="h-10 w-10" />
              <span className="text-xs text-center px-4">Click or drag to upload your logo</span>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
        />
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Camera className="mr-2 h-3.5 w-3.5" /> Choose Logo
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onPreview(null, null)}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP · max 4 MB</p>
      </div>
    </div>
  )
}

// ── Step 3: Business Setup ───────────────────────────────────────────────────
function StepBusinessSetup({ form, update, areas, setAreas }: {
  form: any
  update: (k: string, v: string) => void
  areas: string[]
  setAreas: (a: string[]) => void
}) {
  const [areaInput, setAreaInput] = useState("")

  const addArea = () => {
    const v = areaInput.trim()
    if (v && !areas.includes(v)) setAreas([...areas, v])
    setAreaInput("")
  }

  const removeArea = (a: string) => setAreas(areas.filter((x) => x !== a))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Business Setup</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Help us personalise your CRM experience</p>
      </div>

      <div className="space-y-2">
        <Label>What type of business are you?</Label>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => update("businessType", t)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-all",
                form.businessType === t
                  ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>How many team members will use the CRM?</Label>
        <div className="flex gap-2 flex-wrap">
          {TEAM_SIZES.map((s) => (
            <button key={s} type="button" onClick={() => update("teamSize", s)}
              className={cn(
                "rounded-xl border px-5 py-2 text-sm font-semibold transition-all",
                form.teamSize === s
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>What areas do you operate in?</Label>
        <div className="flex gap-2">
          <Input
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea() } }}
            placeholder="e.g. DHA Lahore, Bahria Town…"
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={addArea}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {areas.map((a) => (
              <span key={a} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                {a}
                <button onClick={() => removeArea(a)} className="hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Press Enter or click + to add areas</p>
      </div>
    </div>
  )
}

// ── Step 4: Plan Selection ───────────────────────────────────────────────────
function StepPlan({ selectedPlan, onSelect }: { selectedPlan: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Start free, upgrade anytime — no credit card required for free plan</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ONBOARDING_PLANS.map((plan) => {
          const Icon = plan.icon
          const isSelected = selectedPlan === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={cn(
                "relative flex flex-col gap-2.5 rounded-xl border p-4 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/40 hover:bg-muted/20",
              )}
            >
              {(plan as any).popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", plan.color)} />
                  <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                </div>
                <div className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}>
                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div>
                <span className="text-base font-bold text-foreground">{plan.price}</span>
                <span className="ml-1 text-xs text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-xs text-muted-foreground">{plan.description}</p>
              <ul className="space-y-1">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                    <Check className="h-3 w-3 text-primary flex-shrink-0" />{f}
                  </li>
                ))}
                {plan.features.length > 3 && (
                  <li className="text-xs text-muted-foreground pl-4">+{plan.features.length - 3} more</li>
                )}
              </ul>
            </button>
          )
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">You can change your plan anytime from Billing settings</p>
    </div>
  )
}

// ── Loading ──────────────────────────────────────────────────────────────────
function LoadingStep() {
  const steps = [
    "Setting up your company profile…",
    "Configuring your workspace…",
    "Preparing your dashboard…",
    "Applying your preferences…",
    "You're all set! ✓",
  ]
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i >= steps.length) { clearInterval(interval); return }
      setActiveIdx(i)
    }, 550)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-xl shadow-primary/30"
      >
        <span className="text-3xl font-bold text-primary-foreground">L</span>
      </motion.div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Launching your CRM</h2>
        <p className="mt-1 text-sm text-muted-foreground">Just a moment…</p>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {steps.map((step, i) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: i <= activeIdx ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <div className={cn(
              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              i < activeIdx ? "bg-primary" : i === activeIdx ? "bg-primary/60" : "bg-border"
            )}>
              {i < activeIdx
                ? <Check className="h-3 w-3 text-primary-foreground" />
                : i === activeIdx
                  ? <Loader2 className="h-3 w-3 text-white animate-spin" />
                  : null
              }
            </div>
            <p className={cn("text-sm transition-colors", i <= activeIdx ? "text-foreground font-medium" : "text-muted-foreground")}>
              {step}
            </p>
          </motion.div>
        ))}
      </div>
      <div className="w-full max-w-xs h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${((activeIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    businessEmail: "",
    phone: "",
    city: "",
    address: "",
    businessType: "",
    teamSize: "1",
  })

  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [selectedPlan, setSelectedPlan] = useState("free")
  const [areas, setAreas] = useState<string[]>([])

  useEffect(() => {
    if (!loading && !user) setLocation("/sign-in")
  }, [user, loading, setLocation])

  useEffect(() => {
    if (user?.email) {
      setForm((f) => ({ ...f, businessEmail: f.businessEmail || user.email || "" }))
    }
  }, [user])

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const canProceed = () => {
    if (step === 1) return form.companyName.trim() && form.ownerName.trim() && form.businessEmail.trim()
    return true
  }

  const isLastDataStep = step === TOTAL_STEPS

  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    setStep(TOTAL_STEPS + 1)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("No session")
      const token = session.access_token

      let logoUrl: string | null = null
      if (logoFile) {
        const b64 = await fileToBase64(logoFile)
        logoUrl = await uploadImage(b64, logoFile.name, "logo", token)
      }

      const nameParts = form.ownerName.trim().split(" ")
      const firstName = nameParts[0] || ""
      const lastName  = nameParts.slice(1).join(" ") || ""

      const userRes = await fetch(`${BASE}/api/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: user?.email || "",
          firstName,
          lastName,
          phone: form.phone,
          title: form.businessType || "Agent",
          onboarded: true,
        }),
      })
      if (!userRes.ok) {
        const errBody = await userRes.json().catch(() => ({}))
        throw new Error((errBody as any)?.error ?? `Failed to save profile (${userRes.status})`)
      }

      await fetch(`${BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName:    form.companyName || null,
          businessLogoUrl: logoUrl || null,
          officeAddress:   form.address || null,
          city:            form.city || null,
          whatsappNumber:  form.phone || null,
          teamSize:        form.teamSize || null,
          businessEmail:   form.businessEmail || null,
          position:        form.businessType || null,
          operatingAreas:  areas.join(", ") || null,
          notificationsEnabled: true,
          newLeadNotif:         true,
          dealStatusNotif:      true,
          weeklyReportsEnabled: true,
        }),
      })

      await new Promise((r) => setTimeout(r, 2800))

      await queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      await queryClient.refetchQueries({ queryKey: ["currentUser"], exact: false })

      setLocation("/dashboard")
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.")
      setStep(TOTAL_STEPS)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const isLoading = step === TOTAL_STEPS + 1
  const progress = isLoading ? 100 : Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="flex min-h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex w-full flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg"
        >
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-md shadow-primary/25">
              <span className="text-base font-bold text-primary-foreground">L</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">
              Luxe<span className="text-primary">State</span>
            </span>
          </div>

          {!isLoading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
                <span className="text-xs font-medium text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div key={i} className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i + 1 < step ? "bg-primary" : i + 1 === step ? "bg-primary/60" : "bg-secondary"
                  )} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-xl shadow-black/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
              >
                {step === 1 && <StepCompanyInfo form={form} update={update} />}
                {step === 2 && (
                  <StepLogo
                    preview={logoPreview}
                    onPreview={(url, file) => { setLogoPreview(url); setLogoFile(file) }}
                  />
                )}
                {step === 3 && (
                  <StepBusinessSetup form={form} update={update} areas={areas} setAreas={setAreas} />
                )}
                {step === 4 && <StepPlan selectedPlan={selectedPlan} onSelect={setSelectedPlan} />}
                {isLoading && <LoadingStep />}
              </motion.div>
            </AnimatePresence>

            {error && (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {!isLoading && (
              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)} disabled={submitting}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                {!isLastDataStep ? (
                  <Button
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                    onClick={() => setStep(step + 1)}
                    disabled={!canProceed()}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
                      : <><CheckCircle2 className="h-4 w-4" /> Launch my CRM</>
                    }
                  </Button>
                )}
              </div>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

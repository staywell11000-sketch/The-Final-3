import { useState } from "react"
import { Link, useLocation } from "wouter"
import { supabase } from "@/lib/supabase"
import { checkEmailExists } from "@/lib/auth-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Eye, EyeOff, Mail, UserCheck, ArrowRight, ArrowLeft,
  CheckCircle2, Lock, Zap, Users2, Brain, AlertCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  )
}

type PlanSlug = "free" | "starter" | "professional" | "agency"

interface PlanCard {
  slug: PlanSlug
  name: string
  price: number
  badge?: string
  badgeColor: string
  icon: React.ElementType
  iconBg: string
  features: string[]
  cta: string
}

const PLANS: PlanCard[] = [
  {
    slug: "free",
    name: "Free",
    price: 0,
    badgeColor: "bg-slate-500",
    icon: CheckCircle2,
    iconBg: "bg-slate-100 text-slate-600",
    features: ["Dashboard & Overview", "Basic Leads & Contacts", "Dealers Directory", "Calendar"],
    cta: "Get Started Free",
  },
  {
    slug: "starter",
    name: "Starter",
    price: 9999,
    badge: "Popular",
    badgeColor: "bg-blue-500",
    icon: Zap,
    iconBg: "bg-blue-50 text-blue-600",
    features: ["Everything in Free", "Properties Management", "Analytics & Reports", "Documents Storage", "Property Calculator"],
    cta: "Start Free Trial",
  },
  {
    slug: "professional",
    name: "Professional",
    price: 19999,
    badge: "Best Value",
    badgeColor: "bg-purple-500",
    icon: Users2,
    iconBg: "bg-purple-50 text-purple-600",
    features: ["Everything in Starter", "WhatsApp & Facebook Lead Ads", "Team Management", "Deals Pipeline", "AI Chatbot"],
    cta: "Start Free Trial",
  },
  {
    slug: "agency",
    name: "Agency",
    price: 29999,
    badge: "Full Power",
    badgeColor: "bg-amber-500",
    icon: Brain,
    iconBg: "bg-amber-50 text-amber-600",
    features: ["Everything in Professional", "AI Intelligence Suite", "Advanced Automations", "Advanced Reporting", "Priority Support"],
    cta: "Start Free Trial",
  },
]

const BrandHeader = () => (
  <div className="mb-8 flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
      <span className="text-lg font-bold text-primary-foreground">L</span>
    </div>
    <span className="text-2xl font-semibold tracking-tight">
      Real<span className="text-primary">CRM</span>
    </span>
  </div>
)

export default function SignUpPage() {
  const [, setLocation] = useLocation()
  const [step, setStep] = useState<"plan" | "account">("plan")
  const [selectedPlan, setSelectedPlan] = useState<PlanSlug>("free")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgName, setOrgName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailTaken, setEmailTaken] = useState(false)
  const [checkEmailSent, setCheckEmailSent] = useState(false)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError("")
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${base}/dashboard` },
    })
    if (error) {
      const msg = error.message.toLowerCase()
      setError(
        msg.includes("provider") || msg.includes("not enabled")
          ? "Google sign-in isn't enabled yet. Enable it in your Supabase Dashboard → Authentication → Providers."
          : "Google sign-in failed. Please try again."
      )
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setEmailTaken(false)

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setLoading(true)

    // Pre-check email existence BEFORE calling Supabase.
    // When email confirmation is enabled Supabase silently "succeeds" for
    // duplicate sign-ups (it just re-sends the confirmation email), so we
    // can't rely on its error message to catch duplicates reliably.
    const exists = await checkEmailExists(email)
    if (exists) {
      setEmailTaken(true)
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { plan_slug: selectedPlan, org_name: orgName.trim() || undefined },
        emailRedirectTo: `${window.location.origin}/sign-in`,
      },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      // Fallback duplicate detection in case our DB check missed it
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        msg.includes("email already") ||
        msg.includes("user already")
      ) {
        setEmailTaken(true)
      } else if (msg.includes("weak password") || msg.includes("password")) {
        setError("Your password is too weak. Use at least 8 characters with a mix of letters and numbers.")
      } else if (msg.includes("invalid email") || msg.includes("not valid")) {
        setError("That doesn't look like a valid email address. Please check and try again.")
      } else {
        setError("Unable to create account. Please try again in a moment.")
      }
      setLoading(false)
      return
    }

    // data.session is non-null when email confirmation is disabled
    if (data.session) return // Auth context will handle redirect

    setCheckEmailSent(true)
    setLoading(false)
  }

  // ── Confirm-email screen ────────────────────────────────────────────────────
  if (checkEmailSent) {
    const planInfo = PLANS.find((p) => p.slug === selectedPlan)!
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-12">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-10 shadow-xl shadow-black/8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Check your email</h2>
            <p className="mb-1 text-sm text-muted-foreground">We sent a confirmation link to</p>
            <p className="mb-3 font-medium text-foreground">{email}</p>
            {selectedPlan !== "free" && (
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <planInfo.icon className="h-3.5 w-3.5" />
                {planInfo.name} trial activates after confirmation
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Click the link in that email to activate your account, then come back to sign in.
            </p>
            <Button variant="outline" className="mt-6 w-full" onClick={() => setLocation("/sign-in")}>
              Go to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Email-taken screen ──────────────────────────────────────────────────────
  if (emailTaken) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <BrandHeader />
          <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
              <UserCheck className="h-7 w-7 text-amber-500" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              An account with this email already exists. Please sign in.
            </h1>
            <p className="mb-1 text-sm text-muted-foreground">Account registered to</p>
            <p className="mb-6 truncate font-semibold text-foreground">{email}</p>
            <div className="space-y-3">
              <Button
                className="w-full gap-2 font-semibold"
                onClick={() => setLocation("/sign-in")}
              >
                Sign in to your account <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailTaken(false)
                  setEmail("")
                  setPassword("")
                }}
              >
                Use a different email
              </Button>
            </div>
            <div className="mt-6 rounded-xl bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground text-center">
                Forgot your password?{" "}
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  Reset it here
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Step 1: Plan selector ───────────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-4xl"
        >
          <BrandHeader />

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Choose your plan</h1>
            <p className="text-muted-foreground">Start free or unlock powerful features. Upgrade anytime.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.slug
              const Icon = plan.icon
              return (
                <motion.div
                  key={plan.slug}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`relative rounded-2xl border-2 bg-white p-5 cursor-pointer transition-all select-none ${
                    isSelected
                      ? "border-primary shadow-lg shadow-primary/15"
                      : "border-border hover:border-primary/40 shadow-sm"
                  }`}
                >
                  {plan.badge && (
                    <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-semibold text-white ${plan.badgeColor}`}>
                      {plan.badge}
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${plan.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-foreground text-base mb-0.5">{plan.name}</h3>
                  <div className="mb-4">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-extrabold text-foreground">Free</span>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-foreground">
                          Rs. {plan.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.slug !== "free" && (
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Starts as free trial
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              className="w-full max-w-sm gap-2 font-semibold"
              onClick={() => setStep("account")}
            >
              Continue with {PLANS.find((p) => p.slug === selectedPlan)?.name}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Step 2: Account creation ────────────────────────────────────────────────
  const chosenPlan = PLANS.find((p) => p.slug === selectedPlan)!
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <BrandHeader />

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/8">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => setStep("plan")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Change plan
            </button>
            <Badge className={`text-white border-0 text-xs ${chosenPlan.badgeColor}`}>
              <chosenPlan.icon className="h-3 w-3 mr-1" />
              {chosenPlan.name}{selectedPlan !== "free" && " Trial"}
            </Badge>
          </div>

          <h1 className="mb-1 text-2xl font-semibold text-foreground">Create your organization</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {selectedPlan === "free"
              ? "Get started for free — no credit card required."
              : `Start your ${chosenPlan.name} trial — no credit card required.`}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mb-4 w-full gap-2.5 font-medium"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-muted-foreground">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name" className="text-sm font-medium">Organization name</Label>
              <Input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setError("") }}
                placeholder="e.g. Luxe Real Estate"
                autoComplete="organization"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError("") }}
                placeholder="james@luxeestate.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  placeholder="Choose a password (min. 6 characters)"
                  required
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading || googleLoading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating account…" : chosenPlan.cta}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

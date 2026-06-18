import { useState } from "react"
import { Link } from "wouter"
import { supabase } from "@/lib/supabase"
import { checkEmailExists } from "@/lib/auth-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

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

type ErrorType = "no_account" | "wrong_password" | "not_confirmed" | "google_disabled" | "generic"

interface AuthError {
  type: ErrorType
  message: string
}

function ErrorBanner({ error }: { error: AuthError }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        error.type === "no_account"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-destructive/20 bg-destructive/8 text-destructive"
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error.message}</span>
    </motion.div>
  )
}

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [authError, setAuthError] = useState<AuthError | null>(null)

  const clearError = () => setAuthError(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAuthError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error) {
      // Success — do NOT navigate manually. PublicOnlyRoute detects the new
      // session and redirects to /dashboard automatically, avoiding the race
      // condition where auth state hasn't propagated yet.
      // Keep loading=true so the user sees a spinner while that happens.
      return
    }

    const msg = error.message.toLowerCase()

    // Email confirmation required
    if (msg.includes("not confirmed") || msg.includes("email not confirmed")) {
      setAuthError({
        type: "not_confirmed",
        message:
          "Your email isn't confirmed yet. Check your inbox for the activation link we sent, then try signing in again.",
      })
      setLoading(false)
      return
    }

    // Supabase returns the same error for both "no account" and "wrong password".
    // Resolve by checking our DB to give a precise message.
    if (
      msg.includes("invalid login") ||
      msg.includes("invalid credentials") ||
      msg.includes("invalid email") ||
      msg.includes("wrong password") ||
      msg.includes("no user found") ||
      error.status === 400
    ) {
      const exists = await checkEmailExists(email)
      if (!exists) {
        setAuthError({
          type: "no_account",
          message: "No account found with this email address.",
        })
      } else {
        setAuthError({
          type: "wrong_password",
          message: "Incorrect password. Please try again.",
        })
      }
      setLoading(false)
      return
    }

    // Fallback for unexpected errors
    setAuthError({
      type: "generic",
      message: "Something went wrong. Please try again in a moment.",
    })
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setAuthError(null)
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${base}/dashboard` },
    })
    if (error) {
      const msg = error.message.toLowerCase()
      setAuthError({
        type:
          msg.includes("provider") || msg.includes("not enabled")
            ? "google_disabled"
            : "generic",
        message:
          msg.includes("provider") || msg.includes("not enabled") || msg.includes("unsupported")
            ? "Google sign-in isn't enabled yet. Enable it in your Supabase Dashboard → Authentication → Providers."
            : "Google sign-in failed. Please try again.",
      })
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
            <span className="text-lg font-bold text-primary-foreground">L</span>
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            Real<span className="text-primary">CRM</span>
          </span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/8">
          <h1 className="mb-1 text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="mb-6 text-sm text-muted-foreground">Sign in to your account</p>

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
              <span className="bg-white px-3 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError() }}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {authError && (
                <div key={authError.type} className="space-y-1.5">
                  <ErrorBanner error={authError} />
                  {authError.type === "no_account" && (
                    <p className="text-center text-xs text-muted-foreground">
                      Don't have an account?{" "}
                      <Link href="/sign-up" className="font-medium text-primary hover:underline">
                        Sign up for free →
                      </Link>
                    </p>
                  )}
                  {authError.type === "wrong_password" && (
                    <p className="text-center text-xs text-muted-foreground">
                      <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                        Forgot your password? Reset it →
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading || googleLoading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/sign-up" className="font-medium text-primary hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

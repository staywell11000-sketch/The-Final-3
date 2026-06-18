import { useState } from "react"
import { Link } from "wouter"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${base}/reset-password`,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many requests. Please wait a few minutes before trying again.")
      } else if (msg.includes("invalid email") || msg.includes("not valid")) {
        setError("That doesn't look like a valid email address. Please check and try again.")
      } else {
        setError("Unable to send reset email. Please try again in a moment.")
      }
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-background to-orange-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25">
            <span className="text-lg font-bold text-primary-foreground">L</span>
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            Real<span className="text-primary">CRM</span>
          </span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Check your email</h2>
              <p className="mb-1 text-sm text-muted-foreground">
                We've sent a password reset link to
              </p>
              <p className="mb-4 font-medium text-foreground">{email}</p>
              <p className="mb-6 text-xs text-muted-foreground">
                If you don't see it, check your spam folder. The link expires in 1 hour.
              </p>
              <Link href="/sign-in">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-semibold text-foreground">Reset password</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Sending…" : "Send Reset Link"}
                </Button>
              </form>

              <Link href="/sign-in">
                <Button variant="ghost" className="mt-4 w-full text-muted-foreground">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Button>
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

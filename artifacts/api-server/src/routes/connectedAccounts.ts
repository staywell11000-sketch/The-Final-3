import { Router } from "express"
import crypto from "crypto"
import { requireAuth } from "../middlewares/requireAuth"
import { db, connectedAccounts } from "@workspace/db"
import { eq, and, asc } from "drizzle-orm"

const router = Router()

// ─── OAuth constants ──────────────────────────────────────
const META_AUTH_URL    = "https://www.facebook.com/v18.0/dialog/oauth"
const META_TOKEN_URL   = "https://graph.facebook.com/v18.0/oauth/access_token"
const TIKTOK_AUTH_URL  = "https://www.tiktok.com/v2/auth/authorize"
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
const TIKTOK_USER_URL  = "https://open.tiktokapis.com/v2/user/info/"

type Provider = "whatsapp" | "facebook" | "instagram" | "tiktok"
const VALID_PROVIDERS: Provider[] = ["whatsapp", "facebook", "instagram", "tiktok"]

const META_SCOPES: Record<string, string> = {
  whatsapp:  "whatsapp_business_messaging,whatsapp_business_management,pages_show_list",
  facebook:  "email,public_profile,pages_show_list,pages_read_engagement,leads_retrieval,ads_read",
  instagram: "instagram_basic,instagram_content_publish,pages_show_list,leads_retrieval",
}

// ─── URL helpers ──────────────────────────────────────────

function getApiBaseUrl(): string {
  if (process.env.API_URL) return process.env.API_URL
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`
  return "http://localhost:8080"
}

function callbackUrl(provider: string): string {
  return `${getApiBaseUrl()}/api/connected-accounts/callback/${provider}`
}

// ─── State encoding ───────────────────────────────────────

interface OAuthState {
  userId: string; provider: string; returnUrl: string
  nonce: string; ts: number; cv?: string
}

function encodeState(data: OAuthState): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url")
}

function decodeState(raw: string): OAuthState | null {
  try {
    const data = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthState
    if (!data.userId || !data.provider || !data.returnUrl) return null
    if (Date.now() - data.ts > 30 * 60 * 1000) return null
    return data
  } catch { return null }
}

// ─── GET /api/connected-accounts ─────────────────────────

router.get("/connected-accounts", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select({
        id:           connectedAccounts.id,
        user_id:      connectedAccounts.userId,
        provider:     connectedAccounts.provider,
        account_name: connectedAccounts.accountName,
        account_id:   connectedAccounts.accountId,
        status:       connectedAccounts.status,
        last_synced_at: connectedAccounts.lastSyncedAt,
        created_at:   connectedAccounts.createdAt,
        metadata:     connectedAccounts.metadata,
      })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, req.userId))
      .orderBy(asc(connectedAccounts.provider))

    return res.json(rows)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Failed to load connected accounts" })
  }
})

// ─── GET /api/connected-accounts/oauth-url/:provider ─────

router.get("/connected-accounts/oauth-url/:provider", requireAuth, async (req: any, res) => {
  const provider = req.params.provider as Provider
  if (!VALID_PROVIDERS.includes(provider)) return res.status(400).json({ error: "Invalid provider" })

  const returnUrl = (req.query.returnUrl as string) || getApiBaseUrl()

  if (provider === "whatsapp" || provider === "facebook" || provider === "instagram") {
    const appId = process.env.FACEBOOK_APP_ID
    if (!appId) {
      return res.status(503).json({
        configured: false,
        error: "FACEBOOK_APP_ID is not set. Add it in your Replit environment secrets.",
        envVars: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
      })
    }
    const state = encodeState({ userId: req.userId, provider, returnUrl, nonce: crypto.randomUUID(), ts: Date.now() })
    const params = new URLSearchParams({ client_id: appId, redirect_uri: callbackUrl(provider), scope: META_SCOPES[provider], state, response_type: "code" })
    return res.json({ configured: true, url: `${META_AUTH_URL}?${params}` })
  }

  if (provider === "tiktok") {
    const clientKey = process.env.TIKTOK_CLIENT_KEY
    if (!clientKey) {
      return res.status(503).json({
        configured: false,
        error: "TIKTOK_CLIENT_KEY is not set. Add it in your Replit environment secrets.",
        envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
      })
    }
    const codeVerifier = crypto.randomBytes(32).toString("base64url")
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url")
    const state = encodeState({ userId: req.userId, provider, returnUrl, nonce: crypto.randomUUID(), ts: Date.now(), cv: codeVerifier })
    const params = new URLSearchParams({ client_key: clientKey, redirect_uri: callbackUrl(provider), scope: "user.info.basic", state, response_type: "code", code_challenge: codeChallenge, code_challenge_method: "S256" })
    return res.json({ configured: true, url: `${TIKTOK_AUTH_URL}?${params}` })
  }

  return res.status(400).json({ error: "Unsupported provider" })
})

// ─── GET /api/connected-accounts/callback/:provider ──────

router.get("/connected-accounts/callback/:provider", async (req, res) => {
  const provider = req.params.provider as Provider
  const { code, state: stateRaw, error: oauthError } = req.query as Record<string, string>

  const stateData = stateRaw ? decodeState(stateRaw) : null
  const returnUrl = stateData?.returnUrl || getApiBaseUrl()

  const redirectError = (msg: string) =>
    res.redirect(`${returnUrl}?tab=accounts&error=${encodeURIComponent(msg)}&provider=${provider}`)

  if (oauthError) return redirectError(oauthError)
  if (!code || !stateData) return redirectError("Invalid or expired state. Please try again.")

  const { userId, cv: codeVerifier } = stateData
  const cb = callbackUrl(provider)

  try {
    let accessToken = ""
    let accountName = ""
    let accountId   = ""
    let metadata: Record<string, unknown> | null = null

    if (provider === "facebook" || provider === "instagram" || provider === "whatsapp") {
      const appId     = process.env.FACEBOOK_APP_ID!
      const appSecret = process.env.FACEBOOK_APP_SECRET!
      if (!appId || !appSecret) return redirectError("Server not configured for Meta OAuth.")

      const tokenRes  = await fetch(`${META_TOKEN_URL}?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(cb)}`)
      const tokenJson = await tokenRes.json() as any
      if (!tokenJson.access_token) throw new Error(tokenJson?.error?.message || "Meta token exchange failed")
      accessToken = tokenJson.access_token

      const profileRes  = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${accessToken}`)
      const profileJson = await profileRes.json() as any
      accountId   = String(profileJson.id ?? "")
      accountName = String(profileJson.name ?? "")

      if (provider === "whatsapp") {
        try {
          const wabaListRes  = await fetch(`https://graph.facebook.com/v18.0/${accountId}/whatsapp_business_accounts?access_token=${accessToken}`)
          const wabaListJson = await wabaListRes.json() as any
          const wabaId = wabaListJson?.data?.[0]?.id as string | undefined
          if (wabaId) {
            const phoneRes  = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${accessToken}`)
            const phoneJson = await phoneRes.json() as any
            const phoneNumId = phoneJson?.data?.[0]?.id as string | undefined
            metadata = { waba_id: wabaId, phone_number_id: phoneNumId ?? null }
          }
        } catch (waErr) {
          console.warn("Could not resolve WhatsApp phone_number_id:", waErr)
        }
      }
    } else if (provider === "tiktok") {
      const clientKey    = process.env.TIKTOK_CLIENT_KEY!
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
      if (!clientKey || !clientSecret) return redirectError("Server not configured for TikTok OAuth.")

      const body = new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: cb, code_verifier: codeVerifier ?? "" })
      const tokenRes  = await fetch(TIKTOK_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
      const tokenJson = await tokenRes.json() as any
      if (!tokenJson?.data?.access_token) throw new Error(tokenJson?.message || "TikTok token exchange failed")
      accessToken = tokenJson.data.access_token

      const userRes  = await fetch(`${TIKTOK_USER_URL}?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const userJson = await userRes.json() as any
      accountId   = String(userJson?.data?.user?.open_id ?? "")
      accountName = String(userJson?.data?.user?.display_name ?? "")
    } else {
      return redirectError("Unknown provider.")
    }

    // Upsert into local Postgres via Drizzle
    await db
      .insert(connectedAccounts)
      .values({
        userId,
        provider,
        accountName: accountName || null,
        accountId:   accountId   || null,
        accessToken,
        status: "active",
        lastSyncedAt: new Date(),
        metadata: metadata ?? undefined,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [connectedAccounts.userId, connectedAccounts.provider],
        set: {
          accountName:  accountName || null,
          accountId:    accountId   || null,
          accessToken,
          status:       "active",
          lastSyncedAt: new Date(),
          updatedAt:    new Date(),
          ...(metadata !== null ? { metadata } : {}),
        },
      })

    return res.redirect(`${returnUrl}?tab=accounts&connected=${provider}`)
  } catch (err: any) {
    return redirectError(err?.message ?? "Connection failed. Please try again.")
  }
})

// ─── GET /api/connected-accounts/:id/pages ────────────────

router.get("/connected-accounts/:id/pages", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select({ accessToken: connectedAccounts.accessToken, provider: connectedAccounts.provider })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, parseInt(req.params.id, 10)), eq(connectedAccounts.userId, req.userId)))
      .limit(1)

    const account = rows[0]
    if (!account) return res.status(404).json({ error: "Account not found" })
    if (account.provider !== "facebook" && account.provider !== "instagram") return res.status(400).json({ error: "Pages only available for Facebook/Instagram" })

    const pagesRes  = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,category,fan_count&access_token=${account.accessToken}`)
    const pagesJson = await pagesRes.json() as any
    if (pagesJson.error) throw new Error(pagesJson.error.message)
    return res.json(pagesJson.data ?? [])
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? "Failed to fetch pages" })
  }
})

// ─── GET /api/connected-accounts/:id/ad-accounts ─────────

router.get("/connected-accounts/:id/ad-accounts", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select({ accessToken: connectedAccounts.accessToken, accountId: connectedAccounts.accountId })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, parseInt(req.params.id, 10)), eq(connectedAccounts.userId, req.userId)))
      .limit(1)

    const account = rows[0]
    if (!account) return res.status(404).json({ error: "Account not found" })

    const adAccRes  = await fetch(`https://graph.facebook.com/v18.0/${account.accountId}/adaccounts?fields=id,name,account_status,currency,lead_gen_enabled&access_token=${account.accessToken}`)
    const adAccJson = await adAccRes.json() as any
    if (adAccJson.error) throw new Error(adAccJson.error.message)
    return res.json(adAccJson.data ?? [])
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? "Failed to fetch ad accounts" })
  }
})

// ─── PATCH /api/connected-accounts/:id/metadata ──────────

router.patch("/connected-accounts/:id/metadata", requireAuth, async (req: any, res) => {
  const allowed = ["selected_page_id", "selected_page_name", "selected_ad_account_id",
                   "selected_ad_account_name", "sync_interval_minutes", "default_pipeline",
                   "default_agent", "extra_tags"]
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key]
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: "No valid fields" })

  try {
    const rows = await db
      .select({ metadata: connectedAccounts.metadata })
      .from(connectedAccounts)
      .where(and(eq(connectedAccounts.id, parseInt(req.params.id, 10)), eq(connectedAccounts.userId, req.userId)))
      .limit(1)

    if (!rows[0]) return res.status(404).json({ error: "Account not found" })

    await db
      .update(connectedAccounts)
      .set({ metadata: { ...(rows[0].metadata ?? {}), ...patch }, updatedAt: new Date() })
      .where(and(eq(connectedAccounts.id, parseInt(req.params.id, 10)), eq(connectedAccounts.userId, req.userId)))

    return res.status(204).send()
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Failed to update metadata" })
  }
})

// ─── DELETE /api/connected-accounts/:id ──────────────────

router.delete("/connected-accounts/:id", requireAuth, async (req: any, res) => {
  try {
    await db
      .delete(connectedAccounts)
      .where(and(eq(connectedAccounts.id, parseInt(req.params.id, 10)), eq(connectedAccounts.userId, req.userId)))
    return res.status(204).send()
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Failed to disconnect account" })
  }
})

export default router

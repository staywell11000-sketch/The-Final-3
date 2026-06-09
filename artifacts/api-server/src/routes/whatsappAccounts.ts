import { Router } from "express"
import { requireAuth } from "../middlewares/requireAuth"
import { db, whatsappAccounts, userWhatsappPermissions } from "@workspace/db"
import { eq, and, sql } from "drizzle-orm"
import { logger } from "../lib/logger"

const router = Router()

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0"

// Plan limits for WhatsApp numbers
const WA_PLAN_LIMITS: Record<string, number | null> = {
  free:         0,
  trial:        1,
  starter:      1,
  professional: 3,
  agency:       null,
}

// ─── Helpers ──────────────────────────────────────────────

async function getOrgForUser(userId: string): Promise<{ id: number; plan: string; orgRole: string | null; ownerId: string } | null> {
  const row = await db.execute(sql`
    SELECT o.id, o.plan, o.owner_id,
           u.org_role
    FROM organizations o
    LEFT JOIN users u ON u.id = ${userId}
    WHERE o.owner_id = ${userId}
       OR o.id = (SELECT organization_id FROM users WHERE id = ${userId})
    ORDER BY (o.owner_id = ${userId}) DESC
    LIMIT 1
  `)
  if (!row.rows.length) return null
  const r = row.rows[0] as any
  return { id: r.id, plan: r.plan ?? "trial", orgRole: r.org_role ?? null, ownerId: r.owner_id }
}

function isOrgOwnerOrAdmin(org: { ownerId: string; orgRole: string | null }, userId: string): boolean {
  return org.ownerId === userId || org.orgRole === "admin"
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function serializeAccount(acct: typeof whatsappAccounts.$inferSelect) {
  const meta = parseMetadata(acct.metadata as string | null)
  return {
    id:             acct.id,
    organizationId: acct.organizationId,
    phoneNumber:    acct.phoneNumber,
    phoneNumberId:  acct.phoneNumberId,
    displayName:    acct.displayName,
    businessName:   acct.businessName,
    wabaId:         acct.wabaId,
    accountId:      acct.accountId,
    status:         acct.status,
    connectedAt:    acct.connectedAt,
    lastSyncedAt:   acct.lastSyncedAt,
    templates:      (meta.templates as unknown[]) ?? [],
    templatesSyncedAt: (meta.templates_synced_at as string) ?? null,
  }
}

// ─── GET /whatsapp/accounts — list org's accounts ─────────

router.get("/whatsapp/accounts", requireAuth, async (req: any, res) => {
  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.json({ accounts: [] })

    const isOwnerOrAdmin = isOrgOwnerOrAdmin(org, req.userId)

    if (isOwnerOrAdmin) {
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.organizationId, org.id))

      return res.json({ accounts: accounts.map(serializeAccount) })
    }

    // Non-admin: only accounts they have permission to view
    const perms = await db
      .select({ whatsappAccountId: userWhatsappPermissions.whatsappAccountId })
      .from(userWhatsappPermissions)
      .where(and(
        eq(userWhatsappPermissions.userId, req.userId),
        eq(userWhatsappPermissions.canView, true),
      ))

    if (!perms.length) return res.json({ accounts: [] })

    const permittedIds = perms.map(p => p.whatsappAccountId)

    const accounts = await db
      .select()
      .from(whatsappAccounts)
      .where(and(
        eq(whatsappAccounts.organizationId, org.id),
        eq(whatsappAccounts.status, "active"),
      ))

    const visible = accounts
      .filter(a => permittedIds.includes(a.id))
      .map(a => ({
        ...serializeAccount(a),
        myPermission: perms.find(p => p.whatsappAccountId === a.id) ?? null,
      }))

    return res.json({ accounts: visible })
  } catch (err: any) {
    logger.error({ err }, "GET /whatsapp/accounts error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── GET /whatsapp/accounts/limit ─────────────────────────

router.get("/whatsapp/accounts/limit", requireAuth, async (req: any, res) => {
  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.json({ used: 0, limit: 1, remaining: 1, plan: "trial" })

    const planKey = org.plan ?? "trial"
    const limit = WA_PLAN_LIMITS[planKey] ?? 1

    const countRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.organizationId, org.id))

    const used = countRows[0]?.count ?? 0
    const remaining = limit === null ? null : Math.max(0, limit - used)

    return res.json({ used, limit, remaining, plan: planKey })
  } catch (err: any) {
    logger.error({ err }, "GET /whatsapp/accounts/limit error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── GET /whatsapp/conversation-accounts ──────────────────
// Returns a map of conversationId → whatsappAccountId

router.get("/whatsapp/conversation-accounts", requireAuth, async (req: any, res) => {
  try {
    const { conversationWaAccounts } = await import("@workspace/db")
    const org = await getOrgForUser(req.userId)
    if (!org) return res.json({ map: {} })

    // Get all account IDs for this org
    const accts = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.organizationId, org.id))

    if (!accts.length) return res.json({ map: {} })

    const accountIds = accts.map(a => a.id)

    // Fetch conversation mappings for those accounts
    const rows = await db.execute(sql`
      SELECT conversation_id, whatsapp_account_id
      FROM conversation_wa_accounts
      WHERE whatsapp_account_id = ANY(${accountIds}::int[])
    `)

    const map: Record<string, number> = {}
    for (const row of rows.rows as any[]) {
      map[row.conversation_id] = row.whatsapp_account_id
    }

    return res.json({ map })
  } catch (err: any) {
    logger.error({ err }, "GET /whatsapp/conversation-accounts error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── POST /whatsapp/accounts/connect ──────────────────────
// Connect a new WhatsApp account via Embedded Signup code

router.post("/whatsapp/accounts/connect", requireAuth, async (req: any, res) => {
  const { code } = req.body as { code?: string }
  if (!code) return res.status(400).json({ error: "code is required" })

  const appId     = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return res.status(503).json({ error: "Meta app credentials are not configured" })
  }

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(400).json({ error: "No organization found" })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can connect WhatsApp accounts" })
    }

    // Check plan limit
    const planKey = org.plan ?? "trial"
    const limit = WA_PLAN_LIMITS[planKey] ?? 1

    if (limit !== null) {
      const countRows = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.organizationId, org.id))

      const used = countRows[0]?.count ?? 0
      if (used >= limit) {
        return res.status(402).json({
          error:   "WhatsApp account limit reached for your plan",
          used,
          limit,
          plan:    planKey,
          upgrade: true,
        })
      }
    }

    // Exchange EBS code for access token
    const tokenRes  = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`,
    )
    const tokenJson = await tokenRes.json() as any
    if (!tokenJson.access_token) {
      throw new Error(tokenJson?.error?.message ?? "Token exchange failed")
    }
    const accessToken = tokenJson.access_token as string

    // Get user profile
    const profileRes  = await fetch(`${GRAPH_API_BASE}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
    const profileJson = await profileRes.json() as any
    if (profileJson.error) throw new Error(profileJson.error.message)
    const fbUserId   = String(profileJson.id ?? "")
    const fbUserName = String(profileJson.name ?? "")

    let wabaId:       string | null = null
    let phoneNumId:   string | null = null
    let phoneNumber:  string | null = null
    let businessName: string        = fbUserName

    try {
      const wabaRes  = await fetch(
        `${GRAPH_API_BASE}/${fbUserId}/whatsapp_business_accounts?fields=id,name,business&access_token=${encodeURIComponent(accessToken)}`,
      )
      const wabaJson = await wabaRes.json() as any
      const waba     = wabaJson.data?.[0]
      if (waba) {
        wabaId       = waba.id as string
        businessName = (waba.name as string) || fbUserName

        const phoneRes  = await fetch(
          `${GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(accessToken)}`,
        )
        const phoneJson = await phoneRes.json() as any
        const phone     = phoneJson.data?.[0]
        if (phone) {
          phoneNumId  = phone.id as string
          phoneNumber = phone.display_phone_number as string
        }
      }
    } catch (waErr) {
      logger.warn({ waErr }, "Could not fetch WABA details — storing basic account")
    }

    // Insert new whatsapp_account record
    const inserted = await db
      .insert(whatsappAccounts)
      .values({
        organizationId: org.id,
        phoneNumber,
        phoneNumberId:  phoneNumId,
        displayName:    businessName,
        businessName,
        wabaId,
        accountId:      fbUserId,
        accessToken,
        status:         "active",
        connectedAt:    new Date(),
        lastSyncedAt:   new Date(),
        metadata:       JSON.stringify({
          waba_id:         wabaId,
          phone_number_id: phoneNumId,
          phone_number:    phoneNumber,
          business_name:   businessName,
        }),
        createdAt:      new Date(),
        updatedAt:      new Date(),
      })
      .returning()

    const account = inserted[0]
    logger.info({ userId: req.userId, orgId: org.id, accountId: account.id, phoneNumId }, "WhatsApp account connected")

    return res.status(201).json({ success: true, account: serializeAccount(account) })
  } catch (err: any) {
    logger.error({ err }, "POST /whatsapp/accounts/connect error")
    return res.status(500).json({ error: err?.message ?? "Connection failed" })
  }
})

// ─── DELETE /whatsapp/accounts/:id ────────────────────────

router.delete("/whatsapp/accounts/:id", requireAuth, async (req: any, res) => {
  const accountId = parseInt(req.params.id, 10)
  if (isNaN(accountId)) return res.status(400).json({ error: "Invalid account ID" })

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(403).json({ error: "No organization found" })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can disconnect WhatsApp accounts" })
    }

    // Verify account belongs to org
    const accounts = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .where(and(
        eq(whatsappAccounts.id, accountId),
        eq(whatsappAccounts.organizationId, org.id),
      ))
      .limit(1)

    if (!accounts.length) return res.status(404).json({ error: "WhatsApp account not found" })

    // Delete permissions and the account
    await db
      .delete(userWhatsappPermissions)
      .where(eq(userWhatsappPermissions.whatsappAccountId, accountId))

    await db
      .delete(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId))

    logger.info({ userId: req.userId, orgId: org.id, accountId }, "WhatsApp account disconnected")
    return res.status(204).send()
  } catch (err: any) {
    logger.error({ err }, "DELETE /whatsapp/accounts/:id error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── GET /whatsapp/accounts/:id/health ───────────────────

router.get("/whatsapp/accounts/:id/health", requireAuth, async (req: any, res) => {
  const accountId = parseInt(req.params.id, 10)
  if (isNaN(accountId)) return res.status(400).json({ error: "Invalid account ID" })

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(403).json({ error: "No organization" })

    const accounts = await db
      .select()
      .from(whatsappAccounts)
      .where(and(
        eq(whatsappAccounts.id, accountId),
        eq(whatsappAccounts.organizationId, org.id),
      ))
      .limit(1)

    const acct = accounts[0]
    if (!acct) return res.status(404).json({ error: "Account not found" })

    const token      = acct.accessToken as string
    const phoneNumId = acct.phoneNumberId

    let tokenValid = false
    let phoneValid = false
    const details: Record<string, unknown> = {}

    try {
      const r = await fetch(`${GRAPH_API_BASE}/me?access_token=${encodeURIComponent(token)}`)
      const j = await r.json() as any
      tokenValid     = !j.error
      details.fbName = j.name ?? null
    } catch { tokenValid = false }

    if (phoneNumId && tokenValid) {
      try {
        const r = await fetch(
          `${GRAPH_API_BASE}/${phoneNumId}?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(token)}`,
        )
        const j = await r.json() as any
        phoneValid             = !j.error
        if (phoneValid) {
          details.displayPhone  = j.display_phone_number ?? null
          details.verifiedName  = j.verified_name        ?? null
          details.qualityRating = j.quality_rating       ?? null
        }
      } catch { phoneValid = false }
    }

    const warnings: string[] = []
    if (!tokenValid) warnings.push("Access token is invalid or expired — reconnect this account")
    if (tokenValid && !phoneValid) warnings.push("Phone number ID is unreachable — reconnect this account")

    return res.json({
      connected: true,
      healthy:   tokenValid && phoneValid,
      tokenValid,
      phoneValid,
      warnings,
      details,
    })
  } catch (err: any) {
    logger.error({ err }, "GET /whatsapp/accounts/:id/health error")
    return res.status(500).json({ error: err?.message ?? "Health check failed" })
  }
})

// ─── POST /whatsapp/accounts/:id/templates/sync ──────────

router.post("/whatsapp/accounts/:id/templates/sync", requireAuth, async (req: any, res) => {
  const accountId = parseInt(req.params.id, 10)
  if (isNaN(accountId)) return res.status(400).json({ error: "Invalid account ID" })

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(403).json({ error: "No organization" })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can sync templates" })
    }

    const accounts = await db
      .select()
      .from(whatsappAccounts)
      .where(and(
        eq(whatsappAccounts.id, accountId),
        eq(whatsappAccounts.organizationId, org.id),
      ))
      .limit(1)

    const acct = accounts[0]
    if (!acct) return res.status(404).json({ error: "Account not found" })

    const token  = acct.accessToken as string
    const wabaId = acct.wabaId

    if (!wabaId) return res.status(400).json({ error: "No WABA ID for this account — reconnect" })

    const templatesRes  = await fetch(
      `${GRAPH_API_BASE}/${wabaId}/message_templates?fields=id,name,language,category,status&limit=100&access_token=${encodeURIComponent(token)}`,
    )
    const templatesJson = await templatesRes.json() as any
    if (templatesJson.error) {
      throw new Error(templatesJson.error.message ?? "Failed to fetch templates")
    }

    const templates = (templatesJson.data ?? []).map((t: any) => ({
      id:       t.id,
      name:     t.name,
      language: t.language,
      category: t.category,
      status:   t.status,
    }))

    const meta = parseMetadata(acct.metadata as string | null)
    meta.templates           = templates
    meta.templates_synced_at = new Date().toISOString()

    await db
      .update(whatsappAccounts)
      .set({ metadata: JSON.stringify(meta), lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappAccounts.id, accountId))

    logger.info({ accountId, count: templates.length }, "Templates synced for WA account")
    return res.json({ synced: templates.length, templates })
  } catch (err: any) {
    logger.error({ err }, "POST /whatsapp/accounts/:id/templates/sync error")
    return res.status(500).json({ error: err?.message ?? "Template sync failed" })
  }
})

// ─── GET /whatsapp/permissions ────────────────────────────
// Returns all org members with their WA permissions

router.get("/whatsapp/permissions", requireAuth, async (req: any, res) => {
  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.json({ members: [] })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can view permissions" })
    }

    // Get all members of the org
    const membersRows = await db.execute(sql`
      SELECT u.id as user_id, u.full_name, u.email, u.org_role
      FROM users u
      WHERE u.organization_id = ${org.id}
      ORDER BY u.full_name
    `)

    // Get all WA accounts for org
    const accounts = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.organizationId, org.id))

    const accountIds = accounts.map(a => a.id)

    // Get all permissions
    const perms = accountIds.length
      ? await db
          .select()
          .from(userWhatsappPermissions)
          .where(sql`${userWhatsappPermissions.whatsappAccountId} = ANY(${accountIds}::int[])`)
      : []

    const members = (membersRows.rows as any[]).map(m => ({
      userId:    m.user_id,
      userName:  m.full_name,
      userEmail: m.email,
      orgRole:   m.org_role,
      accounts:  accountIds.map(aid => {
        const perm = perms.find(p => p.userId === m.user_id && p.whatsappAccountId === aid)
        return {
          accountId: aid,
          canView:   perm?.canView   ?? false,
          canReply:  perm?.canReply  ?? false,
          canAssign: perm?.canAssign ?? false,
        }
      }),
    }))

    return res.json({ members })
  } catch (err: any) {
    logger.error({ err }, "GET /whatsapp/permissions error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── PUT /whatsapp/permissions ────────────────────────────

router.put("/whatsapp/permissions", requireAuth, async (req: any, res) => {
  const { userId, whatsappAccountId, canView, canReply, canAssign } = req.body as {
    userId:           string
    whatsappAccountId: number
    canView:          boolean
    canReply:         boolean
    canAssign:        boolean
  }

  if (!userId || !whatsappAccountId) {
    return res.status(400).json({ error: "userId and whatsappAccountId required" })
  }

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(403).json({ error: "No organization" })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can manage permissions" })
    }

    // Verify account belongs to org
    const accounts = await db
      .select({ id: whatsappAccounts.id })
      .from(whatsappAccounts)
      .where(and(
        eq(whatsappAccounts.id, whatsappAccountId),
        eq(whatsappAccounts.organizationId, org.id),
      ))
      .limit(1)

    if (!accounts.length) return res.status(404).json({ error: "Account not found in your org" })

    await db
      .insert(userWhatsappPermissions)
      .values({
        userId,
        whatsappAccountId,
        canView:   canView   ?? true,
        canReply:  canReply  ?? true,
        canAssign: canAssign ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userWhatsappPermissions.userId, userWhatsappPermissions.whatsappAccountId],
        set: {
          canView:   canView   ?? true,
          canReply:  canReply  ?? true,
          canAssign: canAssign ?? false,
          updatedAt: new Date(),
        },
      })

    return res.json({ success: true })
  } catch (err: any) {
    logger.error({ err }, "PUT /whatsapp/permissions error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── DELETE /whatsapp/permissions ────────────────────────

router.delete("/whatsapp/permissions", requireAuth, async (req: any, res) => {
  const { userId, whatsappAccountId } = req.body as { userId: string; whatsappAccountId: number }
  if (!userId || !whatsappAccountId) {
    return res.status(400).json({ error: "userId and whatsappAccountId required" })
  }

  try {
    const org = await getOrgForUser(req.userId)
    if (!org) return res.status(403).json({ error: "No organization" })

    if (!isOrgOwnerOrAdmin(org, req.userId)) {
      return res.status(403).json({ error: "Only org owners and admins can manage permissions" })
    }

    await db
      .delete(userWhatsappPermissions)
      .where(and(
        eq(userWhatsappPermissions.userId, userId),
        eq(userWhatsappPermissions.whatsappAccountId, whatsappAccountId),
      ))

    return res.json({ success: true })
  } catch (err: any) {
    logger.error({ err }, "DELETE /whatsapp/permissions error")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

export default router

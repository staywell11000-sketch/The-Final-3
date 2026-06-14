import { Router } from "express"
import crypto from "crypto"
import { requireAuth } from "../middlewares/requireAuth"
import { supabaseAdmin } from "../lib/supabase"
import { db, connectedAccounts, whatsappAccounts, conversationWaAccounts } from "@workspace/db"
import { eq, and, sql } from "drizzle-orm"
import { logger } from "../lib/logger"

const router = Router()

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0"

// ─── Helpers ──────────────────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!signature.startsWith("sha256=")) return false
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function getApiBaseUrl(): string {
  if (process.env.API_URL) return process.env.API_URL
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`
  return "http://localhost:8080"
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === "object") return raw as Record<string, unknown>
  try { return JSON.parse(raw as string) } catch { return {} }
}

// ─── GET /api/whatsapp/webhook — Meta hub challenge ──────

router.get("/whatsapp/webhook", (req, res) => {
  const mode      = req.query["hub.mode"]         as string
  const token     = req.query["hub.verify_token"] as string
  const challenge = req.query["hub.challenge"]    as string

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? ""
  if (!verifyToken) {
    logger.warn("WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set")
    return res.status(403).send("Webhook verify token not configured")
  }

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("WhatsApp webhook verified successfully")
    return res.status(200).send(challenge)
  }

  return res.status(403).send("Verification failed")
})

// ─── POST /api/whatsapp/webhook — inbound events ─────────

router.post("/whatsapp/webhook", async (req: any, res) => {
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? ""

  if (appSecret) {
    const signature = (req.headers["x-hub-signature-256"] as string) ?? ""
    const rawBody: Buffer | undefined = req.rawBody
    if (!rawBody || !verifySignature(rawBody, signature, appSecret)) {
      logger.warn("WhatsApp webhook: invalid signature")
      return void res.status(401).send("Invalid signature")
    }
  } else {
    if (process.env.NODE_ENV !== "development") {
      logger.error("FACEBOOK_APP_SECRET not set — rejecting webhook request in non-dev environment")
      return void res.status(401).send("Webhook not configured")
    }
    logger.warn("FACEBOOK_APP_SECRET not set — skipping signature check (development mode only)")
  }

  res.status(200).send("EVENT_RECEIVED")

  try {
    const body = req.body
    if (body?.object !== "whatsapp_business_account") return

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue
        const value = change.value

        // ── Status updates ──────────────────────────────
        for (const statusEvt of value.statuses ?? []) {
          const wamid     = statusEvt.id     as string
          const newStatus = statusEvt.status as string

          const mappedStatus =
            newStatus === "delivered" ? "delivered" :
            newStatus === "read"      ? "read"      : null

          if (mappedStatus) {
            const { error } = await supabaseAdmin
              .from("messages")
              .update({ status: mappedStatus })
              .eq("whatsapp_message_id", wamid)

            if (error) logger.error({ error, wamid }, "Failed to update message status")
          }
        }

        // ── Inbound messages ────────────────────────────
        for (const msg of value.messages ?? []) {
          if (msg.type !== "text") continue

          const senderPhone = msg.from   as string
          const wamid       = msg.id     as string
          const content     = (msg.text?.body as string) ?? ""
          const phoneNumId  = value.metadata?.phone_number_id as string | undefined

          // Try new multi-inbox: find WA account by phone_number_id
          let ownerUserId:       string | null = null
          let waAccountId:       number | null = null

          if (phoneNumId) {
            const waAccts = await db
              .select({ id: whatsappAccounts.id, organizationId: whatsappAccounts.organizationId })
              .from(whatsappAccounts)
              .where(and(
                eq(whatsappAccounts.phoneNumberId, phoneNumId),
                eq(whatsappAccounts.status, "active"),
              ))
              .limit(1)

            if (waAccts.length) {
              waAccountId = waAccts[0].id
              const orgId = waAccts[0].organizationId
              // Get org owner as conversation owner
              const orgRows = await db.execute(sql`SELECT owner_id FROM organizations WHERE id = ${orgId} LIMIT 1`)
              if (orgRows.rows.length) {
                ownerUserId = (orgRows.rows[0] as any).owner_id as string
              }
            }
          }

          // Fallback: legacy connected_accounts
          if (!ownerUserId && phoneNumId) {
            const accounts = await db
              .select({ userId: connectedAccounts.userId, metadata: connectedAccounts.metadata })
              .from(connectedAccounts)
              .where(and(
                eq(connectedAccounts.provider, "whatsapp"),
                eq(connectedAccounts.status, "active"),
              ))

            for (const acct of accounts) {
              const meta = parseMetadata(acct.metadata)
              if (meta?.phone_number_id === phoneNumId) {
                ownerUserId = acct.userId
                break
              }
            }
          }

          if (!ownerUserId) {
            logger.warn({ phoneNumId }, "No WA account found for incoming message")
            continue
          }

          // Find or create contact by phone number
          let contactId: string

          const { data: existingContact } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("user_id", ownerUserId)
            .eq("phone", senderPhone)
            .maybeSingle()

          if (existingContact) {
            contactId = existingContact.id
          } else {
            const displayName = value.contacts?.[0]?.profile?.name ?? senderPhone
            const initials = displayName
              .split(" ")
              .filter(Boolean)
              .map((n: string) => n[0] ?? "")
              .join("")
              .toUpperCase()
              .slice(0, 2) || "??"

            const { data: newContact, error: ce } = await supabaseAdmin
              .from("contacts")
              .insert({
                user_id:         ownerUserId,
                name:            displayName,
                phone:           senderPhone,
                avatar_initials: initials,
              })
              .select("id")
              .single()

            if (ce || !newContact) {
              logger.error({ ce }, "Failed to create contact for inbound WhatsApp message")
              continue
            }
            contactId = newContact.id
          }

          // Find or create conversation (channel = 'whatsapp')
          let conversationId: string

          const { data: existingConv } = await supabaseAdmin
            .from("conversations")
            .select("id")
            .eq("user_id", ownerUserId)
            .eq("contact_id", contactId)
            .eq("channel", "whatsapp")
            .maybeSingle()

          if (existingConv) {
            conversationId = existingConv.id
          } else {
            const displayName = value.contacts?.[0]?.profile?.name ?? senderPhone
            const { data: newConv, error: ve } = await supabaseAdmin
              .from("conversations")
              .insert({
                user_id:         ownerUserId,
                contact_id:      contactId,
                channel:         "whatsapp",
                title:           displayName,
                status:          "active",
                last_message_at: new Date().toISOString(),
                unread_count:    1,
              })
              .select("id")
              .single()

            if (ve || !newConv) {
              logger.error({ ve }, "Failed to create conversation for inbound WhatsApp message")
              continue
            }
            conversationId = newConv.id
          }

          // Store whatsapp_account → conversation mapping in Drizzle
          if (waAccountId) {
            await db
              .insert(conversationWaAccounts)
              .values({ conversationId, whatsappAccountId: waAccountId, createdAt: new Date() })
              .onConflictDoNothing()
              .catch(e => logger.warn({ e }, "Failed to store conversation WA account mapping"))
          }

          // Deduplicate by wamid
          const { data: dup } = await supabaseAdmin
            .from("messages")
            .select("id")
            .eq("whatsapp_message_id", wamid)
            .maybeSingle()

          if (dup) continue

          const { error: me } = await supabaseAdmin
            .from("messages")
            .insert({
              conversation_id:     conversationId,
              sender_id:           ownerUserId,
              content,
              type:                "text",
              status:              "delivered",
              direction:           "inbound",
              whatsapp_message_id: wamid,
            })

          if (me) {
            logger.error({ me }, "Failed to insert inbound WhatsApp message")
            continue
          }

          await supabaseAdmin
            .from("conversations")
            .update({
              last_message:    content,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId)

          await supabaseAdmin.rpc("increment_unread_count", { conv_id: conversationId })
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error processing WhatsApp webhook")
  }
})

// ─── POST /api/whatsapp/send ─────────────────────────────

router.post("/whatsapp/send", requireAuth, async (req: any, res) => {
  const { conversationId, content } = req.body as { conversationId: string; content: string }

  if (!conversationId || !content?.trim()) {
    return res.status(400).json({ error: "conversationId and content are required" })
  }

  try {
    const { data: conv, error: ce } = await supabaseAdmin
      .from("conversations")
      .select("id, channel, contact:contacts(phone)")
      .eq("id", conversationId)
      .eq("user_id", req.userId)
      .single()

    if (ce || !conv) return res.status(404).json({ error: "Conversation not found" })

    const channel = (conv as any).channel as string
    if (channel !== "whatsapp") {
      return res.status(400).json({ error: "Conversation is not a WhatsApp channel" })
    }

    const recipientPhone = (conv as any).contact?.phone as string | null
    if (!recipientPhone) {
      return res.status(400).json({ error: "Contact has no phone number" })
    }

    let accessToken:  string | null = null
    let phoneNumId:   string | null = null
    let waAccountId:  number | null = null

    // Try new multi-inbox: look up via conversation mapping → whatsapp_accounts
    const mapping = await db
      .select({ whatsappAccountId: conversationWaAccounts.whatsappAccountId })
      .from(conversationWaAccounts)
      .where(eq(conversationWaAccounts.conversationId, conversationId))
      .limit(1)

    if (mapping.length) {
      waAccountId = mapping[0].whatsappAccountId
      const waAccts = await db
        .select({ accessToken: whatsappAccounts.accessToken, phoneNumberId: whatsappAccounts.phoneNumberId })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, waAccountId))
        .limit(1)

      if (waAccts.length) {
        accessToken = waAccts[0].accessToken
        phoneNumId  = waAccts[0].phoneNumberId
      }
    }

    // Fallback: legacy connected_accounts
    if (!accessToken) {
      const accounts = await db
        .select({ accessToken: connectedAccounts.accessToken, metadata: connectedAccounts.metadata })
        .from(connectedAccounts)
        .where(and(
          eq(connectedAccounts.userId, req.userId),
          eq(connectedAccounts.provider, "whatsapp"),
          eq(connectedAccounts.status, "active"),
        ))
        .limit(1)

      const account = accounts[0]
      if (account) {
        const meta = parseMetadata(account.metadata)
        accessToken = account.accessToken as string
        phoneNumId  = (meta?.phone_number_id as string) ?? null
      }
    }

    if (!accessToken || !phoneNumId) {
      return res.status(400).json({ error: "No active WhatsApp account found for this conversation — reconnect" })
    }

    // Call WhatsApp Cloud API
    const waRes = await fetch(`${GRAPH_API_BASE}/${phoneNumId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to:                recipientPhone,
        type:              "text",
        text:              { preview_url: false, body: content },
      }),
    })

    const waJson = await waRes.json() as any

    if (!waRes.ok || !waJson.messages?.[0]?.id) {
      const errMsg = waJson?.error?.message ?? "WhatsApp API request failed"
      logger.error({ waJson }, "WhatsApp send failed")
      return res.status(502).json({ error: errMsg })
    }

    const wamid = waJson.messages[0].id as string

    const { data: message, error: me } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id:     conversationId,
        sender_id:           req.userId,
        content,
        type:                "text",
        status:              "sent",
        direction:           "outbound",
        whatsapp_message_id: wamid,
      })
      .select()
      .single()

    if (me || !message) {
      logger.error({ me }, "Failed to insert outbound WhatsApp message")
      return res.status(500).json({ error: "Message sent but failed to save" })
    }

    await supabaseAdmin
      .from("conversations")
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    return res.json({ message })
  } catch (err: any) {
    logger.error({ err }, "Error in /whatsapp/send")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── GET /api/whatsapp/status ─────────────────────────────
// Legacy single-account status — now reads from whatsapp_accounts first

router.get("/whatsapp/status", requireAuth, async (req: any, res) => {
  try {
    // Try new multi-inbox table first
    const orgRow = await db.execute(sql`
      SELECT o.id FROM organizations o
      WHERE o.owner_id = ${req.userId}
         OR o.id = (SELECT organization_id FROM users WHERE id = ${req.userId})
      LIMIT 1
    `)

    if (orgRow.rows.length) {
      const orgId = (orgRow.rows[0] as any).id
      const waAccts = await db
        .select()
        .from(whatsappAccounts)
        .where(and(
          eq(whatsappAccounts.organizationId, orgId),
          eq(whatsappAccounts.status, "active"),
        ))
        .limit(1)

      const acct = waAccts[0]
      if (acct) {
        const meta = parseMetadata(acct.metadata as string | null)
        return res.json({
          connected:         true,
          status:            acct.status,
          accountName:       acct.displayName ?? acct.businessName,
          phoneNumberId:     acct.phoneNumberId,
          phoneNumber:       acct.phoneNumber,
          wabaId:            acct.wabaId,
          businessName:      acct.businessName,
          lastSyncedAt:      acct.lastSyncedAt,
          webhookUrl:        `${getApiBaseUrl()}/api/whatsapp/webhook`,
          verifyToken:       process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "configured" : "not_configured",
          templates:         (meta.templates as unknown[]) ?? [],
          templatesSyncedAt: (meta.templates_synced_at as string) ?? null,
          multiInbox:        true,
        })
      }
    }

    // Fallback: legacy connected_accounts
    const accounts = await db
      .select({
        id:           connectedAccounts.id,
        status:       connectedAccounts.status,
        accountName:  connectedAccounts.accountName,
        metadata:     connectedAccounts.metadata,
        lastSyncedAt: connectedAccounts.lastSyncedAt,
      })
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, req.userId),
        eq(connectedAccounts.provider, "whatsapp"),
      ))
      .limit(1)

    const account = accounts[0]
    if (!account) {
      return res.json({ connected: false })
    }

    const meta = parseMetadata(account.metadata)
    return res.json({
      connected:         true,
      status:            account.status,
      accountName:       account.accountName,
      phoneNumberId:     (meta?.phone_number_id as string) ?? null,
      phoneNumber:       (meta?.phone_number   as string) ?? null,
      wabaId:            (meta?.waba_id        as string) ?? null,
      businessName:      (meta?.business_name  as string) ?? null,
      lastSyncedAt:      account.lastSyncedAt,
      webhookUrl:        `${getApiBaseUrl()}/api/whatsapp/webhook`,
      verifyToken:       process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "configured" : "not_configured",
      templates:         (meta?.templates as unknown[]) ?? [],
      templatesSyncedAt: (meta?.templates_synced_at as string) ?? null,
      multiInbox:        false,
    })
  } catch (err: any) {
    logger.error({ err }, "Error in /whatsapp/status")
    return res.status(500).json({ error: err?.message ?? "Internal server error" })
  }
})

// ─── GET /api/whatsapp/sdk-config ─────────────────────────

router.get("/whatsapp/sdk-config", (_req, res) => {
  const appId    = process.env.FACEBOOK_APP_ID ?? null
  const configId = process.env.FACEBOOK_WHATSAPP_CONFIG_ID ?? null
  if (!appId) return res.json({ configured: false })
  return res.json({ configured: true, appId, configId })
})

// ─── POST /api/whatsapp/embedded-signup ───────────────────
// Legacy: now delegates to /whatsapp/accounts/connect but also
// keeps connected_accounts for backward compat

router.post("/whatsapp/embedded-signup", requireAuth, async (req: any, res) => {
  const { code } = req.body as { code?: string }
  if (!code) return res.status(400).json({ error: "code is required" })

  const appId     = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return res.status(503).json({ error: "Meta app credentials are not configured" })
  }

  try {
    // Exchange EBS code for access token
    const tokenRes  = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`,
    )
    const tokenJson = await tokenRes.json() as any
    if (!tokenJson.access_token) {
      throw new Error(tokenJson?.error?.message ?? "Token exchange failed")
    }
    const accessToken = tokenJson.access_token as string

    const profileRes  = await fetch(`${GRAPH_API_BASE}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
    const profileJson = await profileRes.json() as any
    if (profileJson.error) throw new Error(profileJson.error.message)
    const fbUserId   = String(profileJson.id ?? "")
    const fbUserName = String(profileJson.name ?? "")

    let wabaId:       string | null = null
    let phoneNumId:   string | null = null
    let phoneNumber:  string | null = null
    let businessId:   string | null = null
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
        businessId   = waba.business?.id ?? wabaId

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

    const metadata = { waba_id: wabaId, phone_number_id: phoneNumId, phone_number: phoneNumber, business_id: businessId, business_name: businessName }

    // Also write to new whatsapp_accounts table (org-level)
    try {
      const orgRow = await db.execute(sql`
        SELECT id FROM organizations
        WHERE owner_id = ${req.userId}
           OR id = (SELECT organization_id FROM users WHERE id = ${req.userId})
        LIMIT 1
      `)
      if (orgRow.rows.length) {
        const orgId = (orgRow.rows[0] as any).id as number
        await db
          .insert(whatsappAccounts)
          .values({
            organizationId: orgId,
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
            metadata:       JSON.stringify(metadata),
            createdAt:      new Date(),
            updatedAt:      new Date(),
          })
          .onConflictDoNothing()
      }
    } catch (orgErr) {
      logger.warn({ orgErr }, "Could not write to whatsapp_accounts — non-fatal")
    }

    // Legacy: upsert connected account (for backward compat)
    await db
      .insert(connectedAccounts)
      .values({
        userId:       req.userId,
        provider:     "whatsapp",
        accountName:  businessName,
        accountId:    fbUserId,
        accessToken,
        status:       "active",
        lastSyncedAt: new Date(),
        metadata,
        updatedAt:    new Date(),
      })
      .onConflictDoUpdate({
        target: [connectedAccounts.userId, connectedAccounts.provider],
        set: {
          accountName:  businessName,
          accountId:    fbUserId,
          accessToken,
          status:       "active",
          lastSyncedAt: new Date(),
          metadata,
          updatedAt:    new Date(),
        },
      })

    logger.info({ userId: req.userId, wabaId, phoneNumId }, "WhatsApp account connected via EBS")
    return res.json({ success: true, wabaId, phoneNumberId: phoneNumId, phoneNumber, businessName, businessId })
  } catch (err: any) {
    logger.error({ err }, "WhatsApp EBS failed")
    return res.status(500).json({ error: err?.message ?? "Connection failed" })
  }
})

// ─── GET /api/whatsapp/health ─────────────────────────────

router.get("/whatsapp/health", requireAuth, async (req: any, res) => {
  try {
    // Try new multi-inbox table first
    const orgRow = await db.execute(sql`
      SELECT o.id FROM organizations o
      WHERE o.owner_id = ${req.userId}
         OR o.id = (SELECT organization_id FROM users WHERE id = ${req.userId})
      LIMIT 1
    `)

    let accessToken: string | null = null
    let phoneNumId:  string | null = null
    let lastSyncedAt: Date | null  = null

    if (orgRow.rows.length) {
      const orgId = (orgRow.rows[0] as any).id
      const waAccts = await db
        .select()
        .from(whatsappAccounts)
        .where(and(
          eq(whatsappAccounts.organizationId, orgId),
          eq(whatsappAccounts.status, "active"),
        ))
        .limit(1)

      if (waAccts[0]) {
        accessToken  = waAccts[0].accessToken
        phoneNumId   = waAccts[0].phoneNumberId
        lastSyncedAt = waAccts[0].lastSyncedAt
      }
    }

    if (!accessToken) {
      const accounts = await db
        .select({ accessToken: connectedAccounts.accessToken, metadata: connectedAccounts.metadata, lastSyncedAt: connectedAccounts.lastSyncedAt })
        .from(connectedAccounts)
        .where(and(
          eq(connectedAccounts.userId, req.userId),
          eq(connectedAccounts.provider, "whatsapp"),
        ))
        .limit(1)

      const account = accounts[0]
      if (!account) return res.json({ connected: false })

      const meta = parseMetadata(account.metadata)
      accessToken  = account.accessToken as string
      phoneNumId   = (meta?.phone_number_id as string) ?? null
      lastSyncedAt = account.lastSyncedAt
    }

    let tokenValid = false
    let phoneValid = false
    const details: Record<string, unknown> = {}

    try {
      const r = await fetch(`${GRAPH_API_BASE}/me?access_token=${encodeURIComponent(accessToken!)}`)
      const j = await r.json() as any
      tokenValid     = !j.error
      details.fbName = j.name ?? null
    } catch { tokenValid = false }

    if (phoneNumId && tokenValid) {
      try {
        const r = await fetch(
          `${GRAPH_API_BASE}/${phoneNumId}?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(accessToken!)}`,
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
    if (!tokenValid)               warnings.push("Access token is invalid or expired — reconnect your account")
    if (tokenValid && !phoneValid) warnings.push("Phone number ID is unreachable — reconnect your account")
    if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) warnings.push("Webhook verify token not configured")

    return res.json({
      connected:         true,
      healthy:           tokenValid && phoneValid,
      tokenValid,
      phoneValid,
      webhookConfigured: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      warnings,
      details,
      webhookUrl:        `${getApiBaseUrl()}/api/whatsapp/webhook`,
      verifyToken:       process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null,
    })
  } catch (err: any) {
    logger.error({ err }, "Error in /whatsapp/health")
    return res.status(500).json({ error: err?.message ?? "Health check failed" })
  }
})

// ─── POST /api/whatsapp/templates/sync ────────────────────

router.post("/whatsapp/templates/sync", requireAuth, async (req: any, res) => {
  try {
    let accountRecord: any = null

    // Try new multi-inbox table
    const orgRow = await db.execute(sql`
      SELECT o.id FROM organizations o
      WHERE o.owner_id = ${req.userId}
         OR o.id = (SELECT organization_id FROM users WHERE id = ${req.userId})
      LIMIT 1
    `)

    if (orgRow.rows.length) {
      const orgId = (orgRow.rows[0] as any).id
      const waAccts = await db.select().from(whatsappAccounts)
        .where(and(eq(whatsappAccounts.organizationId, orgId), eq(whatsappAccounts.status, "active")))
        .limit(1)
      if (waAccts[0]) accountRecord = { ...waAccts[0], source: "multi" }
    }

    if (!accountRecord) {
      const accounts = await db
        .select({ id: connectedAccounts.id, accessToken: connectedAccounts.accessToken, metadata: connectedAccounts.metadata })
        .from(connectedAccounts)
        .where(and(eq(connectedAccounts.userId, req.userId), eq(connectedAccounts.provider, "whatsapp")))
        .limit(1)
      if (accounts[0]) accountRecord = { ...accounts[0], source: "legacy" }
    }

    if (!accountRecord) return res.status(400).json({ error: "No WhatsApp account connected" })

    const meta   = parseMetadata(accountRecord.metadata ?? accountRecord.accessToken)
    const token  = accountRecord.accessToken as string
    const wabaId = accountRecord.wabaId ?? (meta?.waba_id as string) ?? null

    if (!wabaId) return res.status(400).json({ error: "No WABA ID found — reconnect your account" })

    const templatesRes  = await fetch(
      `${GRAPH_API_BASE}/${wabaId}/message_templates?fields=id,name,language,category,status&limit=100&access_token=${encodeURIComponent(token)}`,
    )
    const templatesJson = await templatesRes.json() as any
    if (templatesJson.error) throw new Error(templatesJson.error.message ?? "Failed to fetch templates")

    const templates = (templatesJson.data ?? []).map((t: any) => ({
      id: t.id, name: t.name, language: t.language, category: t.category, status: t.status,
    }))

    const syncedAt = new Date().toISOString()

    if (accountRecord.source === "multi") {
      const updatedMeta = { ...parseMetadata(accountRecord.metadata), templates, templates_synced_at: syncedAt }
      await db.update(whatsappAccounts)
        .set({ metadata: JSON.stringify(updatedMeta), lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappAccounts.id, accountRecord.id))
    } else {
      const updatedMeta = { ...meta, templates, templates_synced_at: syncedAt }
      await db.update(connectedAccounts)
        .set({ metadata: updatedMeta, lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(connectedAccounts.id, accountRecord.id))
    }

    logger.info({ count: templates.length }, "Templates synced")
    return res.json({ synced: templates.length, templates })
  } catch (err: any) {
    logger.error({ err }, "POST /whatsapp/templates/sync error")
    return res.status(500).json({ error: err?.message ?? "Template sync failed" })
  }
})

// ─── DELETE /api/whatsapp/disconnect ─────────────────────
// Legacy single-account disconnect

router.delete("/whatsapp/disconnect", requireAuth, async (req: any, res) => {
  try {
    await db
      .delete(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, req.userId),
        eq(connectedAccounts.provider, "whatsapp"),
      ))

    return res.status(204).send()
  } catch (err: any) {
    logger.error({ err }, "Error in /whatsapp/disconnect")
    return res.status(500).json({ error: err?.message ?? "Disconnect failed" })
  }
})

export default router

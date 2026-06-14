/**
 * Facebook Lead Ads Real-time Webhook Service
 *
 * Processes leadgen events received from the Facebook webhook,
 * fetches lead details from the Meta Graph API, and creates CRM leads.
 * Reuses mapMetaLeadToRow() and existing insertion logic from metaLeadSync.ts.
 */

import { db, leadsTable } from "@workspace/db"
import { eq } from "drizzle-orm"
import { supabaseAdmin } from "../lib/supabase"
import { logger } from "../lib/logger"
import { createNotification } from "./notificationService"

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0"

// Re-export types needed by callers
interface MetaLeadFieldData { name: string; values: string[] }
interface MetaLead {
  id: string
  created_time: string
  field_data: MetaLeadFieldData[]
  campaign_name?: string
  adset_name?: string
  ad_name?: string
  ad_id?: string
}

// ─── Inline field extraction ──────────────────────────────────────────────────
// (duplicated from metaLeadSync so this service is self-contained)

function extractField(fieldData: MetaLeadFieldData[], ...keys: string[]): string {
  for (const key of keys) {
    const field = fieldData.find((f) => f.name === key)
    if (field?.values?.[0]) return field.values[0]
  }
  return ""
}

function mapMetaLeadToRow(metaLead: MetaLead, provider: "facebook" | "instagram") {
  const fd = metaLead.field_data ?? []
  const firstName = extractField(fd, "first_name")
  const lastName  = extractField(fd, "last_name")
  const fullName  =
    extractField(fd, "full_name", "name") ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Unknown"
  const email    = extractField(fd, "email", "email_address") || `lead-${metaLead.id}@meta-noreply.invalid`
  const phone    = extractField(fd, "phone_number", "phone", "mobile")
  const budget   = extractField(fd, "budget", "price_range", "price")
  const property = extractField(fd, "property_type", "property", "property_interest")
  const label    = provider === "facebook" ? "Facebook Lead Ad" : "Instagram Lead Ad"

  return {
    name:         fullName,
    email,
    phone,
    source:       provider,
    campaign:     metaLead.campaign_name ?? null,
    adSetName:    metaLead.adset_name    ?? null,
    adSource:     metaLead.ad_name       ?? null,
    adCreativeId: metaLead.ad_id         ?? null,
    budget,
    property,
    externalId:   metaLead.id,
    status:       "new"  as const,
    priority:     "warm" as const,
    tags:         [label, "webhook"],
    timeline:     [
      {
        id:    `meta-${metaLead.id}`,
        title: `Lead received via ${label} webhook`,
        time:  new Date(metaLead.created_time).toLocaleString(),
      },
    ],
  }
}

// ─── fetchMetaLeadDetails ─────────────────────────────────────────────────────

/**
 * Fetch full lead details from Meta Graph API using a leadgen_id.
 * Requires a valid user or page access token.
 */
export async function fetchMetaLeadDetails(
  leadgenId: string,
  accessToken: string
): Promise<MetaLead | null> {
  const fields = "id,created_time,field_data,campaign_name,adset_name,ad_name,ad_id"
  const url    = `${GRAPH_API_BASE}/${leadgenId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`

  try {
    const res  = await fetch(url)
    const json = (await res.json()) as MetaLead & { error?: { message: string; code: number } }

    if (!res.ok || (json as any).error) {
      logger.warn(
        { leadgenId, status: res.status, error: (json as any).error },
        "Facebook webhook: failed to fetch lead details from Graph API"
      )
      return null
    }

    return json
  } catch (err) {
    logger.warn({ err, leadgenId }, "Facebook webhook: network error fetching lead details")
    return null
  }
}

// ─── findAccountByPageId ──────────────────────────────────────────────────────

interface ConnectedAccountRow {
  id: string
  user_id: string
  provider: string
  access_token: string
  metadata: Record<string, unknown> | null
}

async function findAccountByPageId(pageId: string): Promise<ConnectedAccountRow | null> {
  // Search across metadata fields that may hold the page ID
  const { data, error } = await supabaseAdmin
    .from("connected_accounts")
    .select("id, user_id, provider, access_token, metadata")
    .in("provider", ["facebook", "instagram"])
    .eq("status", "active")

  if (error || !data?.length) {
    logger.debug({ pageId, error }, "Facebook webhook: no active FB/IG accounts found")
    return null
  }

  // Match by page_id stored in metadata (supports both selected_page_id and page_id keys)
  const match = (data as ConnectedAccountRow[]).find((acct) => {
    const meta = acct.metadata ?? {}
    return (
      meta.selected_page_id === pageId ||
      meta.page_id          === pageId
    )
  })

  if (!match) {
    // Fallback: if only one account exists, use it (common single-page setup)
    if (data.length === 1) {
      logger.debug({ pageId }, "Facebook webhook: no exact page_id match — using the only active account")
      return data[0] as ConnectedAccountRow
    }
    logger.warn({ pageId, accountCount: data.length }, "Facebook webhook: cannot map page_id to a connected account")
    return null
  }

  return match
}

// ─── processLeadGenWebhook ────────────────────────────────────────────────────

/**
 * Main webhook handler: given a leadgen_id and page_id, finds the correct
 * organization, fetches lead details, deduplicates, maps and inserts the lead.
 *
 * Returns 'created' | 'duplicate' | 'error'.
 */
export async function processLeadGenWebhook(
  leadgenId: string,
  pageId: string
): Promise<"created" | "duplicate" | "error"> {
  logger.info({ leadgenId, pageId }, "Facebook webhook: processing leadgen event")

  // 1. Find connected account by page_id
  const account = await findAccountByPageId(pageId)
  if (!account) {
    logger.error({ leadgenId, pageId }, "Facebook webhook: no connected account found for page")
    await createAuditLog("webhook_error", leadgenId, null, { reason: "no_account_for_page", pageId })
    return "error"
  }

  await createAuditLog("webhook_received", leadgenId, account.user_id, { pageId })

  // 2. Duplicate check by externalId
  const existing = await db
    .select({ id: leadsTable.id })
    .from(leadsTable)
    .where(eq(leadsTable.externalId, leadgenId))
    .limit(1)

  if (existing.length > 0) {
    logger.debug({ leadgenId }, "Facebook webhook: duplicate lead, skipping")
    return "duplicate"
  }

  // 3. Fetch lead details from Meta Graph API
  const metaLead = await fetchMetaLeadDetails(leadgenId, account.access_token)
  if (!metaLead) {
    logger.error({ leadgenId }, "Facebook webhook: failed to retrieve lead from Graph API")
    await createAuditLog("webhook_error", leadgenId, account.user_id, { reason: "graph_api_failure" })
    return "error"
  }

  await createAuditLog("lead_retrieved", leadgenId, account.user_id, {
    name: metaLead.field_data?.find(f => f.name === "full_name" || f.name === "name")?.values?.[0] ?? "unknown",
  })

  // 4. Map to CRM lead row (reuse existing mapping logic)
  const provider = account.provider as "facebook" | "instagram"
  const row      = mapMetaLeadToRow(metaLead, provider)

  // 5. Insert lead with user association for data isolation
  let insertedId: number | undefined
  try {
    const [inserted] = await db
      .insert(leadsTable)
      .values({
        ...row,
        createdById: account.user_id,
      })
      .returning({ id: leadsTable.id })

    insertedId = inserted?.id
    logger.info(
      { leadgenId, provider, userId: account.user_id, leadId: insertedId },
      "Facebook webhook: lead created successfully"
    )
  } catch (err) {
    logger.error({ err, leadgenId }, "Facebook webhook: failed to insert lead")
    await createAuditLog("webhook_error", leadgenId, account.user_id, { reason: "db_insert_failure" })
    return "error"
  }

  await createAuditLog("lead_created", leadgenId, account.user_id, {
    leadId: insertedId,
    name:   row.name,
    phone:  row.phone,
    campaign: row.campaign,
  })

  // 6. In-app notification for the account owner
  try {
    await createNotification({
      userId:  account.user_id,
      type:    "lead",
      title:   "New Lead via Facebook",
      body: `${row.name}${row.phone ? ` · ${row.phone}` : ""}${row.campaign ? ` · ${row.campaign}` : ""}`,
    })
  } catch (err) {
    logger.warn({ err }, "Facebook webhook: failed to create notification (non-fatal)")
  }

  return "created"
}

// ─── Audit logging ────────────────────────────────────────────────────────────

async function createAuditLog(
  action: string,
  leadgenId: string,
  userId: string | null,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action:      `facebook_webhook.${action}`,
      entity_type: "lead",
      entity_id:   leadgenId,
      user_id:     userId,
      metadata:    { leadgenId, ...meta },
      created_at:  new Date().toISOString(),
    })
  } catch {
    // Audit log failures are non-fatal
  }
}

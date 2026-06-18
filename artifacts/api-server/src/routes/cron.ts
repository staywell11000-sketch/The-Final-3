import { Router, type Request, type Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { db, leadsTable, activities, deals } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sql } from "drizzle-orm";

const router = Router();

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";
const LOOKBACK_MINUTES = 15;

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface ConnectedAccount {
  user_id: string;
  access_token: string;
  metadata: Record<string, string> | null;
}

interface MetaLeadFieldData {
  name: string;
  values: string[];
}

interface MetaLead {
  id: string;
  created_time: string;
  field_data: MetaLeadFieldData[];
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  ad_id?: string;
}

interface MetaConnectedAccount {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  metadata: Record<string, string> | null;
}

function extractField(fieldData: MetaLeadFieldData[], ...keys: string[]): string {
  for (const key of keys) {
    const field = fieldData.find((f) => f.name === key);
    if (field?.values?.[0]) return field.values[0];
  }
  return "";
}

function mapMetaLeadToRow(metaLead: MetaLead, provider: "facebook" | "instagram") {
  const fd = metaLead.field_data ?? [];

  const firstName = extractField(fd, "first_name");
  const lastName = extractField(fd, "last_name");
  const fullName = extractField(fd, "full_name", "name") ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    "Unknown";

  const email = extractField(fd, "email", "email_address") ||
    `lead-${metaLead.id}@meta-noreply.invalid`;

  const phone = extractField(fd, "phone_number", "phone", "mobile");
  const budget = extractField(fd, "budget", "price_range", "price");
  const property = extractField(fd, "property_type", "property", "property_interest");

  const label = provider === "facebook" ? "Facebook Lead Ad" : "Instagram Lead Ad";

  return {
    name: fullName,
    email,
    phone,
    source: provider,
    campaign: metaLead.campaign_name ?? null,
    adSetName: metaLead.adset_name ?? null,
    adSource: metaLead.ad_name ?? null,
    adCreativeId: metaLead.ad_id ?? null,
    budget,
    property,
    externalId: metaLead.id,
    status: "new" as const,
    priority: "warm" as const,
    tags: [label],
    timeline: [
      {
        id: `meta-${metaLead.id}`,
        title: `Lead created from ${label}`,
        time: new Date(metaLead.created_time).toLocaleString(),
      },
    ],
  };
}

async function reconcileAccount(account: ConnectedAccount): Promise<void> {
  const phoneNumId = account.metadata?.phone_number_id;
  if (!phoneNumId) {
    logger.warn({ userId: account.user_id }, "WhatsApp reconciliation: no phone_number_id in metadata, skipping");
    return;
  }

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  let url: string | null =
    `${GRAPH_API_BASE}/${phoneNumId}/messages` +
    `?fields=id,from,timestamp,type,text` +
    `&since=${sinceUnix}` +
    `&limit=100`;

  let totalInserted = 0;
  let page = 0;
  const MAX_PAGES = 5;

  while (url && page < MAX_PAGES) {
    page++;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 400 || res.status === 403) {
        logger.debug({ phoneNumId, status: res.status, body: errBody }, "WhatsApp reconciliation: message listing not available");
      } else {
        logger.warn({ phoneNumId, status: res.status, body: errBody }, "WhatsApp reconciliation: failed to fetch messages");
      }
      return;
    }

    const json = (await res.json()) as {
      data?: WhatsAppMessage[];
      paging?: { next?: string };
      error?: { message: string; code: number };
    };

    if (json.error) {
      logger.warn({ phoneNumId, error: json.error }, "WhatsApp reconciliation: API returned error");
      return;
    }

    const messages = json.data ?? [];

    for (const msg of messages) {
      if (msg.type !== "text") continue;

      const wamid = msg.id;
      const content = msg.text?.body ?? "";
      const senderPhone = msg.from;

      if (!wamid || !senderPhone) continue;

      const msgTs = new Date(Number(msg.timestamp) * 1000);
      if (msgTs < since) continue;

      const { data: existing } = await supabaseAdmin
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", wamid)
        .maybeSingle();

      if (existing) continue;

      let contactId: string;

      const { data: existingContact } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("user_id", account.user_id)
        .eq("phone", senderPhone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: ce } = await supabaseAdmin
          .from("contacts")
          .insert({
            user_id: account.user_id,
            name: senderPhone,
            phone: senderPhone,
            avatar_initials: senderPhone.slice(-2).toUpperCase(),
          })
          .select("id")
          .single();

        if (ce || !newContact) {
          logger.error({ ce, senderPhone }, "WhatsApp reconciliation: failed to create contact");
          continue;
        }
        contactId = newContact.id;
      }

      let conversationId: string;

      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("user_id", account.user_id)
        .eq("contact_id", contactId)
        .eq("channel", "whatsapp")
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: ve } = await supabaseAdmin
          .from("conversations")
          .insert({
            user_id: account.user_id,
            contact_id: contactId,
            channel: "whatsapp",
            title: senderPhone,
            status: "active",
            last_message_at: msgTs.toISOString(),
            unread_count: 0,
          })
          .select("id")
          .single();

        if (ve || !newConv) {
          logger.error({ ve }, "WhatsApp reconciliation: failed to create conversation");
          continue;
        }
        conversationId = newConv.id;
      }

      const { error: me } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: account.user_id,
          content,
          type: "text",
          status: "delivered",
          direction: "inbound",
          whatsapp_message_id: wamid,
          created_at: msgTs.toISOString(),
        });

      if (me) {
        logger.error({ me, wamid }, "WhatsApp reconciliation: failed to insert message");
        continue;
      }

      await supabaseAdmin
        .from("conversations")
        .update({
          last_message: content,
          last_message_at: msgTs.toISOString(),
        })
        .eq("id", conversationId);

      await supabaseAdmin.rpc("increment_unread_count", { conv_id: conversationId });

      totalInserted++;
    }

    url = json.paging?.next ?? null;
  }

  if (totalInserted > 0) {
    logger.info({ phoneNumId, totalInserted }, "WhatsApp reconciliation: run complete");
  }
}

async function syncMetaLeadsForAccount(account: MetaConnectedAccount): Promise<number> {
  const adAccountId = account.metadata?.ad_account_id;
  if (!adAccountId) {
    logger.debug({ userId: account.user_id, provider: account.provider }, "Meta lead sync: no ad_account_id in metadata, skipping");
    return 0;
  }

  const provider = account.provider as "facebook" | "instagram";
  const fields = "id,created_time,field_data,campaign_name,adset_name,ad_name,ad_id";

  let url: string | null =
    `${GRAPH_API_BASE}/${adAccountId}/leads` +
    `?fields=${fields}&limit=100&access_token=${encodeURIComponent(account.access_token)}`;

  let totalInserted = 0;
  let page = 0;
  const MAX_PAGES = 10;

  while (url && page < MAX_PAGES) {
    page++;

    let json: { data?: MetaLead[]; paging?: { next?: string }; error?: { message: string; code: number } };

    try {
      const res = await fetch(url);
      json = (await res.json()) as typeof json;

      if (!res.ok || json.error) {
        logger.warn({ adAccountId, status: res.status, error: json.error }, "Meta lead sync: API error, stopping pagination");
        break;
      }
    } catch (err) {
      logger.warn({ err, adAccountId }, "Meta lead sync: network error fetching leads page");
      break;
    }

    const metaLeads = json.data ?? [];

    for (const metaLead of metaLeads) {
      const existing = await db
        .select({ id: leadsTable.id })
        .from(leadsTable)
        .where(eq(leadsTable.externalId, metaLead.id))
        .limit(1);

      if (existing.length > 0) continue;

      const row = mapMetaLeadToRow(metaLead, provider);

      try {
        await db.insert(leadsTable).values(row);
        totalInserted++;
        logger.info({ externalId: metaLead.id, provider }, "Meta lead sync: inserted new lead");
      } catch (err) {
        logger.error({ err, externalId: metaLead.id }, "Meta lead sync: failed to insert lead");
      }
    }

    url = json.paging?.next ?? null;
  }

  return totalInserted;
}

async function analyzeLeadNightly(lead: typeof leadsTable.$inferSelect): Promise<void> {
  const leadActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.leadId, lead.id))
    .orderBy(desc(activities.createdAt))
    .limit(5);

  const leadDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.leadId, lead.id))
    .limit(1);

  const recentActivities = leadActivities.map(
    (a) => `${a.type}: ${a.title}${a.outcome ? ` → ${a.outcome}` : ""}`
  );
  const dealInfo = leadDeals[0]
    ? `Stage: ${leadDeals[0].stage}, Value: $${leadDeals[0].value ?? "TBD"}`
    : null;

  const prompt = `You are an AI assistant for a luxury real estate CRM. Analyze this lead and return JSON.
Lead: ${lead.name} | Status: ${lead.status} | Budget: ${lead.budget || "N/A"} | Priority: ${lead.priority}
Last Contact: ${lead.lastContact || "Unknown"}
Activities: ${recentActivities.length > 0 ? recentActivities.join("; ") : "None"}
Deal: ${dealInfo || "None"}
Return ONLY JSON: {"score":<0-100>,"urgencyScore":<0-100>,"aiSummary":"<2-3 sentences>","suggestedActions":["<action1>","<action2>","<action3>"]}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const analysis = JSON.parse(content) as {
    score: number;
    urgencyScore: number;
    aiSummary: string;
    suggestedActions: string[];
  };

  await db
    .update(leadsTable)
    .set({
      score: analysis.score,
      urgencyScore: analysis.urgencyScore,
      aiSummary: analysis.aiSummary,
      suggestedActions: analysis.suggestedActions,
      updatedAt: new Date(),
    })
    .where(eq(leadsTable.id, lead.id));
}

router.get("/whatsapp-reconciliation", async (_req: Request, res: Response) => {
  try {
    logger.debug("WhatsApp reconciliation: starting run");

    const { data: accounts, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("user_id, access_token, metadata")
      .eq("provider", "whatsapp")
      .eq("status", "active");

    if (error) {
      logger.error({ error }, "WhatsApp reconciliation: failed to fetch connected accounts");
      return res.status(500).json({ error: "Failed to fetch accounts" });
    }

    if (!accounts || accounts.length === 0) {
      logger.debug("WhatsApp reconciliation: no active WhatsApp accounts, skipping");
      return res.status(200).json({ message: "No active WhatsApp accounts" });
    }

    logger.debug({ count: accounts.length }, "WhatsApp reconciliation: processing accounts");

    await Promise.allSettled(
      (accounts as ConnectedAccount[]).map((acct) =>
        reconcileAccount(acct).catch((err) =>
          logger.error({ err, userId: acct.user_id }, "WhatsApp reconciliation: uncaught error for account")
        )
      )
    );

    res.status(200).json({ message: "WhatsApp reconciliation completed" });
  } catch (err) {
    logger.error({ err }, "WhatsApp reconciliation failed");
    res.status(500).json({ error: "Reconciliation failed" });
  }
});

router.get("/meta-lead-sync", async (_req: Request, res: Response) => {
  try {
    logger.debug("Meta lead sync: starting run");

    const { data: accounts, error } = await supabaseAdmin
      .from("connected_accounts")
      .select("id, user_id, provider, access_token, metadata")
      .in("provider", ["facebook", "instagram"])
      .eq("status", "active");

    if (error) {
      logger.error({ error }, "Meta lead sync: failed to fetch connected accounts");
      return res.status(500).json({ error: "Failed to fetch accounts" });
    }

    if (!accounts || accounts.length === 0) {
      logger.debug("Meta lead sync: no active Meta accounts, skipping");
      return res.status(200).json({ message: "No active Meta accounts" });
    }

    logger.debug({ count: accounts.length }, "Meta lead sync: processing accounts");

    let leadsInserted = 0;

    const results = await Promise.allSettled(
      (accounts as MetaConnectedAccount[]).map((acct) =>
        syncMetaLeadsForAccount(acct).catch((err) => {
          logger.error({ err, userId: acct.user_id }, "Meta lead sync: uncaught error for account");
          return 0;
        })
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") leadsInserted += result.value;
    }

    if (leadsInserted > 0) {
      logger.info({ leadsInserted }, "Meta lead sync: run complete");
    }

    res.status(200).json({ message: "Meta lead sync completed", leadsInserted });
  } catch (err) {
    logger.error({ err }, "Meta lead sync failed");
    res.status(500).json({ error: "Meta lead sync failed" });
  }
});

router.get("/nightly-ai-analysis", async (_req: Request, res: Response) => {
  try {
    logger.info("Nightly AI analysis job started");

    const allLeads = await db
      .select()
      .from(leadsTable)
      .orderBy(desc(leadsTable.updatedAt))
      .limit(50);

    let success = 0;
    let failed = 0;

    for (const lead of allLeads) {
      try {
        await analyzeLeadNightly(lead);
        success++;
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        failed++;
        logger.error({ leadId: lead.id, err }, "Nightly analysis failed for lead");
      }
    }

    logger.info({ success, failed, total: allLeads.length }, "Nightly AI analysis job completed");
    res.status(200).json({ message: "Nightly AI analysis completed", success, failed });
  } catch (err) {
    logger.error({ err }, "Nightly AI analysis job failed");
    res.status(500).json({ error: "Nightly AI analysis failed" });
  }
});

router.get("/plan-expiry", async (_req: Request, res: Response) => {
  try {
    logger.info("plan-expiry: running nightly subscription expiry check");

    const result = await db.execute<{ id: string; name: string }>(sql`
      UPDATE organizations
      SET
        plan = 'free',
        subscription_status = 'expired',
        updated_at = NOW()
      WHERE
        subscription_status = 'active'
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
      RETURNING id, name
    `);

    if (result.rows.length > 0) {
      logger.info({ count: result.rows.length, orgs: result.rows.map((r: any) => r.name) }, "plan-expiry: downgraded expired subscriptions to free");
    }

    res.status(200).json({ message: "Plan expiry check completed", expired: result.rows.length });
  } catch (err) {
    logger.error({ err }, "plan-expiry: error checking subscriptions");
    res.status(500).json({ error: "Plan expiry check failed" });
  }
});

export default router;
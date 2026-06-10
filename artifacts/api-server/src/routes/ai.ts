import { Router, type IRouter } from "express";
import { db, leadsTable, activities, deals, messages, conversations, aiUsageLogs, properties } from "@workspace/db";
import { eq, desc, inArray, and, or, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAiCredits, consumeAiActions, AI_ACTION_COSTS, PLAN_AI_ACTIONS, getOrCreateUsageRow } from "../middlewares/requireAiCredits";
import { openai } from "../lib/openai";
import { fireTrigger } from "../services/automationEngine";
import { getModelForFeature, getModelConfig, updateModelConfig, CLASS_INFO, AVAILABLE_MODELS, FEATURE_CLASS_MAP } from "../lib/aiRouter";

const router: IRouter = Router();

const PRICE_INPUT_PER_TOKEN = 0.00000015;
const PRICE_OUTPUT_PER_TOKEN = 0.0000006;

async function logUsage(
  userId: string,
  orgId: number | undefined,
  operation: string,
  usage: { prompt_tokens: number; completion_tokens: number } | undefined | null,
  model = "gpt-4o-mini"
) {
  if (!usage) return;
  try {
    await db.insert(aiUsageLogs).values({
      userId,
      operation,
      model,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    });
    if (orgId) {
      const actionCost = AI_ACTION_COSTS[operation] ?? 1;
      const totalTokens = usage.prompt_tokens + usage.completion_tokens;
      const estimatedCost =
        usage.prompt_tokens * PRICE_INPUT_PER_TOKEN +
        usage.completion_tokens * PRICE_OUTPUT_PER_TOKEN;
      await consumeAiActions(orgId, userId, operation, actionCost, {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        model,
      });
    }
  } catch {}
}

type LeadAnalysis = {
  score: number;
  urgencyScore: number;
  aiSummary: string;
  suggestedActions: string[];
  signals: { label: string; score: number }[];
  smartReminder: string;
};

async function analyzeLeadWithAI(leadData: {
  lead: typeof leadsTable.$inferSelect;
  recentMessages: string[];
  recentActivities: string[];
  dealInfo: string | null;
  model?: string;
}): Promise<{ analysis: LeadAnalysis; usage: any }> {
  const { lead, recentMessages, recentActivities, dealInfo, model: requestedModel } = leadData;
  const model = requestedModel ?? await getModelForFeature("analyze-lead");

  const prompt = `You are an AI assistant for a luxury real estate CRM. Analyze this lead and return a JSON object.

Lead Data:
- Name: ${lead.name}
- Status: ${lead.status}
- Priority: ${lead.priority}
- Budget: ${lead.budget || "Not specified"}
- Property Interest: ${lead.property || "Not specified"}
- Source: ${lead.source || "Unknown"}
- Last Contact: ${lead.lastContact || "Unknown"}
- Notes: ${(lead.notes || []).slice(0, 3).join("; ") || "None"}
- Tags: ${(lead.tags || []).join(", ") || "None"}
- Created: ${lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "Unknown"}

Recent Messages (last 5):
${recentMessages.length > 0 ? recentMessages.join("\n") : "No messages"}

Recent Activities (last 5):
${recentActivities.length > 0 ? recentActivities.join("\n") : "No activities logged"}

Deal Info:
${dealInfo || "No active deal"}

Return ONLY a valid JSON object with these exact fields:
{
  "score": <integer 0-100>,
  "urgencyScore": <integer 0-100>,
  "aiSummary": <2-3 sentence summary>,
  "suggestedActions": <array of 3-4 specific action strings>,
  "signals": [
    {"label": "Budget fit", "score": <0-100>},
    {"label": "Engagement", "score": <0-100>},
    {"label": "Timeline", "score": <0-100>},
    {"label": "Intent", "score": <0-100>},
    {"label": "Readiness", "score": <0-100>}
  ],
  "smartReminder": <one sentence reminder>
}`;

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as LeadAnalysis;
  return { analysis: parsed, usage: response.usage };
}

const ownsLead = (userId: string) =>
  or(eq(leadsTable.createdById, userId), isNull(leadsTable.createdById));

router.post("/ai/analyze-lead/:id", requireAuth, requireAiCredits, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = (req as any).userId as string;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });

  try {
    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.id, id), ownsLead(userId)));
    if (!lead) return void res.status(404).json({ error: "Lead not found" });

    const leadActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.leadId, id))
      .orderBy(desc(activities.createdAt))
      .limit(5);

    const leadDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.leadId, id))
      .orderBy(desc(deals.createdAt))
      .limit(1);

    const leadConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, id))
      .limit(5);

    let recentMessages: string[] = [];
    if (leadConversations.length > 0) {
      const convIds = leadConversations.map((c) => c.id);
      const msgs = await db
        .select()
        .from(messages)
        .where(inArray(messages.conversationId, convIds))
        .orderBy(desc(messages.createdAt))
        .limit(5);
      recentMessages = msgs.map((m) => `[${(m.direction ?? "unknown").toUpperCase()}]: ${m.content}`);
    }

    const recentActivities = leadActivities.map(
      (a) => `${a.type}: ${a.title}${a.outcome ? ` → ${a.outcome}` : ""}`
    );
    const dealInfo = leadDeals[0]
      ? `Stage: ${leadDeals[0].stage}, Value: $${leadDeals[0].value ?? "TBD"}, Probability: ${leadDeals[0].probability ?? 0}%`
      : null;

    const { analysis, usage } = await analyzeLeadWithAI({ lead, recentMessages, recentActivities, dealInfo });
    await logUsage(userId, (req as any).orgId, "analyze-lead", usage);

    const [updated] = await db
      .update(leadsTable)
      .set({
        score: analysis.score,
        urgencyScore: analysis.urgencyScore,
        aiSummary: analysis.aiSummary,
        suggestedActions: analysis.suggestedActions,
        updatedAt: new Date(),
      })
      .where(and(eq(leadsTable.id, id), ownsLead(userId)))
      .returning();

    res.json({ ...analysis, lead: updated });

    if (updated) {
      fireTrigger({
        triggerType: "lead_score_updated",
        leadId: updated.id,
        lead: updated,
        previousScore: lead.score ?? undefined,
        newScore: analysis.score,
        newStatus: updated.status,
        userId,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("AI analyze lead error:", err);
    res.status(500).json({ error: "Failed to analyze lead" });
  }
});

router.post("/ai/analyze-all", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId as string;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const allLeads = await db
      .select()
      .from(leadsTable)
      .where(ownsLead(userId))
      .orderBy(desc(leadsTable.updatedAt))
      .limit(20);

    res.write(`data: ${JSON.stringify({ type: "start", total: allLeads.length })}\n\n`);

    for (let i = 0; i < allLeads.length; i++) {
      const lead = allLeads[i];
      try {
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

        const { analysis, usage } = await analyzeLeadWithAI({
          lead, recentMessages: [], recentActivities, dealInfo,
        });
        await logUsage(userId, (req as any).orgId, "analyze-all", usage);

        await db
          .update(leadsTable)
          .set({
            score: analysis.score,
            urgencyScore: analysis.urgencyScore,
            aiSummary: analysis.aiSummary,
            suggestedActions: analysis.suggestedActions,
            updatedAt: new Date(),
          })
          .where(and(eq(leadsTable.id, lead.id), ownsLead(userId)));

        res.write(`data: ${JSON.stringify({
          type: "progress",
          index: i + 1,
          total: allLeads.length,
          leadId: lead.id,
          leadName: lead.name,
          score: analysis.score,
          urgencyScore: analysis.urgencyScore,
        })}\n\n`);

        await new Promise((r) => setTimeout(r, 200));
      } catch {
        res.write(`data: ${JSON.stringify({ type: "error", leadId: lead.id, leadName: lead.name })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    console.error("AI analyze-all error:", err);
    res.write(`data: ${JSON.stringify({ type: "fatal", error: "Failed to analyze leads" })}\n\n`);
    res.end();
  }
});

router.post("/ai/sales-insights", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const allLeads = await db
      .select()
      .from(leadsTable)
      .where(ownsLead(userId))
      .orderBy(desc(leadsTable.updatedAt))
      .limit(50);

    const allDeals = await db
      .select()
      .from(deals)
      .where(or(eq(deals.createdById, userId), isNull(deals.createdById)))
      .orderBy(desc(deals.createdAt))
      .limit(20);

    const recentActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.createdAt))
      .limit(30);

    const statusCounts = allLeads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const avgScore = allLeads.length > 0
      ? Math.round(allLeads.reduce((s, l) => s + (l.score ?? 50), 0) / allLeads.length)
      : 0;

    const hotLeads = allLeads.filter((l) => (l.urgencyScore ?? 0) >= 70).length;
    const totalDealValue = allDeals.reduce((s, d) => s + parseFloat(d.value ?? "0"), 0);
    const activityTypes = recentActivities.reduce<Record<string, number>>((acc, act) => {
      acc[act.type] = (acc[act.type] ?? 0) + 1;
      return acc;
    }, {});

    const prompt = `You are a luxury real estate sales analyst. Analyze this CRM pipeline data and return JSON insights.

Pipeline Summary:
- Total Leads: ${allLeads.length}
- Average Lead Score: ${avgScore}/100
- Hot Leads (urgency ≥70): ${hotLeads}
- Lead Status Breakdown: ${JSON.stringify(statusCounts)}
- Active Deals: ${allDeals.length}
- Total Pipeline Value: $${totalDealValue.toLocaleString()}
- Recent Activity Types: ${JSON.stringify(activityTypes)}

Return ONLY a valid JSON object:
{
  "pipelineScore": <integer 0-100>,
  "revenueForecasted": <string like "$2.4M">,
  "hotLeadsCount": ${hotLeads},
  "inactivityAlerts": [<up to 3 alert strings>],
  "topInsights": [<4 insight strings>],
  "weeklyTrend": <"up"|"down"|"stable">,
  "weeklyTrendPercent": <number>,
  "conversionRate": <number>,
  "avgDealDays": <number>
}`;

    const model = await getModelForFeature("sales-insights");
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    await logUsage(userId, (req as any).orgId, "sales-insights", response.usage);

    const content = response.choices[0]?.message?.content ?? "{}";
    const insights = JSON.parse(content);

    res.json({ ...insights, totalLeads: allLeads.length, avgScore, hotLeadsCount: hotLeads, totalDealValue, statusCounts });
  } catch (err) {
    console.error("Sales insights error:", err);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

router.post("/ai/conversation-summary/:leadId", requireAuth, requireAiCredits, async (req, res) => {
  const leadId = parseInt(req.params.leadId as string, 10);
  const userId = (req as any).userId as string;
  if (isNaN(leadId)) return void res.status(400).json({ error: "Invalid lead ID" });

  try {
    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.id, leadId), ownsLead(userId)));
    if (!lead) return void res.status(404).json({ error: "Lead not found" });

    const leadActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.createdAt))
      .limit(10);

    const leadConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.leadId, leadId))
      .limit(10);

    const allMessages = leadConversations.length > 0
      ? await db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, leadConversations.map((c) => c.id)))
          .orderBy(desc(messages.createdAt))
          .limit(20)
      : [];

    const activityLog = leadActivities.map(
      (act) => `[${act.type.toUpperCase()}] ${act.title}${act.description ? `: ${act.description}` : ""}${act.outcome ? ` | Outcome: ${act.outcome}` : ""} (${new Date(act.createdAt).toLocaleDateString()})`
    );
    const msgLog = allMessages.map(
      (msg) => `[${(msg.direction ?? "unknown").toUpperCase()}]: ${msg.content} (${new Date(msg.createdAt).toLocaleDateString()})`
    );

    const prompt = `You are an AI CRM analyst for luxury real estate. Summarize all communications and activities for this lead.

Lead: ${lead.name} | Budget: ${lead.budget || "N/A"} | Status: ${lead.status} | Property: ${lead.property || "N/A"}

Activity Log:
${activityLog.length > 0 ? activityLog.join("\n") : "No activities logged yet"}

Message History:
${msgLog.length > 0 ? msgLog.join("\n") : "No messages yet"}

Return ONLY valid JSON:
{
  "summary": <3-4 sentence narrative>,
  "keyMoments": [<up to 4 significant interaction strings>],
  "sentiment": <"positive"|"neutral"|"negative"|"mixed">,
  "lastTouchpoint": <string>,
  "relationshipStrength": <integer 0-100>,
  "nextBestAction": <string>
}`;

    const model = await getModelForFeature("conversation-summary");
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    await logUsage(userId, (req as any).orgId, "conversation-summary", response.usage);
    res.json(JSON.parse(response.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    console.error("Conversation summary error:", err);
    res.status(500).json({ error: "Failed to generate conversation summary" });
  }
});

// ── AI Chat ───────────────────────────────────────────────────────────────────
router.post("/ai/chat", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId as string;
  const { messages: chatMessages } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!Array.isArray(chatMessages) || chatMessages.length === 0) {
    return void res.status(400).json({ error: "messages array required" });
  }

  try {
    const [userLeads, userDeals] = await Promise.all([
      db.select({
        name: leadsTable.name,
        status: leadsTable.status,
        score: leadsTable.score,
        urgencyScore: leadsTable.urgencyScore,
        budget: leadsTable.budget,
        priority: leadsTable.priority,
      })
        .from(leadsTable)
        .where(ownsLead(userId))
        .orderBy(desc(leadsTable.updatedAt))
        .limit(30),
      db.select({ title: deals.title, stage: deals.stage, value: deals.value })
        .from(deals)
        .where(or(eq(deals.createdById, userId), isNull(deals.createdById)))
        .limit(20),
    ]);

    const totalLeads = userLeads.length;
    const hotLeads = userLeads.filter((l) => (l.urgencyScore ?? 0) >= 70);
    const totalPipeline = userDeals.reduce((s, d) => s + parseFloat(d.value ?? "0"), 0);
    const avgScore = totalLeads > 0
      ? Math.round(userLeads.reduce((s, l) => s + (l.score ?? 50), 0) / totalLeads)
      : 0;
    const statusSummary = userLeads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const systemPrompt = `You are an expert real estate CRM assistant for a luxury property business. Help agents manage leads, understand their pipeline, and close more deals.

Current CRM snapshot:
- Total Leads: ${totalLeads}
- Hot Leads (urgency ≥70): ${hotLeads.length}${hotLeads.length > 0 ? ` — ${hotLeads.slice(0, 5).map((l) => l.name).join(", ")}` : ""}
- Average Lead Score: ${avgScore}/100
- Status Breakdown: ${JSON.stringify(statusSummary)}
- Active Deals: ${userDeals.length}
- Total Pipeline Value: $${totalPipeline.toLocaleString()}
- Top Leads: ${userLeads.slice(0, 5).map((l) => `${l.name} (score: ${l.score ?? 50})`).join(", ")}

Be concise and actionable. Answer in 2-4 sentences unless a detailed breakdown is requested.`;

    const chatModel = await getModelForFeature("chat");
    const response = await openai.chat.completions.create({
      model: chatModel,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages,
      ],
    });

    await logUsage(userId, (req as any).orgId, "chat", response.usage);

    const reply = response.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    res.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// ── AI Usage Stats ────────────────────────────────────────────────────────────
router.get("/ai/usage", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [byOperation, monthlyTotals, dailyUsage] = await Promise.all([
      db.execute<{ operation: string; calls: string; input_tokens: string; output_tokens: string }>(sql`
        SELECT operation,
               COUNT(*)::text AS calls,
               COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::text AS output_tokens
        FROM ai_usage_logs
        WHERE user_id = ${userId}
        GROUP BY operation
        ORDER BY calls DESC
      `),
      db.execute<{ calls: string; input_tokens: string; output_tokens: string }>(sql`
        SELECT COUNT(*)::text AS calls,
               COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::text AS output_tokens
        FROM ai_usage_logs
        WHERE user_id = ${userId}
          AND created_at >= ${thisMonthStart.toISOString()}
      `),
      db.execute<{ day: string; calls: string; input_tokens: string; output_tokens: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'Mon DD') AS day,
               COUNT(*)::text AS calls,
               COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
               COALESCE(SUM(output_tokens), 0)::text AS output_tokens
        FROM ai_usage_logs
        WHERE user_id = ${userId}
          AND created_at >= ${thirtyDaysAgo.toISOString()}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at) ASC
      `),
    ]);

    const monthly = monthlyTotals.rows[0] ?? { calls: "0", input_tokens: "0", output_tokens: "0" };
    const mIn = parseInt(monthly.input_tokens, 10);
    const mOut = parseInt(monthly.output_tokens, 10);
    const monthlyCostCents = Math.round((mIn * PRICE_INPUT_PER_TOKEN + mOut * PRICE_OUTPUT_PER_TOKEN) * 100);

    const allTimeInputTokens = byOperation.rows.reduce((s, r) => s + parseInt(r.input_tokens, 10), 0);
    const allTimeOutputTokens = byOperation.rows.reduce((s, r) => s + parseInt(r.output_tokens, 10), 0);
    const allTimeCalls = byOperation.rows.reduce((s, r) => s + parseInt(r.calls, 10), 0);
    const allTimeCostCents = Math.round(
      (allTimeInputTokens * PRICE_INPUT_PER_TOKEN + allTimeOutputTokens * PRICE_OUTPUT_PER_TOKEN) * 100
    );

    res.json({
      monthly: {
        calls: parseInt(monthly.calls, 10),
        inputTokens: mIn,
        outputTokens: mOut,
        totalTokens: mIn + mOut,
        estimatedCostUsd: monthlyCostCents / 100,
      },
      allTime: {
        calls: allTimeCalls,
        inputTokens: allTimeInputTokens,
        outputTokens: allTimeOutputTokens,
        totalTokens: allTimeInputTokens + allTimeOutputTokens,
        estimatedCostUsd: allTimeCostCents / 100,
      },
      byOperation: byOperation.rows.map((r) => {
        const inp = parseInt(r.input_tokens, 10);
        const out = parseInt(r.output_tokens, 10);
        const costCents = Math.round((inp * PRICE_INPUT_PER_TOKEN + out * PRICE_OUTPUT_PER_TOKEN) * 100);
        return {
          operation: r.operation,
          calls: parseInt(r.calls, 10),
          inputTokens: inp,
          outputTokens: out,
          totalTokens: inp + out,
          estimatedCostUsd: costCents / 100,
        };
      }),
      dailyUsage: dailyUsage.rows.map((r) => ({
        day: r.day,
        calls: parseInt(r.calls, 10),
        inputTokens: parseInt(r.input_tokens, 10),
        outputTokens: parseInt(r.output_tokens, 10),
      })),
    });
  } catch (err) {
    console.error("AI usage error:", err);
    res.status(500).json({ error: "Failed to fetch AI usage" });
  }
});

// ── GET /ai/credits — AI Actions balance for current user ─────────────────
router.get("/ai/credits", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userEmail = (req as any).userEmail as string | undefined;
  const SUPER_ADMIN_EMAIL = "murtazaarshad499@gmail.com";

  if (userEmail === SUPER_ADMIN_EMAIL) {
    return res.json({
      isSuperAdmin: true,
      planIncluded: 999999,
      used: 0,
      remainingPlan: 999999,
      bonusActions: 0,
      addonRemaining: 0,
      available: 999999,
    });
  }

  try {
    const isSuperAdminRow = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((isSuperAdminRow.rows[0] as any)?.role === "super_admin") {
      return res.json({
        isSuperAdmin: true,
        planIncluded: 999999,
        used: 0,
        remainingPlan: 999999,
        bonusActions: 0,
        addonRemaining: 0,
        available: 999999,
      });
    }

    const orgRow = await db.execute(sql`
      SELECT o.id, o.plan FROM organizations o
      WHERE o.owner_id = ${userId}
         OR o.id = (SELECT organization_id FROM users WHERE id = ${userId})
      LIMIT 1
    `);

    if (!orgRow.rows.length) {
      return res.json({ planIncluded: 0, used: 0, remainingPlan: 0, bonusActions: 0, addonRemaining: 0, available: 0 });
    }

    const org = orgRow.rows[0] as any;
    const usage = await getOrCreateUsageRow(org.id, org.plan);
    const actionsUsed   = Number(usage.actions_used  ?? 0);
    const actionsLimit  = Number(usage.actions_limit ?? 0);
    const bonusActions  = Number(usage.bonus_actions ?? 0);
    const remainingPlan = Math.max(0, actionsLimit - actionsUsed);
    const available     = remainingPlan + bonusActions;

    return res.json({
      isSuperAdmin: false,
      planIncluded: actionsLimit,
      used: actionsUsed,
      remainingPlan,
      bonusActions,
      addonRemaining: bonusActions,
      available,
      plan: org.plan,
      month: usage.month,
      year: usage.year,
    });
  } catch (err) {
    console.error("AI credits error:", err);
    return res.status(500).json({ error: "Failed to fetch AI Actions balance" });
  }
});

// ── POST /reply-suggestions ───────────────────────────────────────────────────
router.post("/reply-suggestions", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId;
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }

  try {
    // Fetch recent messages from the conversation
    const recentMessages = await db
      .select({
        content: messages.content,
        direction: messages.direction,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(15);

    if (recentMessages.length === 0) {
      return res.json({ suggestions: [
        "Thank you for reaching out! How can I help you today?",
        "Hello! I'd be happy to assist you. What are you looking for?",
        "Hi! Welcome. Please let me know your requirements and I'll get back to you shortly.",
      ]});
    }

    // Build conversation context (oldest first)
    const convoContext = [...recentMessages].reverse().map((m) => {
      const role = m.direction === "inbound" ? "Lead" : "Agent";
      return `${role}: ${m.content}`;
    }).join("\n");

    const replyModel = await getModelForFeature("reply-suggestions");
    const completion = await openai.chat.completions.create({
      model: replyModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert real estate agent assistant. Based on the WhatsApp conversation below, generate exactly 3 short, professional, and warm reply suggestions for the agent to send next. 
Each reply should be:
- Conversational and natural (WhatsApp style)
- 1-3 sentences maximum
- Relevant to the conversation context
- In the same language as the conversation

Return JSON: { "suggestions": ["reply1", "reply2", "reply3"] }`,
        },
        {
          role: "user",
          content: `WhatsApp conversation:\n${convoContext}\n\nGenerate 3 reply options for the agent to send next.`,
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    await logUsage(userId, (req as any).orgId, "reply-suggestions", completion.usage);

    return res.json({
      suggestions: parsed.suggestions ?? [
        "Thank you for your message. I'll get back to you shortly.",
        "Noted! I'll prepare some options for you.",
        "Thanks for reaching out. Let me check and respond soon.",
      ]
    });
  } catch (err) {
    console.error("Reply suggestions error:", err);
    return res.status(500).json({ error: "Failed to generate reply suggestions" });
  }
});

// ── POST /deal-insights ───────────────────────────────────────────────────────
router.post("/deal-insights", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const dealsData = await db.select().from(deals)
      .where(eq((deals as any).createdById, userId))
      .orderBy(desc((deals as any).updatedAt))
      .limit(20);

    if (dealsData.length === 0) {
      return res.json({ insights: { pipelineScore: 0, summary: "No deals found. Add deals to your pipeline to get AI insights.", riskItems: [], opportunities: [], followUpPriorities: [] } });
    }

    const dealsText = dealsData.map((d: any) =>
      `Deal: "${d.title || "Untitled"}" | Stage: ${d.stage || "unknown"} | Value: ${d.value || 0} | Created: ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "unknown"}`
    ).join("\n");

    const dealModel = await getModelForFeature("deal-insights");
    const completion = await openai.chat.completions.create({
      model: dealModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an AI sales analyst for a luxury real estate CRM. Analyze the deals and return JSON:
{
  "pipelineScore": number (0-100),
  "conversionProbability": string,
  "riskItems": [{"deal": string, "risk": string, "severity": "high"|"medium"|"low"}],
  "opportunities": [{"title": string, "description": string}],
  "followUpPriorities": [{"deal": string, "reason": string, "urgency": "urgent"|"soon"|"normal"}],
  "summary": string
}`,
        },
        { role: "user", content: `Analyze ${dealsData.length} deals:\n${dealsText}` },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    await logUsage(userId, (req as any).orgId, "deal-insights", completion.usage);
    return res.json({ insights: parsed });
  } catch (err) {
    console.error("Deal insights error:", err);
    return res.status(500).json({ error: "Failed to generate deal insights" });
  }
});

// ── POST /business-insights ───────────────────────────────────────────────────
router.post("/business-insights", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId;
  const period = (req.body?.period ?? "weekly") as "daily" | "weekly" | "monthly";

  const days = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [leadsData, dealsData, recentActivities] = await Promise.all([
      db.select().from(leadsTable).where(eq(leadsTable.createdById, userId)).limit(100),
      db.select().from(deals).where(eq((deals as any).createdById, userId)).limit(50),
      db.select().from(activities).where(eq(activities.createdById, userId)).orderBy(desc(activities.createdAt)).limit(30),
    ]);

    const recentLeads = leadsData.filter(l => l.createdAt && new Date(l.createdAt) >= since);
    const closedDeals = dealsData.filter((d: any) => d.stage === "closed_won" && d.updatedAt && new Date(d.updatedAt) >= since);
    const wonValue = closedDeals.reduce((sum: number, d: any) => sum + Number(d.value || 0), 0);

    const summary = `Period: ${period} (${days} day${days !== 1 ? "s" : ""})
Total Leads: ${leadsData.length} | New Leads: ${recentLeads.length}
Total Deals: ${dealsData.length} | Closed Won: ${closedDeals.length} | Won Value: ${wonValue}
Recent Activities: ${recentActivities.length}
Lead Sources: ${Array.from(new Set(leadsData.map((l: any) => l.source).filter(Boolean))).join(", ") || "unknown"}`;

    const bizModel = await getModelForFeature("business-insights");
    const completion = await openai.chat.completions.create({
      model: bizModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a business intelligence analyst for a luxury real estate CRM. Generate a business summary as JSON:
{
  "leadsReceived": number,
  "dealsClosed": number,
  "wonRevenue": string,
  "conversionRate": string,
  "topAgent": string,
  "topSource": string,
  "keyInsights": [string, string, string],
  "conversionTrend": "up"|"down"|"stable",
  "summary": string (2-3 sentences)
}`,
        },
        { role: "user", content: summary },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    await logUsage(userId, (req as any).orgId, "business-insights", completion.usage);
    return res.json({ insights: parsed, period });
  } catch (err) {
    console.error("Business insights error:", err);
    return res.status(500).json({ error: "Failed to generate business insights" });
  }
});

// ── POST /risk-detection ──────────────────────────────────────────────────────
router.post("/risk-detection", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const [leadsData, dealsData] = await Promise.all([
      db.select().from(leadsTable).where(eq(leadsTable.createdById, userId)).orderBy(desc(leadsTable.updatedAt)).limit(50),
      db.select().from(deals).where(eq((deals as any).createdById, userId)).limit(30),
    ]);

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    const uncontacted = leadsData.filter((l: any) => !l.lastContact && l.status !== "closed").map((l: any) => l.name);
    const coldLeads = leadsData.filter((l: any) => l.lastContact && (now - new Date(l.lastContact).getTime()) > sevenDays && l.status !== "closed").map((l: any) => l.name);
    const stalledDeals = dealsData.filter((d: any) => d.updatedAt && (now - new Date(d.updatedAt).getTime()) > sevenDays && d.stage !== "closed_won" && d.stage !== "closed_lost").map((d: any) => d.title || "Untitled Deal");

    const context = `Total leads: ${leadsData.length}
Uncontacted leads: ${uncontacted.length} — ${uncontacted.slice(0, 5).join(", ")}
Cold leads (7+ days no contact): ${coldLeads.length} — ${coldLeads.slice(0, 5).join(", ")}
Stalled deals (7+ days no update): ${stalledDeals.length} — ${stalledDeals.slice(0, 5).join(", ")}`;

    const riskModel = await getModelForFeature("risk-detection");
    const completion = await openai.chat.completions.create({
      model: riskModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a risk analyst for a real estate CRM. Identify risks and return JSON:
{
  "uncontactedLeads": [string],
  "coldLeads": [string],
  "stalledDeals": [string],
  "missedOpportunities": [string],
  "riskScore": number (0-100, 100=highest risk),
  "summary": string
}`,
        },
        { role: "user", content: context },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    parsed.uncontactedLeads = parsed.uncontactedLeads ?? uncontacted;
    parsed.coldLeads = parsed.coldLeads ?? coldLeads;
    parsed.stalledDeals = parsed.stalledDeals ?? stalledDeals;
    await logUsage(userId, (req as any).orgId, "risk-detection", completion.usage);
    return res.json({ risks: parsed });
  } catch (err) {
    console.error("Risk detection error:", err);
    return res.status(500).json({ error: "Failed to run risk detection" });
  }
});

// ── POST /property-matching/:leadId ───────────────────────────────────────────
router.post("/property-matching/:leadId", requireAuth, requireAiCredits, async (req, res) => {
  const userId = (req as any).userId;
  const leadId = Number(req.params.leadId);
  try {
    const [leadRows, propertyRows] = await Promise.all([
      db.select().from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.createdById, userId))).limit(1),
      db.select().from(properties).where(eq((properties as any).listedById, userId)).limit(30),
    ]);

    if (!leadRows.length) return res.status(404).json({ error: "Lead not found" });
    const lead = leadRows[0] as any;

    if (!propertyRows.length) return res.json({ matches: [], message: "No properties in portfolio to match against." });

    const leadContext = `Lead: ${lead.name} | Budget: ${lead.budget || "unknown"} | Interest: ${lead.property || "any"} | Notes: ${(lead.notes || []).slice(0, 2).join("; ")}`;
    const propertiesContext = propertyRows.map((p: any, i: number) =>
      `${i + 1}. ID:${p.id} | ${p.title || "Untitled"} | Type: ${p.type || "unknown"} | Price: ${p.price || 0} | Area: ${p.area || "unknown"} | Size: ${p.size || "unknown"}`
    ).join("\n");

    const matchModel = await getModelForFeature("property-matching");
    const completion = await openai.chat.completions.create({
      model: matchModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an AI property matching engine for a real estate CRM. Match the lead to properties and return JSON:
{
  "matches": [{"propertyId": number, "matchScore": number (0-100), "reason": string}],
  "summary": string
}
Rank by match score descending. Return top 5 matches max.`,
        },
        { role: "user", content: `${leadContext}\n\nAvailable properties:\n${propertiesContext}` },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
    await logUsage(userId, (req as any).orgId, "property-matching", completion.usage);
    return res.json({ matches: parsed.matches ?? [], summary: parsed.summary });
  } catch (err) {
    console.error("Property matching error:", err);
    return res.status(500).json({ error: "Failed to run property matching" });
  }
});

// ── Admin: GET model config ───────────────────────────────────────────────
router.get("/admin/ai-model-config", requireAuth, async (req, res) => {
  const userEmail = (req as any).userEmail;
  const userId = (req as any).userId;
  if (userEmail !== "murtazaarshad499@gmail.com") {
    const row = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((row.rows[0] as any)?.role !== "super_admin") return void res.status(403).json({ error: "Forbidden" });
  }
  try {
    const config = await getModelConfig();
    return res.json({ ...config, availableModels: AVAILABLE_MODELS, classInfo: CLASS_INFO });
  } catch {
    return res.status(500).json({ error: "Failed to fetch model config" });
  }
});

// ── Admin: PUT model config ───────────────────────────────────────────────
router.put("/admin/ai-model-config", requireAuth, async (req, res) => {
  const userEmail = (req as any).userEmail;
  const userId = (req as any).userId;
  if (userEmail !== "murtazaarshad499@gmail.com") {
    const row = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((row.rows[0] as any)?.role !== "super_admin") return void res.status(403).json({ error: "Forbidden" });
  }
  try {
    const { A, B, C } = req.body as { A?: string; B?: string; C?: string };
    await updateModelConfig({ A, B, C });
    const updated = await getModelConfig();
    return res.json({ success: true, config: updated });
  } catch {
    return res.status(500).json({ error: "Failed to update model config" });
  }
});

// ── Admin: GET observability stats ───────────────────────────────────────
router.get("/admin/ai-observability", requireAuth, async (req, res) => {
  const userEmail = (req as any).userEmail;
  const userId = (req as any).userId;
  if (userEmail !== "murtazaarshad499@gmail.com") {
    const row = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((row.rows[0] as any)?.role !== "super_admin") return void res.status(403).json({ error: "Forbidden" });
  }
  try {
    const stats = await db.execute(sql`
      SELECT feature_class,
             COUNT(*) as calls,
             ROUND(AVG(response_time_ms)) as avg_response_ms,
             SUM(CASE WHEN was_fallback THEN 1 ELSE 0 END) as fallback_count
      FROM ai_observability_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY feature_class
      ORDER BY feature_class
    `).catch(() => ({ rows: [] }));
    return res.json({ stats: stats.rows });
  } catch {
    return res.json({ stats: [] });
  }
});

// ── GET /admin/ai-stats — super admin AI usage overview ───────────────────
router.get("/admin/ai-stats", requireAuth, async (req, res) => {
  const userEmail = (req as any).userEmail;
  if (userEmail !== "murtazaarshad499@gmail.com") {
    const userId = (req as any).userId;
    const roleRow = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((roleRow.rows[0] as any)?.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [totals, byOrg, actionsThisMonth, topFeatures, boosterRevenue] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) as total_requests, COALESCE(SUM(tokens_used),0) as total_tokens
        FROM ai_usage
      `),
      db.execute(sql`
        SELECT oau.organization_id, o.name as org_name, o.plan,
               oau.tokens_used, oau.requests_made
        FROM organization_ai_usage oau
        LEFT JOIN organizations o ON o.id = oau.organization_id
        WHERE oau.month = ${month} AND oau.year = ${year}
        ORDER BY oau.tokens_used DESC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(tokens_used),0) as total_tokens_used,
               COALESCE(SUM(requests_made),0) as total_requests_made,
               COUNT(DISTINCT organization_id) as active_orgs
        FROM organization_ai_usage
        WHERE month = ${month} AND year = ${year}
      `),
      db.execute(sql`
        SELECT operation as feature, COUNT(*) as calls
        FROM ai_usage
        WHERE created_at >= DATE_TRUNC('month', NOW())
        GROUP BY operation ORDER BY calls DESC LIMIT 10
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0) as total_revenue, COUNT(*) as total_sales
        FROM payment_requests
        WHERE plan LIKE 'ai_booster_%' AND status = 'approved'
      `),
    ]);

    const t = totals.rows[0] as any;
    const am = actionsThisMonth.rows[0] as any;
    const br = boosterRevenue.rows[0] as any;

    return res.json({
      total_requests: Number(t.total_requests),
      total_tokens: Number(t.total_tokens),
      total_cost_usd: 0,
      this_month: {
        actions_used: Number(am.total_tokens_used),
        bonus_remaining: 0,
        active_orgs: Number(am.active_orgs),
      },
      booster_revenue: {
        total_pkr: Number(br.total_revenue),
        total_sales: Number(br.total_sales),
      },
      top_orgs_by_usage: byOrg.rows,
      top_features: topFeatures.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

// ── GET /admin/ai-usage-log — recent AI calls ─────────────────────────────
router.get("/admin/ai-usage-log", requireAuth, async (req, res) => {
  const userEmail = (req as any).userEmail;
  const userId = (req as any).userId;
  if (userEmail !== "murtazaarshad499@gmail.com") {
    const roleRow = await db.execute(sql`SELECT role FROM users WHERE id = ${userId}`);
    if ((roleRow.rows[0] as any)?.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  try {
    const rows = await db.execute(sql`
      SELECT au.*, o.name as org_name
      FROM ai_usage au
      LEFT JOIN organizations o ON o.id = au.organization_id
      ORDER BY au.created_at DESC
      LIMIT 100
    `);
    return res.json({ data: rows.rows });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

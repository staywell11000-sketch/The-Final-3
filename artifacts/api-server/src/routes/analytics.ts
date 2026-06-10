import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Safe query helper — wraps each DB query so a single failure returns null
// instead of crashing the entire analytics endpoint.
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err, label }, `analytics: query failed, using fallback`);
    return fallback;
  }
}

router.get("/analytics/overview", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  logger.info({ userId }, "analytics/overview: start");

  // ── Lead totals ──────────────────────────────────────────────────────────
  const leadStats = await safeQuery(
    "lead-totals",
    async () => {
      const r = await db.execute<{ total: string; won: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'won')::text AS won
        FROM leads
        WHERE created_by_id = ${userId}
      `);
      return r.rows[0] ?? null;
    },
    null
  );
  const totalLeads = parseInt(leadStats?.total ?? "0", 10);
  const wonLeads = parseInt(leadStats?.won ?? "0", 10);
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0;

  // ── Source breakdown ─────────────────────────────────────────────────────
  const sourceRows = await safeQuery(
    "source-breakdown",
    async () => {
      const r = await db.execute<{ source: string; count: string }>(sql`
        SELECT COALESCE(source, 'Unknown') AS source, COUNT(*)::text AS count
        FROM leads
        WHERE created_by_id = ${userId}
        GROUP BY source
        ORDER BY count DESC
      `);
      return r.rows;
    },
    []
  );

  // ── Agent performance ────────────────────────────────────────────────────
  const agentRows = await safeQuery(
    "agent-performance",
    async () => {
      const r = await db.execute<{
        agent: string; leads: string; won: string; avg_score: string;
      }>(sql`
        SELECT
          COALESCE(assigned_to, 'Unassigned') AS agent,
          COUNT(*)::text AS leads,
          COUNT(*) FILTER (WHERE status = 'won')::text AS won,
          ROUND(AVG(score))::text AS avg_score
        FROM leads
        WHERE created_by_id = ${userId}
          AND assigned_to IS NOT NULL AND assigned_to != ''
        GROUP BY assigned_to
        ORDER BY won DESC, leads DESC
        LIMIT 10
      `);
      return r.rows;
    },
    []
  );

  // ── Deal stage breakdown ─────────────────────────────────────────────────
  const dealStageRows = await safeQuery(
    "deal-stages",
    async () => {
      const r = await db.execute<{ stage: string; count: string; total_value: string }>(sql`
        SELECT stage, COUNT(*)::text AS count,
               COALESCE(SUM(value), 0)::text AS total_value
        FROM deals
        WHERE created_by_id = ${userId}
        GROUP BY stage
        ORDER BY count DESC
      `);
      return r.rows;
    },
    []
  );

  // ── Deal totals ──────────────────────────────────────────────────────────
  const dealTotals = await safeQuery(
    "deal-totals",
    async () => {
      const r = await db.execute<{
        total_deals: string; active_deals: string; closed_deals: string;
        total_pipeline: string; won_value: string;
      }>(sql`
        SELECT
          COUNT(*)::text AS total_deals,
          COUNT(*) FILTER (WHERE stage NOT IN ('won','lost'))::text AS active_deals,
          COUNT(*) FILTER (WHERE stage = 'won')::text AS closed_deals,
          COALESCE(SUM(value), 0)::text AS total_pipeline,
          COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0)::text AS won_value
        FROM deals
        WHERE created_by_id = ${userId}
      `);
      return r.rows[0] ?? null;
    },
    null
  );

  // ── Properties ───────────────────────────────────────────────────────────
  const propTotals = await safeQuery(
    "properties",
    async () => {
      const r = await db.execute<{ total: string; active: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'active')::text AS active
        FROM properties
        WHERE listed_by_id = ${userId}
      `);
      return r.rows[0] ?? null;
    },
    null
  );

  // ── Team members ─────────────────────────────────────────────────────────
  const teamTotals = await safeQuery(
    "team-members",
    async () => {
      const r = await db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total FROM team_members WHERE user_id = ${userId}
      `);
      return r.rows[0] ?? null;
    },
    null
  );

  // ── Upcoming appointments count ──────────────────────────────────────────
  const upcomingAppointmentsCount = await safeQuery(
    "upcoming-appt-count",
    async () => {
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const r = await db.execute<{ count: string }>(sql`
        SELECT COUNT(*)::text AS count
        FROM appointments
        WHERE user_id = ${userId}
          AND date_time >= NOW()
          AND date_time <= ${in7Days.toISOString()}
      `);
      return parseInt(r.rows[0]?.count ?? "0", 10);
    },
    0
  );

  // ── Recent leads ─────────────────────────────────────────────────────────
  const recentLeadsRows = await safeQuery(
    "recent-leads",
    async () => {
      const r = await db.execute<{
        id: string; name: string; source: string; status: string;
        created_at: string; score: string;
      }>(sql`
        SELECT id::text, name, COALESCE(source, 'Unknown') AS source, status,
               created_at::text, COALESCE(score, 0)::text AS score
        FROM leads
        WHERE created_by_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 5
      `);
      return r.rows;
    },
    []
  );

  // ── Recent deals ─────────────────────────────────────────────────────────
  const recentDealsRows = await safeQuery(
    "recent-deals",
    async () => {
      const r = await db.execute<{
        id: string; title: string; stage: string; value: string;
        updated_at: string; lead_name: string;
      }>(sql`
        SELECT d.id::text, d.title, d.stage,
               COALESCE(d.value::text, '0') AS value,
               d.updated_at::text,
               COALESCE(l.name, '') AS lead_name
        FROM deals d
        LEFT JOIN leads l ON d.lead_id = l.id
        WHERE d.created_by_id = ${userId}
        ORDER BY d.updated_at DESC
        LIMIT 5
      `);
      return r.rows;
    },
    []
  );

  // ── Upcoming appointments list ────────────────────────────────────────────
  const upcomingApptRows = await safeQuery(
    "upcoming-appt-list",
    async () => {
      const r = await db.execute<{
        id: string; title: string; date_time: string;
        location: string; lead_name: string;
      }>(sql`
        SELECT a.id::text, a.title, a.date_time::text,
               COALESCE(a.location, '') AS location,
               COALESCE(l.name, '') AS lead_name
        FROM appointments a
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE a.user_id = ${userId} AND a.date_time >= NOW()
        ORDER BY a.date_time ASC
        LIMIT 5
      `);
      return r.rows;
    },
    []
  );

  // ── Weekly activity ───────────────────────────────────────────────────────
  const weeklyRows = await safeQuery(
    "weekly-activity",
    async () => {
      const r = await db.execute<{
        day: string; day_label: string; leads: string; deals: string;
      }>(sql`
        WITH days AS (
          SELECT generate_series(
            DATE_TRUNC('day', NOW() - INTERVAL '6 days'),
            DATE_TRUNC('day', NOW()),
            '1 day'::interval
          )::date AS day
        ),
        lead_counts AS (
          SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS cnt
          FROM leads
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND created_by_id = ${userId}
          GROUP BY 1
        ),
        deal_counts AS (
          SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS cnt
          FROM deals
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND created_by_id = ${userId}
          GROUP BY 1
        )
        SELECT
          d.day::text AS day,
          TO_CHAR(d.day, 'Dy') AS day_label,
          COALESCE(l.cnt, 0)::text AS leads,
          COALESCE(dl.cnt, 0)::text AS deals
        FROM days d
        LEFT JOIN lead_counts l ON l.day = d.day
        LEFT JOIN deal_counts dl ON dl.day = d.day
        ORDER BY d.day ASC
      `);
      return r.rows;
    },
    []
  );

  // ── Message activity — scoped to this user's conversations ───────────────
  const msgActivityRows = await safeQuery(
    "message-activity",
    async () => {
      const r = await db.execute<{ day: string; count: string }>(sql`
        SELECT TO_CHAR(DATE_TRUNC('day', m.created_at), 'Mon DD') AS day,
               COUNT(*)::text AS count
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = ${userId}
          AND m.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', m.created_at)
        ORDER BY DATE_TRUNC('day', m.created_at) ASC
      `);
      return r.rows;
    },
    []
  );

  // ── Monthly conversion trend ──────────────────────────────────────────────
  const monthlyRows = await safeQuery(
    "monthly-trend",
    async () => {
      const r = await db.execute<{ month: string; total: string; won: string }>(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS month,
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'won')::text AS won
        FROM leads
        WHERE created_at >= NOW() - INTERVAL '6 months'
          AND created_by_id = ${userId}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `);
      return r.rows;
    },
    []
  );

  // ── Status & priority breakdown ───────────────────────────────────────────
  const statusRows = await safeQuery(
    "status-breakdown",
    async () => {
      const r = await db.execute<{ status: string; count: string }>(sql`
        SELECT status, COUNT(*)::text AS count FROM leads
        WHERE created_by_id = ${userId}
        GROUP BY status ORDER BY count DESC
      `);
      return r.rows;
    },
    []
  );

  const priorityRows = await safeQuery(
    "priority-breakdown",
    async () => {
      const r = await db.execute<{ priority: string; count: string }>(sql`
        SELECT priority, COUNT(*)::text AS count FROM leads
        WHERE created_by_id = ${userId}
        GROUP BY priority ORDER BY count DESC
      `);
      return r.rows;
    },
    []
  );

  // ── Activity counts ───────────────────────────────────────────────────────
  const activityStats = await safeQuery(
    "activity-counts",
    async () => {
      const r = await db.execute<{ total: string; this_week: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS this_week
        FROM activities
        WHERE user_id = ${userId}
      `);
      return r.rows[0] ?? null;
    },
    null
  );

  // ── Total messages ────────────────────────────────────────────────────────
  const totalMessages = await safeQuery(
    "total-messages",
    async () => {
      const r = await db.execute<{ total: string }>(sql`
        SELECT COUNT(m.*)::text AS total
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = ${userId}
      `);
      return parseInt(r.rows[0]?.total ?? "0", 10);
    },
    0
  );

  logger.info({ userId }, "analytics/overview: complete");

  res.json({
    kpis: {
      totalLeads,
      wonLeads,
      conversionRate,
      totalDeals: parseInt(dealTotals?.total_deals ?? "0", 10),
      activeDeals: parseInt(dealTotals?.active_deals ?? "0", 10),
      closedDeals: parseInt(dealTotals?.closed_deals ?? "0", 10),
      totalPipeline: parseFloat(dealTotals?.total_pipeline ?? "0"),
      wonRevenue: parseFloat(dealTotals?.won_value ?? "0"),
      totalProperties: parseInt(propTotals?.total ?? "0", 10),
      activeProperties: parseInt(propTotals?.active ?? "0", 10),
      teamMembers: parseInt(teamTotals?.total ?? "0", 10),
      upcomingAppointments: upcomingAppointmentsCount,
      totalActivities: parseInt(activityStats?.total ?? "0", 10),
      activitiesThisWeek: parseInt(activityStats?.this_week ?? "0", 10),
      totalMessages,
    },
    sourceBreakdown: sourceRows.map((r) => ({
      source: r.source,
      count: parseInt(r.count, 10),
    })),
    agentPerformance: agentRows.map((r, i) => ({
      agent: r.agent,
      leads: parseInt(r.leads, 10),
      won: parseInt(r.won, 10),
      winRate: parseInt(r.leads, 10) > 0
        ? Math.round((parseInt(r.won, 10) / parseInt(r.leads, 10)) * 100) : 0,
      avgScore: parseInt(r.avg_score ?? "0", 10),
      rank: i + 1,
    })),
    dealsByStage: dealStageRows.map((r) => ({
      stage: r.stage,
      count: parseInt(r.count, 10),
      value: parseFloat(r.total_value),
    })),
    messageActivity: msgActivityRows.map((r) => ({
      day: r.day,
      count: parseInt(r.count, 10),
    })),
    conversionTrend: monthlyRows.map((r) => ({
      month: r.month,
      total: parseInt(r.total, 10),
      won: parseInt(r.won, 10),
      rate: parseInt(r.total, 10) > 0
        ? Math.round((parseInt(r.won, 10) / parseInt(r.total, 10)) * 100) : 0,
    })),
    statusBreakdown: statusRows.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    })),
    priorityBreakdown: priorityRows.map((r) => ({
      priority: r.priority,
      count: parseInt(r.count, 10),
    })),
    weeklyActivity: weeklyRows.map((r) => ({
      day: r.day_label,
      leads: parseInt(r.leads, 10),
      deals: parseInt(r.deals, 10),
    })),
    recentLeads: recentLeadsRows.map((r) => ({
      id: parseInt(r.id, 10),
      name: r.name,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
      score: parseInt(r.score, 10),
    })),
    recentDeals: recentDealsRows.map((r) => ({
      id: parseInt(r.id, 10),
      title: r.title,
      stage: r.stage,
      value: parseFloat(r.value),
      updatedAt: r.updated_at,
      leadName: r.lead_name,
    })),
    upcomingAppointmentsList: upcomingApptRows.map((r) => ({
      id: parseInt(r.id, 10),
      title: r.title,
      dateTime: r.date_time,
      location: r.location,
      leadName: r.lead_name,
    })),
  });
});

// ── Member Performance Stats ─────────────────────────────────────────────────
router.get("/analytics/member/:memberId", requireAuth, async (req, res) => {
  const orgUserId = (req as any).userId as string;
  const { memberId } = req.params;

  // Verify the requester and target are in the same org
  const orgCheck = await safeQuery(
    "member-org-check",
    async () => {
      const r = await db.execute<{ org_id: string }>(sql`
        SELECT org_id FROM users WHERE id = ${orgUserId} AND org_id IS NOT NULL LIMIT 1
      `);
      if (!r.rows[0]) return null;
      const orgId = r.rows[0].org_id;
      const m = await db.execute<{ id: string }>(sql`
        SELECT id FROM users WHERE id = ${memberId} AND org_id = ${orgId} LIMIT 1
      `);
      return m.rows[0] ? orgId : null;
    },
    null
  );

  if (!orgCheck) {
    return res.status(403).json({ error: "Access denied" });
  }

  const [leadStats, dealStats, activityStats, memberInfo] = await Promise.all([
    safeQuery("member-lead-stats", async () => {
      const r = await db.execute<{
        total: string; won: string; lost: string; active: string;
      }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'won')::text AS won,
          COUNT(*) FILTER (WHERE status = 'lost')::text AS lost,
          COUNT(*) FILTER (WHERE status NOT IN ('won','lost'))::text AS active
        FROM leads WHERE created_by_id = ${memberId}
      `);
      return r.rows[0] ?? { total: "0", won: "0", lost: "0", active: "0" };
    }, { total: "0", won: "0", lost: "0", active: "0" }),

    safeQuery("member-deal-stats", async () => {
      const r = await db.execute<{
        total: string; open: string; won: string; won_value: string; pipeline_value: string;
      }>(sql`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE stage NOT IN ('won','lost'))::text AS open,
          COUNT(*) FILTER (WHERE stage = 'won')::text AS won,
          COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0)::text AS won_value,
          COALESCE(SUM(value) FILTER (WHERE stage NOT IN ('won','lost')), 0)::text AS pipeline_value
        FROM deals WHERE created_by_id = ${memberId}
      `);
      return r.rows[0] ?? { total: "0", open: "0", won: "0", won_value: "0", pipeline_value: "0" };
    }, { total: "0", open: "0", won: "0", won_value: "0", pipeline_value: "0" }),

    safeQuery("member-activity-stats", async () => {
      const r = await db.execute<{ total: string; last_active: string }>(sql`
        SELECT
          COUNT(*)::text AS total,
          MAX(created_at)::text AS last_active
        FROM activities WHERE user_id = ${memberId}
      `);
      return r.rows[0] ?? { total: "0", last_active: null };
    }, { total: "0", last_active: null as string | null }),

    safeQuery("member-info", async () => {
      const r = await db.execute<{
        first_name: string; last_name: string; email: string; org_role: string; is_active: string;
      }>(sql`
        SELECT first_name, last_name, email, org_role, is_active::text
        FROM users WHERE id = ${memberId} LIMIT 1
      `);
      return r.rows[0] ?? null;
    }, null as any),
  ]);

  const total = parseInt(leadStats.total, 10);
  const won = parseInt(leadStats.won, 10);

  return res.json({
    member: memberInfo ? {
      name: `${memberInfo.first_name ?? ""} ${memberInfo.last_name ?? ""}`.trim(),
      email: memberInfo.email,
      role: memberInfo.org_role,
      isActive: memberInfo.is_active === "true",
    } : null,
    leads: {
      total,
      won,
      lost: parseInt(leadStats.lost, 10),
      active: parseInt(leadStats.active, 10),
      conversionRate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
    },
    deals: {
      total: parseInt(dealStats.total, 10),
      open: parseInt(dealStats.open, 10),
      won: parseInt(dealStats.won, 10),
      wonValue: parseFloat(dealStats.won_value),
      pipelineValue: parseFloat(dealStats.pipeline_value),
    },
    activities: {
      total: parseInt(activityStats.total, 10),
      lastActive: activityStats.last_active,
    },
  });
});

export default router;

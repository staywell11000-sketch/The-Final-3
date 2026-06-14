import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/org/me", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    // Try owner first, then member lookup
    let orgId: number | null = null;
    const ownerRow = await db.execute(sql`SELECT id FROM organizations WHERE owner_id = ${userId} ORDER BY created_at ASC LIMIT 1`);
    if (ownerRow.rows.length) {
      orgId = (ownerRow.rows[0] as any).id;
    } else {
      const memberRow = await db.execute(sql`SELECT organization_id FROM users WHERE id = ${userId} AND organization_id IS NOT NULL LIMIT 1`);
      if (memberRow.rows.length) orgId = (memberRow.rows[0] as any).organization_id;
    }
    if (!orgId) return res.status(404).json({ error: "No organization found" });
    const rows = await db.execute(sql`
      SELECT o.*, p.name as plan_name, p.price_monthly, p.max_users, p.max_leads_per_month,
             p.max_whatsapp_numbers, p.max_facebook_pages, p.max_storage_gb, p.features
      FROM organizations o
      LEFT JOIN plans p ON p.slug = o.plan
      WHERE o.id = ${orgId}
      LIMIT 1
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "No organization found" });
    return res.json({ organization: rows.rows[0] });
  } catch (err) {
    logger.error({ err }, "GET /org/me error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/organizations", requireAuth, requireSuperAdmin, async (req, res) => {
  const { search, status, page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limit = 50;
  const offset = (pageNum - 1) * limit;
  try {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (o.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    if (status && status !== "all") {
      params.push(status);
      whereClause += ` AND o.subscription_status = $${params.length}`;
    }
    params.push(limit, offset);
    const rows = await db.execute(sql`
      SELECT o.*, p.name as plan_name, p.price_monthly,
             u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name,
             (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as member_count,
             (SELECT COUNT(*) FROM leads WHERE created_by_id IN (SELECT id FROM users WHERE organization_id = o.id)) as lead_count
      FROM organizations o
      LEFT JOIN plans p ON p.slug = o.plan
      LEFT JOIN users u ON u.id = o.owner_id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const total = await db.execute(sql`SELECT COUNT(*) FROM organizations`);
    return res.json({ data: rows.rows, total: Number((total.rows[0] as any).count), page: pageNum });
  } catch (err) {
    logger.error({ err }, "GET /admin/organizations error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/organizations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.execute(sql`
      SELECT o.*, p.name as plan_name, p.price_monthly, p.features,
             u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name
      FROM organizations o
      LEFT JOIN plans p ON p.slug = o.plan
      LEFT JOIN users u ON u.id = o.owner_id
      WHERE o.id = ${parseInt(String(id), 10)}
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "Not found" });
    return res.json({ organization: rows.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/organizations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  const { plan, subscriptionStatus, subscriptionEndDate, isSuspended, isInternal } = req.body;
  try {
    await db.execute(sql`
      UPDATE organizations SET
        plan = COALESCE(${plan ?? null}, plan),
        subscription_status = COALESCE(${subscriptionStatus ?? null}, subscription_status),
        subscription_end_date = COALESCE(${subscriptionEndDate ? new Date(subscriptionEndDate) : null}, subscription_end_date),
        is_suspended = COALESCE(${isSuspended ?? null}, is_suspended),
        is_internal = COALESCE(${isInternal ?? null}, is_internal),
        updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'org.updated', 'organization', ${id}, ${parseInt(String(id), 10)}, ${JSON.stringify(req.body)}, NOW())
    `);
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/organizations/:id error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/organizations/:id/approve-subscription", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  const { plan, months = 1 } = req.body;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30 * Number(months));
  try {
    await db.execute(sql`
      UPDATE organizations SET
        plan = COALESCE(${plan ?? null}, plan),
        subscription_status = 'active',
        subscription_end_date = ${endDate},
        updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'subscription.approved', 'organization', ${id}, ${parseInt(String(id), 10)},
              ${JSON.stringify({ plan, months, endDate })}, NOW())
    `);
    return res.json({ success: true, subscriptionEndDate: endDate });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/organizations/:id/suspend", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  try {
    await db.execute(sql`UPDATE organizations SET is_suspended = true, updated_at = NOW() WHERE id = ${parseInt(String(id), 10)}`);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, created_at)
      VALUES (${actorId}, ${actorEmail}, 'org.suspended', 'organization', ${id}, ${parseInt(String(id), 10)}, NOW())
    `);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/organizations/:id/unsuspend", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  try {
    await db.execute(sql`UPDATE organizations SET is_suspended = false, updated_at = NOW() WHERE id = ${parseInt(String(id), 10)}`);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, created_at)
      VALUES (${actorId}, ${actorEmail}, 'org.unsuspended', 'organization', ${id}, ${parseInt(String(id), 10)}, NOW())
    `);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/stats", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM organizations)                                                        AS total_orgs,
        (SELECT COUNT(*) FROM organizations WHERE subscription_status = 'active')                  AS active_subscriptions,
        (SELECT COUNT(*) FROM organizations WHERE subscription_status = 'trial')                   AS trial_orgs,
        (SELECT COUNT(*) FROM organizations WHERE subscription_status = 'expired')                 AS expired_subscriptions,
        (SELECT COUNT(*) FROM organizations WHERE is_suspended = true)                             AS suspended_orgs,
        (SELECT COUNT(*) FROM users)                                                               AS total_users,
        (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending')                           AS pending_payments,
        (SELECT COUNT(*) FROM payment_requests WHERE status = 'approved')                          AS approved_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_requests WHERE status = 'approved')          AS total_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_requests
           WHERE status = 'approved'
             AND date_trunc('month', created_at) = date_trunc('month', NOW()))                     AS monthly_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_requests
           WHERE status = 'approved'
             AND date_trunc('year', created_at) = date_trunc('year', NOW()))                       AS annual_revenue,
        (SELECT COUNT(*) FROM messages)                                                            AS whatsapp_messages,
        (SELECT COALESCE(SUM(file_size), 0) FROM documents)                                        AS storage_bytes,
        (SELECT COALESCE(SUM(ai_requests_used), 0) FROM organizations)                             AS ai_requests_total
    `);
    return res.json({ stats: stats.rows[0] });
  } catch (err) {
    logger.error({ err }, "GET /admin/stats error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/growth", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const orgGrowth = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', created_at), 'Mon YY') AS month,
        date_trunc('month', created_at)                    AS month_ts,
        COUNT(*)::int                                      AS new_orgs
      FROM organizations
      WHERE created_at >= NOW() - INTERVAL '11 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month_ts ASC
    `);

    const revenueGrowth = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', created_at), 'Mon YY') AS month,
        date_trunc('month', created_at)                    AS month_ts,
        COALESCE(SUM(amount), 0)::int                      AS revenue
      FROM payment_requests
      WHERE status = 'approved'
        AND created_at >= NOW() - INTERVAL '11 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY month_ts ASC
    `);

    const subBreakdown = await db.execute(sql`
      SELECT
        subscription_status AS status,
        COUNT(*)::int        AS count
      FROM organizations
      GROUP BY subscription_status
      ORDER BY count DESC
    `);

    return res.json({
      org_growth:    orgGrowth.rows,
      revenue_growth: revenueGrowth.rows,
      sub_breakdown:  subBreakdown.rows,
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/growth error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

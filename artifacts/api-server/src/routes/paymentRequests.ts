import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { isAiBooster, AI_BOOSTER_PACKS, addBonusActions } from "../middlewares/requireAiCredits";

const router = Router();

router.post("/payments", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { amount, plan, screenshotUrl, notes } = req.body;
  if (!amount || !plan) return res.status(400).json({ error: "amount and plan are required" });
  try {
    let orgId: number | null = null;
    const ownerOrg = await db.execute(sql`SELECT id FROM organizations WHERE owner_id = ${userId} LIMIT 1`);
    if (ownerOrg.rows.length) {
      orgId = (ownerOrg.rows[0] as any).id;
    } else {
      const memberUser = await db.execute(sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`);
      if (memberUser.rows.length && (memberUser.rows[0] as any).organization_id) {
        orgId = (memberUser.rows[0] as any).organization_id;
      }
    }
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const result = await db.execute(sql`
      INSERT INTO payment_requests (organization_id, amount, plan, screenshot_url, notes, status, submitted_at, created_at, updated_at)
      VALUES (${orgId}, ${amount}, ${plan}, ${screenshotUrl ?? null}, ${notes ?? null}, 'pending', NOW(), NOW(), NOW())
      RETURNING *
    `);
    return res.status(201).json({ paymentRequest: result.rows[0] });
  } catch (err) {
    logger.error({ err }, "POST /payments error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/payments/mine", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    let orgId: number | null = null;
    const ownerOrg = await db.execute(sql`SELECT id FROM organizations WHERE owner_id = ${userId} LIMIT 1`);
    if (ownerOrg.rows.length) {
      orgId = (ownerOrg.rows[0] as any).id;
    } else {
      const memberUser = await db.execute(sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`);
      if (memberUser.rows.length && (memberUser.rows[0] as any).organization_id) {
        orgId = (memberUser.rows[0] as any).organization_id;
      }
    }
    if (!orgId) return res.json({ data: [] });
    const rows = await db.execute(sql`
      SELECT * FROM payment_requests WHERE organization_id = ${orgId} ORDER BY submitted_at DESC
    `);
    return res.json({ data: rows.rows });
  } catch (err) {
    logger.error({ err }, "GET /payments/mine error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/payments", requireAuth, requireSuperAdmin, async (req, res) => {
  const { status, page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limit = 50;
  const offset = (pageNum - 1) * limit;
  try {
    const rows = await db.execute(sql`
      SELECT pr.*, o.name as org_name, o.plan as current_plan,
             u.email as owner_email, u.first_name as owner_first_name
      FROM payment_requests pr
      LEFT JOIN organizations o ON o.id = pr.organization_id
      LEFT JOIN users u ON u.id = o.owner_id
      ORDER BY pr.submitted_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const filtered = status && status !== "all"
      ? rows.rows.filter((r: any) => r.status === status)
      : rows.rows;
    return res.json({ data: filtered, total: rows.rows.length });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/payments/:id/approve", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  const { months = 1 } = req.body;
  try {
    const pr = await db.execute(sql`SELECT * FROM payment_requests WHERE id = ${parseInt(String(id), 10)}`);
    if (!pr.rows.length) return res.status(404).json({ error: "Not found" });
    const request = pr.rows[0] as any;

    await db.execute(sql`
      UPDATE payment_requests SET status = 'approved', approved_at = NOW(), approved_by = ${actorId}, updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);

    // AI Booster purchase — add bonus_actions instead of changing plan
    if (isAiBooster(request.plan)) {
      const pack = AI_BOOSTER_PACKS[request.plan];
      if (pack) {
        await addBonusActions(request.organization_id, pack.actions);
      }
      await db.execute(sql`
        INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
        VALUES (${actorId}, ${actorEmail}, 'payment.approved', 'payment_request', ${id},
                ${request.organization_id}, ${JSON.stringify({ plan: request.plan, amount: request.amount, booster: true, actions: AI_BOOSTER_PACKS[request.plan]?.actions })}, NOW())
      `);
      return res.json({ success: true, booster: true, actions: AI_BOOSTER_PACKS[request.plan]?.actions });
    }

    // Regular plan upgrade
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30 * Number(months));
    await db.execute(sql`
      UPDATE organizations SET
        plan = ${request.plan},
        subscription_status = 'active',
        subscription_end_date = ${endDate},
        updated_at = NOW()
      WHERE id = ${request.organization_id}
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'payment.approved', 'payment_request', ${id},
              ${request.organization_id}, ${JSON.stringify({ plan: request.plan, amount: request.amount, months, endDate })}, NOW())
    `);
    return res.json({ success: true, subscriptionEndDate: endDate });
  } catch (err) {
    logger.error({ err }, "POST /admin/payments/:id/approve error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/payments/:id/reject", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  const { reason } = req.body;
  try {
    const pr = await db.execute(sql`SELECT * FROM payment_requests WHERE id = ${parseInt(String(id), 10)}`);
    if (!pr.rows.length) return res.status(404).json({ error: "Not found" });
    const request = pr.rows[0] as any;
    await db.execute(sql`
      UPDATE payment_requests SET status = 'rejected', rejection_reason = ${reason ?? null}, updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'payment.rejected', 'payment_request', ${id},
              ${request.organization_id}, ${JSON.stringify({ reason })}, NOW())
    `);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

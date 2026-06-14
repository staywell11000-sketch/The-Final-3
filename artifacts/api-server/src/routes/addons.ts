import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const ADDON_PACKS = {
  ai_requests: { quantity: 500, price: 2000, label: "Extra AI Pack" },
  leads: { quantity: 1000, price: 3000, label: "Extra Leads Pack" },
};

router.get("/addons/packs", requireAuth, async (_req, res) => {
  return res.json({ packs: ADDON_PACKS });
});

router.get("/addons/mine", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const org = await db.execute(sql`
      SELECT id FROM organizations WHERE owner_id = ${userId}
         OR id = (SELECT organization_id FROM users WHERE id = ${userId})
      LIMIT 1
    `);
    if (!org.rows.length) return res.json({ addons: [] });
    const orgId = (org.rows[0] as any).id;
    const rows = await db.execute(sql`
      SELECT * FROM organization_addons WHERE organization_id = ${orgId}
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY purchased_at DESC
    `);
    return res.json({ addons: rows.rows });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/ai/credits", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userEmail = (req as any).userEmail as string;
  const PLAN_LIMITS: Record<string, number> = { starter: 100, professional: 1000, agency: 5000, trial: 30 };
  const isSuperAdmin = userEmail === "murtazaarshad499@gmail.com";
  try {
    if (isSuperAdmin) {
      return res.json({ planIncluded: 5000, used: 0, remainingPlan: 5000, addonRemaining: 0, available: null, isSuperAdmin: true, resetAt: null });
    }
    const orgRow = await db.execute(sql`
      SELECT o.id, o.plan, o.ai_requests_used, o.ai_requests_reset_at,
             (SELECT COALESCE(SUM(quantity_remaining), 0) FROM organization_addons
              WHERE organization_id = o.id AND addon_type = 'ai_requests'
                AND quantity_remaining > 0 AND (expires_at IS NULL OR expires_at > NOW())) as addon_remaining
      FROM organizations o
      WHERE o.owner_id = ${userId}
         OR o.id = (SELECT organization_id FROM users WHERE id = ${userId})
      LIMIT 1
    `);
    if (!orgRow.rows.length) {
      return res.json({ planIncluded: 0, used: 0, addonRemaining: 0, total: 0, isSuperAdmin: false });
    }
    const org = orgRow.rows[0] as any;
    const now = new Date();
    const resetAt = org.ai_requests_reset_at ? new Date(org.ai_requests_reset_at) : null;
    const needsReset = !resetAt || (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear());
    let used = org.ai_requests_used ?? 0;
    if (needsReset) {
      await db.execute(sql`UPDATE organizations SET ai_requests_used = 0, ai_requests_reset_at = NOW(), updated_at = NOW() WHERE id = ${org.id}`);
      used = 0;
    }
    const planIncluded = PLAN_LIMITS[org.plan] ?? 30;
    const addonRemaining = Number(org.addon_remaining ?? 0);
    return res.json({
      orgId: org.id,
      plan: org.plan,
      planIncluded,
      used,
      remainingPlan: Math.max(0, planIncluded - used),
      addonRemaining,
      available: Math.max(0, planIncluded - used) + addonRemaining,
      isSuperAdmin: false,
      resetAt: org.ai_requests_reset_at,
    });
  } catch (err) {
    logger.error({ err }, "GET /ai/credits error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/addons", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT oa.*, o.name as org_name
      FROM organization_addons oa
      LEFT JOIN organizations o ON o.id = oa.organization_id
      ORDER BY oa.purchased_at DESC
      LIMIT 200
    `);
    return res.json({ data: rows.rows });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/addons", requireAuth, requireSuperAdmin, async (req, res) => {
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  const { organizationId, addonType, quantity, expiresAt } = req.body;
  if (!organizationId || !addonType || !quantity) return res.status(400).json({ error: "organizationId, addonType, quantity required" });
  try {
    const result = await db.execute(sql`
      INSERT INTO organization_addons (organization_id, addon_type, quantity, quantity_remaining, purchased_at, expires_at, created_at, updated_at)
      VALUES (${organizationId}, ${addonType}, ${quantity}, ${quantity}, NOW(), ${expiresAt ? new Date(expiresAt) : null}, NOW(), NOW())
      RETURNING *
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'addon.granted', 'organization_addon', ${String((result.rows[0] as any).id)}, ${organizationId}, ${JSON.stringify({ addonType, quantity })}, NOW())
    `);
    return res.status(201).json({ addon: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/payments/:id/approve-addon", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const actorId = (req as any).userId;
  const actorEmail = (req as any).userEmail;
  try {
    const pr = await db.execute(sql`SELECT * FROM payment_requests WHERE id = ${parseInt(String(id), 10)}`);
    if (!pr.rows.length) return res.status(404).json({ error: "Not found" });
    const request = pr.rows[0] as any;
    const addonType = request.plan.replace("addon_", "");
    const quantity = addonType === "ai_requests" ? 500 : 1000;
    await db.execute(sql`
      UPDATE payment_requests SET status = 'approved', approved_at = NOW(), approved_by = ${actorId}, updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);
    await db.execute(sql`
      INSERT INTO organization_addons (organization_id, addon_type, quantity, quantity_remaining, purchased_at, created_at, updated_at)
      VALUES (${request.organization_id}, ${addonType}, ${quantity}, ${quantity}, NOW(), NOW(), NOW())
    `);
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, organization_id, meta, created_at)
      VALUES (${actorId}, ${actorEmail}, 'addon.approved', 'payment_request', ${id}, ${request.organization_id}, ${JSON.stringify({ addonType, quantity, amount: request.amount })}, NOW())
    `);
    return res.json({ success: true, addonType, quantity });
  } catch (err) {
    logger.error({ err }, "approve-addon error");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

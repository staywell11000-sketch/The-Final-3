import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSuperAdmin } from "../middlewares/requireSuperAdmin";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/plans", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT * FROM plans WHERE is_active = true ORDER BY price_monthly ASC`);
    return res.json({ plans: rows.rows });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/plans", requireAuth, requireSuperAdmin, async (req, res) => {
  const { slug, name, priceMonthly, currency = "PKR", maxUsers, maxLeadsPerMonth, maxWhatsappNumbers, maxFacebookPages, maxStorageGb, features = [] } = req.body;
  if (!slug || !name || !priceMonthly) return res.status(400).json({ error: "slug, name, priceMonthly required" });
  try {
    const result = await db.execute(sql`
      INSERT INTO plans (slug, name, price_monthly, currency, max_users, max_leads_per_month, max_whatsapp_numbers, max_facebook_pages, max_storage_gb, features, is_active, created_at, updated_at)
      VALUES (${slug}, ${name}, ${priceMonthly}, ${currency}, ${maxUsers ?? null}, ${maxLeadsPerMonth ?? null}, ${maxWhatsappNumbers ?? null}, ${maxFacebookPages ?? null}, ${maxStorageGb ?? null}, ${JSON.stringify(features)}, true, NOW(), NOW())
      RETURNING *
    `);
    return res.status(201).json({ plan: result.rows[0] });
  } catch (err: any) {
    if (err.message?.includes("unique")) return res.status(409).json({ error: "Plan slug already exists" });
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/plans/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, priceMonthly, maxUsers, maxLeadsPerMonth, maxWhatsappNumbers, maxFacebookPages, maxStorageGb, features, isActive } = req.body;
  try {
    await db.execute(sql`
      UPDATE plans SET
        name = COALESCE(${name ?? null}, name),
        price_monthly = COALESCE(${priceMonthly ?? null}, price_monthly),
        max_users = COALESCE(${maxUsers ?? null}, max_users),
        max_leads_per_month = COALESCE(${maxLeadsPerMonth ?? null}, max_leads_per_month),
        max_whatsapp_numbers = COALESCE(${maxWhatsappNumbers ?? null}, max_whatsapp_numbers),
        max_facebook_pages = COALESCE(${maxFacebookPages ?? null}, max_facebook_pages),
        max_storage_gb = COALESCE(${maxStorageGb ?? null}, max_storage_gb),
        features = COALESCE(${features ? JSON.stringify(features) : null}::jsonb, features),
        is_active = COALESCE(${isActive ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;

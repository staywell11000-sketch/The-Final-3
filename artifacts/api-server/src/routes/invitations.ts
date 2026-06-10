import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router: IRouter = Router();

function generateCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/invitations", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const userRow = await db.execute(sql`
      SELECT role, org_role, organization_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const user = userRow.rows[0] as any;
    if (!user?.organization_id) {
      return res.status(403).json({ error: "No organization" });
    }

    const orgRow = await db.execute(sql`
      SELECT owner_id FROM organizations WHERE id = ${user.organization_id} LIMIT 1
    `);
    const org = orgRow.rows[0] as any;
    const isAdmin =
      org?.owner_id === userId ||
      user.role === "super_admin" ||
      user.org_role === "admin";

    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can invite members" });
    }

    // Plan-based seat limits
    const planRow = await db.execute(sql`
      SELECT plan FROM organizations WHERE id = ${user.organization_id} LIMIT 1
    `);
    const plan = (planRow.rows[0] as any)?.plan ?? "free";

    const PLAN_LIMITS: Record<string, number> = {
      free: 1,
      starter: 1,
      professional: 5,
      agency: Infinity,
    };
    const limit = PLAN_LIMITS[plan] ?? 1;

    if (limit !== Infinity) {
      const memberCount = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM users WHERE organization_id = ${user.organization_id} AND is_active = true
      `);
      const currentMembers = Number((memberCount.rows[0] as any)?.cnt ?? 0);

      const pendingCount = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM invitations
        WHERE organization_id = ${user.organization_id}
          AND accepted_at IS NULL
          AND expires_at > NOW()
      `);
      const pendingInvites = Number((pendingCount.rows[0] as any)?.cnt ?? 0);

      if (currentMembers + pendingInvites >= limit) {
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
        return res.status(403).json({
          error: `Your ${planName} plan allows up to ${limit} user${limit === 1 ? "" : "s"}. Upgrade your plan to invite more team members.`,
        });
      }
    }

    const { name, email, phone, orgRole = "agent" } = req.body as {
      name: string;
      email: string;
      phone?: string;
      orgRole?: string;
    };

    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

    const existingUser = await db.execute(sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} AND organization_id = ${user.organization_id} LIMIT 1
    `);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "This email is already a member of your organization" });
    }

    const existing = await db.execute(sql`
      SELECT id FROM invitations WHERE email = ${email.toLowerCase()} AND organization_id = ${user.organization_id} AND accepted_at IS NULL AND expires_at > NOW() LIMIT 1
    `);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An active invitation already exists for this email" });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const phoneTrimmed = phone?.trim() || null;

    const result = await db.execute(sql`
      INSERT INTO invitations (organization_id, email, name, org_role, invitation_code, phone, invited_by, expires_at, created_at)
      VALUES (${user.organization_id}, ${email.toLowerCase()}, ${name.trim()}, ${orgRole}, ${code}, ${phoneTrimmed}, ${userId}, ${expiresAt}, NOW())
      RETURNING *
    `);

    const inv = result.rows[0] as any;
    logger.info({ invId: inv?.id, email, orgRole }, "Invitation created");
    return res.status(201).json({ ...inv, invitationCode: code });
  } catch (err) {
    logger.error({ err }, "Create invitation error");
    return res.status(500).json({ error: "Failed to create invitation" });
  }
});

router.get("/invitations", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const userRow = await db.execute(sql`
      SELECT role, org_role, organization_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const user = userRow.rows[0] as any;
    if (!user?.organization_id) return res.status(403).json({ error: "No organization" });

    const orgRow = await db.execute(sql`SELECT owner_id FROM organizations WHERE id = ${user.organization_id} LIMIT 1`);
    const org = orgRow.rows[0] as any;
    const isAdmin = org?.owner_id === userId || user.role === "super_admin" || user.org_role === "admin";
    if (!isAdmin) return res.status(403).json({ error: "Access denied" });

    const rows = await db.execute(sql`
      SELECT i.*, u.first_name || ' ' || COALESCE(u.last_name, '') AS invited_by_name
      FROM invitations i
      LEFT JOIN users u ON u.id = i.invited_by
      WHERE i.organization_id = ${user.organization_id}
      ORDER BY i.created_at DESC
    `);

    return res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "List invitations error");
    return res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.post("/invitations/validate", async (req, res) => {
  const { email, code } = req.body as { email: string; code: string };
  if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

  try {
    const row = await db.execute(sql`
      SELECT i.*, o.name AS org_name
      FROM invitations i
      JOIN organizations o ON o.id = i.organization_id
      WHERE LOWER(i.email) = ${email.toLowerCase()}
        AND UPPER(i.invitation_code) = ${code.trim().toUpperCase()}
        AND i.accepted_at IS NULL
        AND i.expires_at > NOW()
      LIMIT 1
    `);

    if (!row.rows.length) {
      return res.status(404).json({ error: "Invalid or expired invitation code" });
    }

    const inv = row.rows[0] as any;
    return res.json({
      valid: true,
      name: inv.name,
      email: inv.email,
      orgRole: inv.org_role,
      orgName: inv.org_name,
    });
  } catch (err) {
    logger.error({ err }, "Validate invitation error");
    return res.status(500).json({ error: "Failed to validate invitation" });
  }
});

router.delete("/invitations/:id", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    const userRow = await db.execute(sql`
      SELECT role, org_role, organization_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const user = userRow.rows[0] as any;
    if (!user?.organization_id) return res.status(403).json({ error: "No organization" });

    const orgRow = await db.execute(sql`SELECT owner_id FROM organizations WHERE id = ${user.organization_id} LIMIT 1`);
    const org = orgRow.rows[0] as any;
    const isAdmin = org?.owner_id === userId || user.role === "super_admin" || user.org_role === "admin";
    if (!isAdmin) return res.status(403).json({ error: "Access denied" });

    await db.execute(sql`
      DELETE FROM invitations WHERE id = ${id} AND organization_id = ${user.organization_id}
    `);

    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Delete invitation error");
    return res.status(500).json({ error: "Failed to delete invitation" });
  }
});

export default router;

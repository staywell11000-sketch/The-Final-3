import { type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const VALID_PLAN_SLUGS = ["free", "starter", "professional", "agency"] as const;
type PaidPlanSlug = typeof VALID_PLAN_SLUGS[number];

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  let user: { id: string; email?: string; user_metadata?: Record<string, string> };
  try {
    const { data: { user: u }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !u) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    user = u as any;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  (req as any).userId = user.id;
  (req as any).userEmail = user.email;

  try {
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    const fullName: string = meta.full_name ?? meta.name ?? "";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || null;
    const email = user.email ?? "";
    const isSuperAdmin = email === "murtazaarshad499@gmail.com";

    // Upsert user record — do NOT update onboarded (preserve existing value)
    await db.execute(sql`
      INSERT INTO users (id, email, first_name, last_name, role, org_role, onboarded, is_active, created_at, updated_at)
      VALUES (
        ${user.id},
        ${email},
        ${firstName || null},
        ${lastName},
        ${isSuperAdmin ? "super_admin" : "agent"},
        ${isSuperAdmin ? "admin" : "agent"},
        ${isSuperAdmin},
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email      = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name  = COALESCE(EXCLUDED.last_name,  users.last_name),
        role       = CASE WHEN EXCLUDED.email = 'murtazaarshad499@gmail.com' THEN 'super_admin' ELSE users.role END,
        updated_at = NOW()
    `);

    // ── OWNER SELF-HEALING ────────────────────────────────────────────────────
    // Check for any org where this user is the owner_id (authoritative lookup).
    // Always wins over organization_id column value so owners are never locked out.
    const existingOwner = await db.execute(sql`
      SELECT id FROM organizations WHERE owner_id = ${user.id} ORDER BY created_at ASC LIMIT 1
    `);

    if (existingOwner.rows.length > 0) {
      const ownedOrgId = (existingOwner.rows[0] as any).id;
      // Ensure owner always has correct organization_id and org_role.
      // Do NOT touch onboarded — owners must complete the onboarding wizard on first login.
      await db.execute(sql`
        UPDATE users
        SET organization_id = ${ownedOrgId},
            org_role        = 'admin',
            updated_at      = NOW()
        WHERE id = ${user.id}
          AND (
            organization_id IS DISTINCT FROM ${ownedOrgId}
            OR org_role     IS DISTINCT FROM 'admin'
          )
      `);
    } else {
      // User does not own any org — check if they already have one assigned
      const existingMember = await db.execute(sql`
        SELECT organization_id FROM users
        WHERE id = ${user.id} AND organization_id IS NOT NULL
        LIMIT 1
      `);

      if (!existingMember.rows.length) {
        // No org at all — check for a pending invite first
        const pendingInvite = await db.execute(sql`
          SELECT organization_id, org_role FROM invitations
          WHERE LOWER(email) = ${email.toLowerCase()}
            AND accepted_at IS NULL
            AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1
        `);

        if (pendingInvite.rows.length > 0) {
          // Accept the invitation — employees skip business onboarding
          const inv = pendingInvite.rows[0] as any;
          await db.execute(sql`
            UPDATE users
            SET organization_id = ${inv.organization_id},
                org_role        = ${inv.org_role},
                onboarded       = true,
                updated_at      = NOW()
            WHERE id = ${user.id}
          `);
          await db.execute(sql`
            UPDATE invitations
            SET accepted_at = NOW(), accepted_by = ${user.id}
            WHERE LOWER(email) = ${email.toLowerCase()}
              AND accepted_at IS NULL
              AND expires_at > NOW()
          `);
          logger.info({ userId: user.id, email, orgId: inv.organization_id }, "Invited user joined organization");
        } else {
          // Brand-new owner — auto-create their organization.
          // onboarded stays false so they go through the setup wizard.
          const rawOrgName = meta.org_name as string | undefined;
          const orgName = isSuperAdmin
            ? "LuxeState Admin"
            : (rawOrgName?.trim() || (firstName ? `${firstName}'s Workspace` : (email.split("@")[0] + "'s Workspace")));

          const rawPlanSlug = meta.plan_slug as string | undefined;
          const selectedPlan: PaidPlanSlug = (rawPlanSlug && (VALID_PLAN_SLUGS as readonly string[]).includes(rawPlanSlug))
            ? rawPlanSlug as PaidPlanSlug
            : "free";

          const plan = isSuperAdmin ? "agency" : selectedPlan;
          const status = isSuperAdmin ? "active" : (selectedPlan === "free" ? "active" : "trial");

          // Use ON CONFLICT to handle concurrent requests (unique constraint on owner_id)
          const orgResult = await db.execute(sql`
            INSERT INTO organizations (name, owner_id, plan, subscription_status, is_internal, created_at, updated_at)
            VALUES (${orgName}, ${user.id}, ${plan}, ${status}, ${isSuperAdmin}, NOW(), NOW())
            ON CONFLICT (owner_id) DO NOTHING
            RETURNING id
          `).catch((err: any) => { logger.error({ err }, "requireAuth: org auto-create failed"); return null; });

          // If INSERT returned no row (concurrent request already inserted), find the existing org
          let newOrgId: number | null = null;
          if (orgResult && orgResult.rows.length > 0) {
            newOrgId = (orgResult.rows[0] as any).id;
            logger.info({ userId: user.id, orgId: newOrgId, plan }, "Created organization for new owner");
          } else {
            const existing = await db.execute(sql`
              SELECT id FROM organizations WHERE owner_id = ${user.id} LIMIT 1
            `).catch(() => null);
            if (existing && existing.rows.length > 0) {
              newOrgId = (existing.rows[0] as any).id;
            }
          }

          if (newOrgId) {
            await db.execute(sql`
              UPDATE users
              SET organization_id = ${newOrgId},
                  org_role        = 'admin',
                  updated_at      = NOW()
              WHERE id = ${user.id}
            `);
          }
        }
      } else {
        // User already has an org_id assigned (employee member) — ensure they're marked onboarded.
        // Employees don't need the business setup wizard.
        await db.execute(sql`
          UPDATE users
          SET onboarded  = true,
              updated_at = NOW()
          WHERE id = ${user.id}
            AND onboarded IS DISTINCT FROM true
        `);
      }
    }
  } catch (err) {
    logger.error({ err }, "requireAuth: DB upsert failed");
    return res.status(500).json({ error: "Server error during authentication" });
  }

  next();
}

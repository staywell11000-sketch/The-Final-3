import { Router } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger"

const router = Router();

// Public — used for precise auth error messages (no token needed)
router.post("/auth/check-email", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

  try {
    const rows = await db.execute(
      sql`SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase().trim()} LIMIT 1`
    );
    return res.json({ exists: rows.rows.length > 0 });
  } catch (err) {
    logger.error({ err }, "check-email error");
    return res.json({ exists: false });
  }
});

router.get("/users/me", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId));
    if (!user) {
      return void res.status(404).json({ error: "User not found" });
    }
    return void res.json(user);
  } catch (err) {
    return void res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.put("/users/me", requireAuth, async (req: any, res) => {
  try {
    const { email, firstName, lastName, title, phone, avatarUrl, onboarded } = req.body;

    const [existing] = await db.select().from(users).where(eq(users.id, req.userId));

    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          ...(email !== undefined && { email }),
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(title !== undefined && { title }),
          ...(phone !== undefined && { phone }),
          ...(avatarUrl !== undefined && { avatarUrl }),
          ...(onboarded !== undefined && { onboarded }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.userId))
        .returning();
      return void res.json(updated);
    }

    const [created] = await db
      .insert(users)
      .values({
        id: req.userId,
        email: email || "",
        firstName,
        lastName,
        role: "agent",
        title,
        phone,
        avatarUrl,
        onboarded: onboarded ?? false,
      })
      .returning();
    return void res.status(201).json(created);
  } catch (err) {
    return void res.status(500).json({ error: "Failed to save user" });
  }
});

export default router;

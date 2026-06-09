import { Router, type IRouter } from "express";
import { db, automations, automationLogs } from "@workspace/db";
import { eq, desc, and, or, isNull, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { fireTrigger } from "../services/automationEngine";

const router: IRouter = Router();

router.get("/automations", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const rows = await db
      .select()
      .from(automations)
      .where(or(eq(automations.createdById, userId), isNull(automations.createdById)))
      .orderBy(desc(automations.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch automations" });
  }
});

router.get("/automations/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const [row] = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, id),
          or(eq(automations.createdById, userId), isNull(automations.createdById))
        )
      );
    if (!row) return void res.status(404).json({ error: "Automation not found" });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to fetch automation" });
  }
});

router.post("/automations", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const { name, description, triggerType, triggerConfig, conditions, actions, isActive } = req.body;
    if (!name || !triggerType) {
      return void res.status(400).json({ error: "name and triggerType are required" });
    }
    const [row] = await db
      .insert(automations)
      .values({
        name,
        description: description ?? null,
        triggerType,
        triggerConfig: triggerConfig ?? {},
        conditions: conditions ?? [],
        actions: actions ?? [],
        isActive: isActive ?? false,
        createdById: userId,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("Create automation error:", err);
    res.status(500).json({ error: "Failed to create automation" });
  }
});

router.put("/automations/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const { id: _id, createdAt: _c, createdById: _cb, ...body } = req.body;
    const [row] = await db
      .update(automations)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(automations.id, id),
          or(eq(automations.createdById, userId), isNull(automations.createdById))
        )
      )
      .returning();
    if (!row) return void res.status(404).json({ error: "Automation not found" });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update automation" });
  }
});

router.patch("/automations/:id/toggle", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const [current] = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, id),
          or(eq(automations.createdById, userId), isNull(automations.createdById))
        )
      );
    if (!current) return void res.status(404).json({ error: "Not found" });
    const [row] = await db
      .update(automations)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to toggle automation" });
  }
});

router.delete("/automations/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const deleted = await db
      .delete(automations)
      .where(
        and(
          eq(automations.id, id),
          or(eq(automations.createdById, userId), isNull(automations.createdById))
        )
      )
      .returning();
    if (!deleted.length) return void res.status(404).json({ error: "Automation not found" });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete automation" });
  }
});

// ── Clone ───────────────────────────────────────────────────────────────────
router.post("/automations/:id/clone", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const [original] = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, id), or(eq(automations.createdById, userId), isNull(automations.createdById))));
    if (!original) return void res.status(404).json({ error: "Automation not found" });
    const [cloned] = await db.insert(automations).values({
      name:          `${original.name} (Copy)`,
      description:   original.description,
      triggerType:   original.triggerType,
      triggerConfig: (original.triggerConfig ?? {}) as Record<string, unknown>,
      conditions:    (original.conditions ?? []) as Array<{ field: string; operator: string; value: unknown }>,
      actions:       (original.actions ?? []) as Array<{ type: string; config: Record<string, unknown> }>,
      isActive:      false,
      createdById:   userId,
    }).returning();
    res.status(201).json(cloned);
  } catch (err) {
    console.error("Clone automation error:", err);
    res.status(500).json({ error: "Failed to clone automation" });
  }
});

router.post("/automations/:id/test", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const [automation] = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.id, id),
          or(eq(automations.createdById, userId), isNull(automations.createdById))
        )
      );
    if (!automation) return void res.status(404).json({ error: "Not found" });
    const wasActive = automation.isActive;
    if (!wasActive) {
      await db.update(automations).set({ isActive: true }).where(eq(automations.id, id));
    }
    await fireTrigger({
      triggerType: automation.triggerType as "lead_created" | "lead_status_changed" | "message_received" | "lead_score_updated",
      leadId: req.body.leadId ?? undefined,
      userId: req.body.userId ?? undefined,
    });
    if (!wasActive) {
      await db.update(automations).set({ isActive: wasActive }).where(eq(automations.id, id));
    }
    res.json({ message: "Test trigger fired" });
  } catch (err) {
    console.error("Test trigger error:", err);
    res.status(500).json({ error: "Failed to test automation" });
  }
});

router.get("/automation-logs", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const automationId = req.query.automationId ? parseInt(req.query.automationId as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Only return logs for automations belonging to this user
    const userAutomations = await db
      .select({ id: automations.id })
      .from(automations)
      .where(or(eq(automations.createdById, userId), isNull(automations.createdById)));

    const userAutomationIds = userAutomations.map((a) => a.id);

    if (userAutomationIds.length === 0) {
      return void res.json([]);
    }

    let rows;
    if (automationId && !isNaN(automationId) && userAutomationIds.includes(automationId)) {
      rows = await db
        .select()
        .from(automationLogs)
        .where(eq(automationLogs.automationId, automationId))
        .orderBy(desc(automationLogs.createdAt))
        .limit(limit);
    } else {
      // No specific automationId — return logs only for this user's automations
      rows = await db
        .select()
        .from(automationLogs)
        .where(inArray(automationLogs.automationId, userAutomationIds))
        .orderBy(desc(automationLogs.createdAt))
        .limit(limit);
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch automation logs" });
  }
});

export default router;

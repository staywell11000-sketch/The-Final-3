import { Router, type IRouter } from "express";
import { db, deals, leadsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { createNotification } from "../services/notificationService";

const router: IRouter = Router();

type DealRow = typeof deals.$inferSelect;

function sanitizeDeal(row: DealRow & { leadName?: string | null }) {
  return {
    ...row,
    value: row.value ? String(row.value) : null,
    commission: row.commission ? String(row.commission) : null,
    commissionRate: row.commissionRate ? String(row.commissionRate) : null,
    tags: row.tags ?? [],
    notes: row.notes ?? "",
    lostReason: row.lostReason ?? null,
    status: row.stage === "won" || row.stage === "lost" ? "closed" : "active",
    leadName: (row as any).leadName ?? null,
  };
}

router.get("/deals", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 500));
  const page = Math.max(1, Number(req.query.page) || 1);
  const stage = req.query.stage as string | undefined;

  try {
    const conditions = [eq(deals.createdById, userId)];
    if (stage && stage !== "all") conditions.push(eq(deals.stage, stage as any));

    const rows = await db
      .select({
        id: deals.id,
        title: deals.title,
        leadId: deals.leadId,
        propertyId: deals.propertyId,
        assignedToId: deals.assignedToId,
        createdById: deals.createdById,
        dealerId: deals.dealerId,
        stage: deals.stage,
        value: deals.value,
        commission: deals.commission,
        commissionRate: deals.commissionRate,
        probability: deals.probability,
        expectedCloseDate: deals.expectedCloseDate,
        closedAt: deals.closedAt,
        lostReason: deals.lostReason,
        notes: deals.notes,
        tags: deals.tags,
        metadata: deals.metadata,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        leadName: leadsTable.name,
      })
      .from(deals)
      .leftJoin(leadsTable, eq(deals.leadId, leadsTable.id))
      .where(and(...conditions))
      .orderBy(sql`${deals.createdAt} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json(rows.map(sanitizeDeal));
  } catch (err) {
    console.error("Deals fetch error:", err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

router.get("/deals/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });

  try {
    const [row] = await db
      .select({
        id: deals.id,
        title: deals.title,
        leadId: deals.leadId,
        propertyId: deals.propertyId,
        assignedToId: deals.assignedToId,
        createdById: deals.createdById,
        dealerId: deals.dealerId,
        stage: deals.stage,
        value: deals.value,
        commission: deals.commission,
        commissionRate: deals.commissionRate,
        probability: deals.probability,
        expectedCloseDate: deals.expectedCloseDate,
        closedAt: deals.closedAt,
        lostReason: deals.lostReason,
        notes: deals.notes,
        tags: deals.tags,
        metadata: deals.metadata,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        leadName: leadsTable.name,
      })
      .from(deals)
      .leftJoin(leadsTable, eq(deals.leadId, leadsTable.id))
      .where(and(eq(deals.id, id), eq(deals.createdById, userId)));

    if (!row) return void res.status(404).json({ error: "Deal not found" });
    res.json(sanitizeDeal(row));
  } catch (err) {
    console.error("Deal fetch error:", err);
    res.status(500).json({ error: "Failed to fetch deal" });
  }
});

router.post("/deals", requireAuth, async (req, res) => {
  try {
    const { id: _id, createdAt: _c, updatedAt: _u, status: _s, leadName: _ln, ...body } = req.body;
    const userId = (req as any).userId;

    const [row] = await db
      .insert(deals)
      .values({
        ...body,
        createdById: userId,
        assignedToId: body.assignedToId ?? userId,
        stage: body.stage ?? "new",
      })
      .returning();

    res.status(201).json(sanitizeDeal(row));
  } catch (err) {
    console.error("Deal create error:", err);
    res.status(500).json({ error: "Failed to create deal" });
  }
});

router.patch("/deals/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });

  try {
    const { id: _id, createdAt: _c, updatedAt: _u, status: _s, leadName: _ln, createdById: _cb, ...body } = req.body;

    const updateData: Partial<typeof deals.$inferInsert> = {
      ...body,
      updatedAt: new Date(),
    };

    if (body.stage === "won" || body.stage === "lost") {
      updateData.closedAt = new Date();
    }

    const prevRows = await db.select({ stage: deals.stage, createdById: deals.createdById })
      .from(deals).where(and(eq(deals.id, id), eq(deals.createdById, userId))).limit(1);
    const prevStage = prevRows[0]?.stage;

    const [row] = await db
      .update(deals)
      .set(updateData)
      .where(and(eq(deals.id, id), eq(deals.createdById, userId)))
      .returning();

    if (!row) return void res.status(404).json({ error: "Deal not found" });
    res.json(sanitizeDeal(row));

    // Fire notification when stage changes
    const ownerId = (req as any).userId ?? prevRows[0]?.createdById;
    if (ownerId && body.stage && body.stage !== prevStage) {
      const stageLabel: Record<string, string> = {
        new: "New", qualified: "Qualified", proposal: "Proposal",
        negotiation: "Negotiation", "due_diligence": "Due Diligence",
        won: "Won", lost: "Lost",
      };
      createNotification({
        userId: ownerId,
        type: "deal",
        title: `Deal stage updated — ${row.title}`,
        body: `Moved from ${stageLabel[prevStage ?? ""] ?? prevStage} → ${stageLabel[body.stage] ?? body.stage}`,
        actionUrl: `/dashboard/deals`,
        metadata: { dealId: id, fromStage: prevStage, toStage: body.stage },
      }).catch(() => {});
    }
  } catch (err) {
    console.error("Deal update error:", err);
    res.status(500).json({ error: "Failed to update deal" });
  }
});

router.delete("/deals/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  const userId: string = req.userId;
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });

  try {
    await db.delete(deals).where(and(eq(deals.id, id), eq(deals.createdById, userId)));
    res.status(204).send();
  } catch (err) {
    console.error("Deal delete error:", err);
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

export default router;

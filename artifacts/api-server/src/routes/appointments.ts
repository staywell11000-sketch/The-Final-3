import { Router, type IRouter } from "express";
import { db, appointments, leadsTable, deals } from "@workspace/db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/appointments", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { month, year, leadId, dealId } = req.query;

    let conditions = [eq(appointments.userId, userId)];

    if (month !== undefined && year !== undefined) {
      const m = parseInt(month as string, 10);
      const y = parseInt(year as string, 10);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      conditions.push(gte(appointments.dateTime, start));
      conditions.push(lte(appointments.dateTime, end));
    }

    if (leadId) {
      conditions.push(eq(appointments.leadId, parseInt(leadId as string, 10)));
    }

    if (dealId) {
      conditions.push(eq(appointments.dealId, parseInt(dealId as string, 10)));
    }

    const rows = await db
      .select({
        appointment: appointments,
        leadName: leadsTable.name,
        dealTitle: deals.title,
      })
      .from(appointments)
      .leftJoin(leadsTable, eq(appointments.leadId, leadsTable.id))
      .leftJoin(deals, eq(appointments.dealId, deals.id))
      .where(and(...conditions))
      .orderBy(appointments.dateTime);

    const result = rows.map(({ appointment, leadName, dealTitle }) => ({
      ...appointment,
      leadName: leadName ?? null,
      dealTitle: dealTitle ?? null,
    }));

    res.json(result);
  } catch (err) {
    console.error("Fetch appointments error:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/appointments/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const userId = (req as any).userId as string;
    const rows = await db
      .select({
        appointment: appointments,
        leadName: leadsTable.name,
        dealTitle: deals.title,
      })
      .from(appointments)
      .leftJoin(leadsTable, eq(appointments.leadId, leadsTable.id))
      .leftJoin(deals, eq(appointments.dealId, deals.id))
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));

    if (!rows[0]) return void res.status(404).json({ error: "Appointment not found" });

    const { appointment, leadName, dealTitle } = rows[0];
    res.json({ ...appointment, leadName: leadName ?? null, dealTitle: dealTitle ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

router.post("/appointments", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { leadId, dealId, title, description, dateTime, duration, location, reminderAt } = req.body;

    if (!title || !dateTime) {
      return void res.status(400).json({ error: "title and dateTime are required" });
    }

    const [row] = await db
      .insert(appointments)
      .values({
        userId,
        leadId: leadId ? parseInt(leadId, 10) : null,
        dealId: dealId ? parseInt(dealId, 10) : null,
        title,
        description: description ?? null,
        dateTime: new Date(dateTime),
        duration: duration ? parseInt(duration, 10) : 60,
        location: location ?? null,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    console.error("Create appointment error:", err);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.patch("/appointments/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const userId = (req as any).userId as string;
    const { id: _id, createdAt: _c, userId: _u, ...body } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.dateTime !== undefined) updates.dateTime = new Date(body.dateTime);
    if (body.duration !== undefined) updates.duration = parseInt(body.duration, 10);
    if (body.location !== undefined) updates.location = body.location;
    if (body.leadId !== undefined) updates.leadId = body.leadId ? parseInt(body.leadId, 10) : null;
    if (body.dealId !== undefined) updates.dealId = body.dealId ? parseInt(body.dealId, 10) : null;
    if (body.reminderAt !== undefined) updates.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;

    const [row] = await db
      .update(appointments)
      .set(updates)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
      .returning();

    if (!row) return void res.status(404).json({ error: "Appointment not found" });
    res.json(row);
  } catch (err) {
    console.error("Update appointment error:", err);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return void res.status(400).json({ error: "Invalid ID" });
  try {
    const userId = (req as any).userId as string;
    await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

export default router;

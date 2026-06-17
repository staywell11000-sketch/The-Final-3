import { Router } from "express";
import { db } from "@workspace/db";
import { dealers } from "@workspace/db/schema";
import { eq, ilike, and, or, desc, asc, count, SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/dealers", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const dealerType = req.query.dealerType as string | undefined;
    const sort = (req.query.sort as string) || "newest";

    const conditions: SQL[] = [eq(dealers.userId, userId)];
    if (search) {
      conditions.push(
        or(
          ilike(dealers.name, `%${search}%`),
          ilike(dealers.company ?? "", `%${search}%`),
          ilike(dealers.phone, `%${search}%`),
          ilike(dealers.email ?? "", `%${search}%`),
        )!,
      );
    }
    if (status && status !== "all") {
      conditions.push(eq(dealers.status, status));
    }
    if (dealerType && dealerType !== "all") {
      conditions.push(eq(dealers.dealerType, dealerType));
    }

    const where = and(...conditions);
    const orderBy = sort === "leads"
      ? desc(dealers.totalLeads)
      : sort === "deals"
      ? desc(dealers.totalDeals)
      : sort === "oldest"
      ? asc(dealers.createdAt)
      : desc(dealers.createdAt);

    const [rows, totalResult] = await Promise.all([
      db.select().from(dealers).where(where).orderBy(orderBy)
        .limit(pageSize).offset((page - 1) * pageSize),
      db.select({ count: count() }).from(dealers).where(where),
    ]);

    res.json({
      data: rows,
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
      totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / pageSize),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list dealers" });
  }
});

router.post("/dealers", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const body = req.body;
    const [row] = await db.insert(dealers).values({
      userId,
      name: body.name,
      company: body.company || null,
      phone: body.phone || "",
      email: body.email || "",
      location: body.location || "",
      dealerType: body.dealerType || "individual",
      profileImage: body.profileImage || null,
      status: body.status || "active",
      notes: body.notes || null,
      updatedAt: new Date(),
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create dealer" });
  }
});

router.get("/dealers/:id", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    const [row] = await db.select().from(dealers)
      .where(and(eq(dealers.id, id), eq(dealers.userId, userId)))
      .limit(1);

    if (!row) return void res.status(404).json({ error: "Dealer not found" });
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to get dealer" });
  }
});

router.put("/dealers/:id", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    const body = req.body;
    const [row] = await db.update(dealers).set({
      name: body.name,
      company: body.company || null,
      phone: body.phone,
      email: body.email,
      location: body.location,
      dealerType: body.dealerType,
      profileImage: body.profileImage || null,
      status: body.status,
      notes: body.notes || null,
      updatedAt: new Date(),
    }).where(and(eq(dealers.id, id), eq(dealers.userId, userId))).returning();

    if (!row) return void res.status(404).json({ error: "Dealer not found" });
<<<<<<< HEAD
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update dealer" });
=======
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update dealer" });
>>>>>>> 17c38ff (Initial CRM commit)
  }
});

router.patch("/dealers/:id/status", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    const { status } = req.body;
    if (!status) return void res.status(400).json({ error: "status required" });

    const [row] = await db.update(dealers).set({ status, updatedAt: new Date() })
      .where(and(eq(dealers.id, id), eq(dealers.userId, userId))).returning();

    if (!row) return void res.status(404).json({ error: "Dealer not found" });
<<<<<<< HEAD
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
=======
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update status" });
>>>>>>> 17c38ff (Initial CRM commit)
  }
});

router.delete("/dealers/:id", requireAuth, async (req: any, res) => {
  const userId: string = req.userId;
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid id" });

    await db.delete(dealers).where(and(eq(dealers.id, id), eq(dealers.userId, userId)));
<<<<<<< HEAD
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete dealer" });
=======
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to delete dealer" });
>>>>>>> 17c38ff (Initial CRM commit)
  }
});

export default router;

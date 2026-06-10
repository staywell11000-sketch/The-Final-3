import { schedule } from "node-cron";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

async function expireSubscriptions() {
  try {
    const result = await db.execute<{ id: string; name: string }>(sql`
      UPDATE organizations
      SET
        plan = 'free',
        subscription_status = 'expired',
        updated_at = NOW()
      WHERE
        subscription_status = 'active'
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
      RETURNING id, name
    `);

    if (result.rows.length > 0) {
      logger.info(
        { count: result.rows.length, orgs: result.rows.map((r: any) => r.name) },
        "plan-expiry: downgraded expired subscriptions to free"
      );
    }
  } catch (err) {
    logger.error({ err }, "plan-expiry: error checking subscriptions");
  }
}

export function startPlanExpiryJob() {
  // Run at midnight every day
  schedule("0 0 * * *", async () => {
    logger.info("plan-expiry: running nightly subscription expiry check");
    await expireSubscriptions();
  });

  // Also run once at startup to catch any that expired since last check
  expireSubscriptions().then(() => {
    logger.info("plan-expiry: startup check complete");
  });

  logger.info("Plan expiry job scheduled (daily at midnight)");
}

import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsAppReconciliationJob } from "./jobs/whatsappReconciliation";
import { startMetaLeadSyncJob } from "./services/metaLeadSync";
import { startNightlyAIAnalysisJob } from "./jobs/nightlyAIAnalysis";
import { startPlanExpiryJob } from "./jobs/planExpiry";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startWhatsAppReconciliationJob();
  startMetaLeadSyncJob();
  startNightlyAIAnalysisJob();
  startPlanExpiryJob();
});

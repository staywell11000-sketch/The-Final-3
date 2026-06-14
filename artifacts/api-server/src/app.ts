import express, { type Express, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// ── Startup env var checks ────────────────────────────────
const requiredWhatsAppVars = [
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "FACEBOOK_APP_SECRET",
];

for (const v of requiredWhatsAppVars) {
  if (!process.env[v]) {
    logger.warn(
      `Missing env var: ${v} — WhatsApp webhook functionality will be degraded. Set it in your environment secrets.`,
    );
  }
}

const app: Express = express();

app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(
  express.json({
    limit: "15mb",
    verify: (req: any, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

export default app;
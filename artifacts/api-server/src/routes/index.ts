import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import usersRouter from "./users";
import propertiesRouter from "./properties";
import storageRouter from "./storage";
import connectedAccountsRouter from "./connectedAccounts";
import whatsappRouter from "./whatsapp";
import leadSyncRouter from "./leadSync";
import activitiesRouter from "./activities";
import aiRouter from "./ai";
import automationsRouter from "./automations";
import analyticsRouter from "./analytics";
import dealsRouter from "./deals";
import teamMembersRouter from "./teamMembers";
import documentsRouter from "./documents";
import appointmentsRouter from "./appointments";
import settingsRouter from "./settings";
import notificationsRouter from "./notifications";
import dealersRouter from "./dealers";
import organizationsRouter from "./organizations";
import paymentRequestsRouter from "./paymentRequests";
import plansRouter from "./plans";
import auditLogsRouter from "./auditLogs";
import addonsRouter from "./addons";
import facebookRouter from "./facebook";
import invitationsRouter from "./invitations";
import orgMembersRouter from "./orgMembers";
import supportRouter from "./support";
import privacyRouter from "./privacy";
import onboardingRouter from "./onboarding";
import whatsappAccountsRouter from "./whatsappAccounts";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "LuxEstate API",
  });
});

router.use(healthRouter);
router.use(leadsRouter);
router.use(usersRouter);
router.use(propertiesRouter);
router.use(storageRouter);
router.use(connectedAccountsRouter);
router.use(whatsappRouter);
router.use(leadSyncRouter);
router.use(activitiesRouter);
router.use(aiRouter);
router.use(automationsRouter);
router.use(analyticsRouter);
router.use(dealsRouter);
router.use(teamMembersRouter);
router.use(documentsRouter);
router.use(appointmentsRouter);
router.use(settingsRouter);
router.use(notificationsRouter);
router.use(dealersRouter);
router.use(organizationsRouter);
router.use(paymentRequestsRouter);
router.use(plansRouter);
router.use(auditLogsRouter);
router.use(addonsRouter);
router.use(facebookRouter);
router.use(invitationsRouter);
router.use(orgMembersRouter);
router.use(supportRouter);
router.use(privacyRouter);
router.use(onboardingRouter);
router.use(whatsappAccountsRouter);

export default router;

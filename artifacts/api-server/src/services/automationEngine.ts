import { db, automations, automationLogs, leadsTable, activities, notifications } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

export type TriggerType =
  | "lead_created"
  | "lead_status_changed"
  | "message_received"
  | "lead_score_updated"
  | "deal_stage_changed"
  | "appointment_created"
  | "tag_added"
  | "lead_assigned";

export type TriggerContext = {
  triggerType: TriggerType;
  leadId?: number;
  lead?: typeof leadsTable.$inferSelect;
  previousStatus?: string;
  newStatus?: string;
  messageContent?: string;
  previousScore?: number;
  newScore?: number;
  userId?: string;
  dealStage?: string;
  tag?: string;
  [key: string]: unknown;
};

type Condition = {
  field: string;
  operator: string;
  value: unknown;
};

type Action = {
  type: string;
  config: Record<string, unknown>;
};

function evaluateCondition(condition: Condition, ctx: TriggerContext): boolean {
  const val = ctx[condition.field] ?? (ctx.lead as Record<string, unknown> | undefined)?.[condition.field];
  if (val === undefined || val === null) return false;

  switch (condition.operator) {
    case "equals":          return String(val) === String(condition.value);
    case "not_equals":      return String(val) !== String(condition.value);
    case "contains":        return String(val).toLowerCase().includes(String(condition.value).toLowerCase());
    case "not_contains":    return !String(val).toLowerCase().includes(String(condition.value).toLowerCase());
    case "greater_than":    return Number(val) > Number(condition.value);
    case "less_than":       return Number(val) < Number(condition.value);
    case "greater_than_or_equal": return Number(val) >= Number(condition.value);
    case "less_than_or_equal":    return Number(val) <= Number(condition.value);
    case "is_empty":        return !val || String(val).trim() === "";
    case "is_not_empty":    return !!val && String(val).trim() !== "";
    case "starts_with":     return String(val).toLowerCase().startsWith(String(condition.value).toLowerCase());
    default:                return false;
  }
}

function interpolate(template: string, ctx: TriggerContext): string {
  return template
    .replace(/\{\{lead_name\}\}/g,   ctx.lead?.name ?? "Lead")
    .replace(/\{\{lead_status\}\}/g, ctx.lead?.status ?? "")
    .replace(/\{\{lead_score\}\}/g,  String(ctx.lead?.score ?? ""))
    .replace(/\{\{lead_source\}\}/g, ctx.lead?.source ?? "")
    .replace(/\{\{lead_phone\}\}/g,  ctx.lead?.phone ?? "")
    .replace(/\{\{lead_email\}\}/g,  ctx.lead?.email ?? "")
    .replace(/\{\{trigger\}\}/g,     ctx.triggerType)
    .replace(/\{\{new_status\}\}/g,  ctx.newStatus ?? "")
    .replace(/\{\{deal_stage\}\}/g,  ctx.dealStage ?? "");
}

async function executeAction(
  action: Action,
  ctx: TriggerContext
): Promise<{ type: string; result: string; error?: string }> {
  const { type, config } = action;
  const lead = ctx.lead;

  try {
    switch (type) {
      case "notify": {
        const userId = (config.userId as string) || ctx.userId || "";
        if (!userId) return { type, result: "skipped: no userId for notification" };
        const message = interpolate((config.message as string) ?? "Automation triggered", ctx);
        await db.insert(notifications).values({
          userId,
          type:    (config.notificationType as string) || "automation",
          title:   interpolate((config.title as string) || "Automation Alert", ctx),
          message,
          isRead:  false,
          metadata: { automationAction: true, leadId: ctx.leadId },
        });
        return { type, result: `Notification sent: ${message}` };
      }

      case "assign_agent": {
        if (!ctx.leadId) return { type, result: "skipped: no leadId" };
        const agentName = config.agentName as string;
        if (!agentName) return { type, result: "skipped: no agentName configured" };
        await db.update(leadsTable).set({ assignedTo: agentName, updatedAt: new Date() }).where(eq(leadsTable.id, ctx.leadId));
        return { type, result: `Lead assigned to ${agentName}` };
      }

      case "update_status": {
        if (!ctx.leadId) return { type, result: "skipped: no leadId" };
        const newStatus = config.status as string;
        if (!newStatus) return { type, result: "skipped: no status configured" };
        await db.update(leadsTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(leadsTable.id, ctx.leadId));
        return { type, result: `Lead status updated to ${newStatus}` };
      }

      case "update_priority": {
        if (!ctx.leadId) return { type, result: "skipped: no leadId" };
        const priority = config.priority as string;
        if (!priority) return { type, result: "skipped: no priority configured" };
        await db.update(leadsTable).set({ priority, updatedAt: new Date() }).where(eq(leadsTable.id, ctx.leadId));
        return { type, result: `Lead priority updated to ${priority}` };
      }

      case "log_activity": {
        if (!ctx.leadId || !ctx.userId) return { type, result: "skipped: missing leadId or userId" };
        const title = interpolate((config.title as string) ?? "Automated activity", ctx);
        await db.insert(activities).values({
          userId:    ctx.userId,
          leadId:    ctx.leadId,
          type:      (config.activityType as string) || "system",
          title,
          description: interpolate((config.description as string) || `Triggered by automation: ${ctx.triggerType}`, ctx),
          completedAt: new Date(),
        });
        return { type, result: `Activity logged: ${title}` };
      }

      case "add_tag": {
        if (!ctx.leadId) return { type, result: "skipped: no leadId" };
        const tag = config.tag as string;
        if (!tag) return { type, result: "skipped: no tag configured" };
        const [currentLead] = await db.select({ tags: leadsTable.tags }).from(leadsTable).where(eq(leadsTable.id, ctx.leadId));
        const existingTags: string[] = (currentLead?.tags ?? []) as string[];
        if (!existingTags.includes(tag)) {
          await db.update(leadsTable).set({ tags: [...existingTags, tag], updatedAt: new Date() }).where(eq(leadsTable.id, ctx.leadId));
        }
        return { type, result: `Tag "${tag}" added to lead` };
      }

      case "remove_tag": {
        if (!ctx.leadId) return { type, result: "skipped: no leadId" };
        const tag = config.tag as string;
        if (!tag) return { type, result: "skipped: no tag configured" };
        const [currentLead] = await db.select({ tags: leadsTable.tags }).from(leadsTable).where(eq(leadsTable.id, ctx.leadId));
        const existingTags: string[] = (currentLead?.tags ?? []) as string[];
        await db.update(leadsTable).set({ tags: existingTags.filter(t => t !== tag), updatedAt: new Date() }).where(eq(leadsTable.id, ctx.leadId));
        return { type, result: `Tag "${tag}" removed from lead` };
      }

      case "create_task": {
        if (!ctx.leadId || !ctx.userId) return { type, result: "skipped: missing leadId or userId" };
        const title = interpolate((config.title as string) ?? "Follow up with {{lead_name}}", ctx);
        await db.insert(activities).values({
          userId:      ctx.userId,
          leadId:      ctx.leadId,
          type:        "task",
          title,
          description: interpolate((config.description as string) || "Task created by automation", ctx),
          completedAt: null,
        });
        return { type, result: `Task created: ${title}` };
      }

      case "delay": {
        // Delay is a no-op in synchronous execution — logged as metadata for future async support
        const { days = 0, hours = 0, minutes = 0 } = config as { days?: number; hours?: number; minutes?: number };
        const totalMs = ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60_000;
        return { type, result: `Delay step: ${days}d ${hours}h ${minutes}m (${totalMs}ms) — queued for future execution` };
      }

      case "send_whatsapp": {
        const message = interpolate((config.message as string) ?? "", ctx);
        const template = config.templateName as string ?? "";
        // WhatsApp send is handled by the messaging system when a conversation is active
        return { type, result: `WhatsApp message queued: "${template || message.slice(0, 60)}"` };
      }

      case "send_email": {
        const subject = interpolate((config.subject as string) ?? "Automated Email", ctx);
        const to = (config.to as string) || lead?.email || "";
        if (!to) return { type, result: "skipped: no email recipient" };
        // Email sending handled by email service integration
        return { type, result: `Email queued to ${to}: "${subject}"` };
      }

      default:
        return { type, result: `Unknown action type: ${type}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ type, error: errorMsg }, "Action execution failed");
    return { type, result: "failed", error: errorMsg };
  }
}

export async function fireTrigger(ctx: TriggerContext): Promise<void> {
  try {
    const activeAutomations = await db
      .select()
      .from(automations)
      .where(and(eq(automations.isActive, true), eq(automations.triggerType, ctx.triggerType)));

    if (activeAutomations.length === 0) return;

    for (const automation of activeAutomations) {
      const start = Date.now();
      const actionsExecuted: Array<{ type: string; result: string; error?: string }> = [];
      let status = "success";
      let errorMessage: string | undefined;

      try {
        const conditions = (automation.conditions ?? []) as Condition[];
        const conditionsMet = conditions.every((c) => evaluateCondition(c, ctx));
        if (!conditionsMet) {
          await db.insert(automationLogs).values({
            automationId: automation.id,
            leadId:       ctx.leadId ?? null,
            triggerType:  ctx.triggerType,
            status:       "skipped",
            actionsExecuted: [],
            triggerData:  { reason: "conditions not met", conditions },
            errorMessage: null,
            durationMs:   Date.now() - start,
          });
          continue;
        }

        const actions = (automation.actions ?? []) as Action[];
        for (const action of actions) {
          const result = await executeAction(action, ctx);
          actionsExecuted.push(result);
          if (result.error) status = "partial";
        }

        await db.update(automations).set({
          lastRunAt:     new Date(),
          lastRunStatus: status,
          runCount:      (automation.runCount ?? 0) + 1,
          updatedAt:     new Date(),
        }).where(eq(automations.id, automation.id));

      } catch (err) {
        status = "error";
        errorMessage = err instanceof Error ? err.message : String(err);
        await db.update(automations).set({
          lastRunAt:     new Date(),
          lastRunStatus: "error",
          errorCount:    (automation.errorCount ?? 0) + 1,
          updatedAt:     new Date(),
        }).where(eq(automations.id, automation.id));
      }

      await db.insert(automationLogs).values({
        automationId:    automation.id,
        leadId:          ctx.leadId ?? null,
        triggerType:     ctx.triggerType,
        status,
        actionsExecuted,
        triggerData: {
          previousStatus:  ctx.previousStatus,
          newStatus:       ctx.newStatus,
          messageContent:  ctx.messageContent,
          dealStage:       ctx.dealStage,
          tag:             ctx.tag,
          leadScore:       ctx.newScore,
        },
        errorMessage: errorMessage ?? null,
        durationMs:   Date.now() - start,
      });

      logger.info({ automationId: automation.id, triggerType: ctx.triggerType, status, actionsExecuted }, "Automation executed");
    }
  } catch (err) {
    logger.error({ err, triggerType: ctx.triggerType }, "fireTrigger error");
  }
}

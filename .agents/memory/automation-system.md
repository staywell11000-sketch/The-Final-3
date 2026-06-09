---
name: Automation Template Customization System
description: Full architecture of the automation engine, API, and frontend — triggers, actions, editor, templates, logs.
---

# Automation System Architecture

## DB Schema (no changes needed — existing schema is complete)
- `automations` table: name, description, triggerType, triggerConfig (jsonb), conditions (jsonb[]), actions (jsonb[]), isActive, createdById, lastRunAt, lastRunStatus, runCount, errorCount, metadata
- `automation_logs` table: automationId, leadId, triggerType, status, actionsExecuted, triggerData, errorMessage, durationMs

## Engine Trigger Types (automationEngine.ts)
```
lead_created | lead_status_changed | message_received | lead_score_updated
| deal_stage_changed | appointment_created | tag_added | lead_assigned
```

## Engine Action Types (automationEngine.ts)
```
notify | assign_agent | update_status | update_priority | log_activity
| add_tag | remove_tag | create_task | delay | send_whatsapp | send_email
```
- `delay` is a no-op synchronously — logged as metadata for future async support
- `send_whatsapp` and `send_email` are queued — real sending needs messaging service integration
- All string configs support `{{lead_name}}`, `{{lead_status}}`, `{{lead_score}}`, `{{lead_source}}`, `{{lead_phone}}`, `{{lead_email}}`, `{{trigger}}`, `{{new_status}}`, `{{deal_stage}}` interpolation

## API Routes (all no /api prefix)
- GET/POST `/automations` — list (user's + null createdById) / create
- GET/PUT/DELETE `/automations/:id` — single / update / delete  
- PATCH `/automations/:id/toggle` — flip isActive
- POST `/automations/:id/clone` — duplicate with "(Copy)" suffix, isActive=false
- POST `/automations/:id/test` — fire trigger for the automation's triggerType
- GET `/automation-logs?automationId=&limit=` — filtered to user's automations only

## Frontend Hooks (automations-api.ts)
useAutomations, useAutomationLogs, useCreateAutomation, useUpdateAutomation,
useToggleAutomation, useDeleteAutomation, useCloneAutomation, useTestAutomation

## Frontend Page (automations.tsx) — 4 tabs
1. **My Automations** — real DB list; each card has toggle/edit/clone/delete/test/inline-logs
2. **Templates** — 7 hardcoded templates, "Use Template" → POST /automations → real DB record
3. **Builder** — FlowEditor in create mode; saves to DB via POST /automations
4. **Logs** — real /automation-logs data with status badges, action results, error details

## FlowEditor Component
- TRIGGER block: Select trigger type + trigger-specific config (minScore for score_updated, fromStatus/toStatus for status_changed, tag for tag_added)
- CONDITIONS block: unlimited AND conditions (field, operator, value) — 11 operators
- ACTIONS block: unlimited actions in sequence; each action has ActionConfigEditor per type
- ActionConfigEditor renders different fields per action type (textarea, selects, number inputs)

## 7 Templates (client-side, created as real DB records on "Use Template")
Lead Assignment, WhatsApp Welcome, Follow-Up Workflow, Appointment Reminder,
Auto-Assign Hot Leads, Re-Engagement Campaign, Deal Stage Notification

**Why:** Templates are defined client-side (not in DB) so they always show in the library even after being used. "Use Template" creates a new editable DB copy — users can use the same template multiple times with different customizations.

**How to apply:** To add new templates, append to the TEMPLATES array in automations.tsx. Each template needs: name, description, icon, triggerType, conditions[], actions[].

## Skipped Conditions Logging
When conditions are NOT met, a "skipped" log entry is written (status: "skipped") — this helps users debug why automations aren't firing.

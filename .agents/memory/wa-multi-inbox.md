---
name: WhatsApp multi-inbox architecture
description: Full multi-inbox WA system — tables, API, plan limits, permissions panel, messages UI.
---

# WhatsApp Multi-Inbox Architecture

## DB Tables (3 new)
- `whatsapp_accounts` — org-level WA phone numbers
- `user_whatsapp_permissions` — per-user per-inbox access (can_view, can_reply, can_assign)
- `conversation_wa_accounts` — links conversations to specific inboxes

## Critical: DB column mismatch after recreation
The tables were originally created with wrong columns (can_send/can_manage_templates instead of can_reply/can_assign). Always verify against Drizzle schema files in `lib/db/src/schema/`:
- `whatsapp_accounts.ts` — needs: account_id, metadata, connected_at
- `user_whatsapp_permissions.ts` — needs: can_view, can_reply, can_assign (NOT can_send, can_manage_templates)
- Unique constraint on `user_whatsapp_permissions(user_id, whatsapp_account_id)` named `uwp_user_account_unique`

## Plan Limits (in whatsappAccounts.ts)
```
free=0, trial=1, starter=1, professional=3, agency=null (unlimited)
```

## API Routes (all in whatsappAccounts.ts, no /api prefix)
- GET `/whatsapp/accounts` — org accounts (owner/admin=all, others=permitted only)
- GET `/whatsapp/accounts/limit` — plan slot usage {used, limit, remaining, plan}
- POST `/whatsapp/accounts/connect` — EBS code → new account (checks plan limit)
- DELETE `/whatsapp/accounts/:id` — disconnect (deletes permissions first)
- GET `/whatsapp/accounts/:id/health` — live Meta API health check
- POST `/whatsapp/accounts/:id/templates/sync` — sync templates to metadata
- GET `/whatsapp/conversation-accounts` — conversationId→accountId map
- GET/PUT/DELETE `/whatsapp/permissions` — org member permissions management

## Frontend Hooks (whatsapp-accounts-api.ts)
useWaAccounts, useWaLimit, useConnectWaAccount, useDisconnectWaAccount, useSyncWaTemplates, useWaAccountHealth, useWaPermissions, useSetWaPermission, useRevokeWaPermission

## UI Components
- `WhatsAppSettingsTab.tsx` — multi-account cards + plan limit bar + connect button + team access panel
- `WhatsAppAccessPanel.tsx` — matrix: rows=team members, columns=WA accounts; 4-level dropdown (No Access/View/Reply/Full); owners+admins locked to full
- `messages.tsx` — inbox tabs above conversation list (All Inboxes / CRM / per WA account)
- `billing.tsx` — WhatsApp Numbers card with used/limit progress bar

## Permission Levels (WhatsAppAccessPanel)
- No Access: canView=false, canReply=false, canAssign=false → hides inbox completely
- View Only: canView=true, canReply=false, canAssign=false
- Can Reply: canView=true, canReply=true, canAssign=false
- Full Access: canView=true, canReply=true, canAssign=true
- Owners + admin org_role always bypass → show "Full Access" locked badge

**Why:** Spec requires complete inbox isolation — users must never see inboxes they don't have permission to, and conversations must never cross inboxes.

**How to apply:** When adding new permission checks in the messages page, always call /api/whatsapp/accounts (which already filters by permission for non-admins). Do not add client-side filtering on top — trust the server response.

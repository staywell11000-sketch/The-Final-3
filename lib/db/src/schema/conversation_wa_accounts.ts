import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const conversationWaAccounts = pgTable("conversation_wa_accounts", {
  conversationId:    varchar("conversation_id", { length: 255 }).primaryKey(),
  whatsappAccountId: integer("whatsapp_account_id").notNull(),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
});

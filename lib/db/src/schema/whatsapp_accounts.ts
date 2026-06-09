import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id:             serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  phoneNumber:    varchar("phone_number",    { length: 50 }),
  phoneNumberId:  varchar("phone_number_id", { length: 100 }),
  displayName:    text("display_name"),
  businessName:   text("business_name"),
  wabaId:         varchar("waba_id",   { length: 100 }),
  accountId:      text("account_id"),
  accessToken:    text("access_token"),
  status:         varchar("status", { length: 20 }).notNull().default("active"),
  connectedAt:    timestamp("connected_at").defaultNow(),
  lastSyncedAt:   timestamp("last_synced_at"),
  metadata:       text("metadata"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

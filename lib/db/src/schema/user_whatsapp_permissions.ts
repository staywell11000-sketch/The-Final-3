import { pgTable, serial, varchar, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const userWhatsappPermissions = pgTable("user_whatsapp_permissions", {
  id:                 serial("id").primaryKey(),
  userId:             varchar("user_id",              { length: 255 }).notNull(),
  whatsappAccountId:  integer("whatsapp_account_id").notNull(),
  canView:            boolean("can_view").notNull().default(true),
  canReply:           boolean("can_reply").notNull().default(true),
  canAssign:          boolean("can_assign").notNull().default(false),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique("uwp_user_account_unique").on(t.userId, t.whatsappAccountId),
}));

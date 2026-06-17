CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"role" varchar(50) DEFAULT 'agent' NOT NULL,
	"org_role" varchar(100) DEFAULT 'agent' NOT NULL,
	"title" varchar(255),
	"phone" varchar(50),
	"avatar_url" text,
	"onboarded" boolean DEFAULT false NOT NULL,
	"organization_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"invited_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '',
	"whatsapp_number" text DEFAULT '',
	"interested_properties" text[] DEFAULT '{}',
	"property" text DEFAULT '',
	"budget" text DEFAULT '',
	"status" text DEFAULT 'new' NOT NULL,
	"priority" text DEFAULT 'warm' NOT NULL,
	"source" text DEFAULT 'Website',
	"assigned_to" text DEFAULT '',
	"last_contact" text DEFAULT '',
	"avatar" text DEFAULT '',
	"notes" text[] DEFAULT '{}',
	"timeline" jsonb DEFAULT '[]'::jsonb,
	"score" integer DEFAULT 50,
	"urgency_score" integer DEFAULT 50,
	"tags" text[] DEFAULT '{}',
	"reminder" jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"duplicate_of" integer,
	"campaign" text,
	"ad_source" text,
	"ad_set_name" text,
	"ad_creative_id" text,
	"external_id" text,
	"ai_summary" text,
	"suggested_actions" text[] DEFAULT '{}',
	"dealer_id" integer,
	"created_by_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"avatar_initials" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" varchar(20),
	"country" varchar(100) DEFAULT 'PK',
	"type" varchar(50) DEFAULT 'house' NOT NULL,
	"subtype" varchar(100),
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"price" numeric(14, 2),
	"price_per_sqft" numeric(10, 2),
	"bedrooms" integer,
	"bathrooms" numeric(4, 1),
	"sqft" integer,
	"size_marla" numeric(10, 2),
	"sector" text,
	"lot_size" numeric(10, 2),
	"year_built" integer,
	"parking_spaces" integer,
	"images" jsonb DEFAULT '[]'::jsonb,
	"amenities" text[] DEFAULT '{}',
	"tags" text[] DEFAULT '{}',
	"mls_number" text,
	"external_id" text,
	"metadata" jsonb,
	"dealer_id" integer,
	"agent_id" varchar(255),
	"listed_by_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"lead_id" integer,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"channel" text DEFAULT 'crm' NOT NULL,
	"whatsapp_conversation_id" text,
	"linked_property" text,
	"last_message" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"whatsapp_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"lead_id" integer,
	"property_id" integer,
	"assigned_to_id" varchar(255),
	"created_by_id" varchar(255),
	"dealer_id" integer,
	"stage" varchar(100) DEFAULT 'lead' NOT NULL,
	"value" numeric(14, 2),
	"commission" numeric(14, 2),
	"commission_rate" numeric(5, 2),
	"probability" integer DEFAULT 0,
	"expected_close_date" timestamp,
	"closed_at" timestamp,
	"lost_reason" text,
	"notes" text,
	"tags" text[] DEFAULT '{}',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"lead_id" integer,
	"deal_id" integer,
	"property_id" integer,
	"type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"outcome" text,
	"duration" integer,
	"metadata" jsonb,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read" boolean DEFAULT false NOT NULL,
	"action_url" text,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_type" varchar(100) NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar(255),
	"last_run_at" timestamp,
	"last_run_status" varchar(50),
	"run_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer NOT NULL,
	"lead_id" integer,
	"trigger_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'success' NOT NULL,
	"actions_executed" jsonb DEFAULT '[]'::jsonb,
	"trigger_data" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"account_name" text,
	"account_id" text,
	"access_token" text,
	"refresh_token" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '',
	"role" varchar(50) DEFAULT 'agent' NOT NULL,
	"performance_score" integer DEFAULT 0,
	"date_of_employment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"deal_id" integer,
	"lead_id" integer,
	"title" text NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"file_url" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" varchar(50),
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"lead_id" integer,
	"deal_id" integer,
	"title" text NOT NULL,
	"description" text,
	"date_time" timestamp NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"location" text,
	"reminder_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"business_name" text,
	"business_logo_url" text,
	"whatsapp_number" varchar(50),
	"office_address" text,
	"team_size" varchar(50),
	"position" varchar(100),
	"theme" varchar(20) DEFAULT 'gold',
	"time_format" varchar(5) DEFAULT '12h',
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"new_lead_notif" boolean DEFAULT true NOT NULL,
	"deal_status_notif" boolean DEFAULT true NOT NULL,
	"whatsapp_notif" boolean DEFAULT true NOT NULL,
	"weekly_reports_enabled" boolean DEFAULT true NOT NULL,
	"marketing_emails_enabled" boolean DEFAULT false NOT NULL,
	"security_two_factor_enabled" boolean DEFAULT false NOT NULL,
	"preferred_language" varchar(10) DEFAULT 'en',
	"notif_frequency" varchar(20) DEFAULT 'instant',
	"notif_categories" text,
	"email_notif_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"operation" varchar(100) NOT NULL,
	"model" varchar(100) DEFAULT 'gpt-4o-mini',
	"input_tokens" integer DEFAULT 0,
	"output_tokens" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"name" text NOT NULL,
	"company" text,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '',
	"location" text DEFAULT '',
	"dealer_type" varchar(50) DEFAULT 'individual' NOT NULL,
	"profile_image" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"total_leads" integer DEFAULT 0,
	"total_deals" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'starter' NOT NULL,
	"subscription_status" varchar(50) DEFAULT 'trial' NOT NULL,
	"subscription_end_date" timestamp,
	"trial_end_date" timestamp,
	"is_internal" boolean DEFAULT false NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"ai_requests_used" integer DEFAULT 0 NOT NULL,
	"ai_requests_reset_at" timestamp,
	"support_access_enabled" boolean DEFAULT false NOT NULL,
	"support_access_enabled_by" varchar(255),
	"support_access_enabled_at" timestamp,
	"logo_url" text,
	"business_phone" varchar(50),
	"business_email" varchar(255),
	"business_address" text,
	"business_website" varchar(500),
	"business_type" varchar(100),
	"agent_count" varchar(50),
	"primary_lead_source" varchar(100),
	"crm_use" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"price_monthly" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'PKR' NOT NULL,
	"max_users" integer,
	"max_leads_per_month" integer,
	"max_whatsapp_numbers" integer,
	"max_facebook_pages" integer,
	"max_storage_gb" integer,
	"features" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"plan" varchar(50) NOT NULL,
	"screenshot_url" text,
	"notes" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" varchar(255),
	"actor_email" varchar(255),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"organization_id" integer,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"addon_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"quantity_remaining" integer NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"user_id" varchar(255) NOT NULL,
	"feature" varchar(100) NOT NULL,
	"model" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"name" varchar(100) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"role_name" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"org_role" varchar(100) DEFAULT 'agent' NOT NULL,
	"invitation_code" varchar(20),
	"phone" varchar(50),
	"invited_by" varchar(255),
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"priority" varchar(50) DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"sender_type" varchar(50) DEFAULT 'user' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_ai_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"actions_used" integer DEFAULT 0 NOT NULL,
	"actions_limit" integer DEFAULT 0 NOT NULL,
	"bonus_actions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_ai_usage_organization_id_month_year_unique" UNIQUE("organization_id","month","year")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"phone_number" varchar(50),
	"phone_number_id" varchar(100),
	"display_name" text,
	"business_name" text,
	"waba_id" varchar(100),
	"account_id" text,
	"access_token" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"connected_at" timestamp DEFAULT now(),
	"last_synced_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_whatsapp_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"whatsapp_account_id" integer NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_reply" boolean DEFAULT true NOT NULL,
	"can_assign" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uwp_user_account_unique" UNIQUE("user_id","whatsapp_account_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_wa_accounts" (
	"conversation_id" varchar(255) PRIMARY KEY NOT NULL,
	"whatsapp_account_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_listed_by_id_users_id_fk" FOREIGN KEY ("listed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_created_by_idx" ON "leads" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_priority_idx" ON "leads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "leads_source_idx" ON "leads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_type_idx" ON "properties" USING btree ("type");--> statement-breakpoint
CREATE INDEX "properties_city_idx" ON "properties" USING btree ("city");--> statement-breakpoint
CREATE INDEX "properties_listed_by_idx" ON "properties" USING btree ("listed_by_id");--> statement-breakpoint
CREATE INDEX "properties_dealer_idx" ON "properties" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "properties_created_at_idx" ON "properties" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_lead_idx" ON "deals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "deals_property_idx" ON "deals" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "deals_assigned_to_idx" ON "deals" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "deals_created_by_idx" ON "deals" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "deals_created_at_idx" ON "deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deals_close_date_idx" ON "deals" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_lead_idx" ON "activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "activities_deal_idx" ON "activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "activities_property_idx" ON "activities" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "activities_type_idx" ON "activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "activities_scheduled_at_idx" ON "activities" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_idx" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automations_is_active_idx" ON "automations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "automations_trigger_type_idx" ON "automations" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "automations_created_by_idx" ON "automations" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "automation_logs_automation_idx" ON "automation_logs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "automation_logs_lead_idx" ON "automation_logs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "automation_logs_status_idx" ON "automation_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_logs_created_at_idx" ON "automation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_accounts_user_provider_idx" ON "connected_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "connected_accounts_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "connected_accounts_provider_idx" ON "connected_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "documents_deal_idx" ON "documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "documents_lead_idx" ON "documents" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "appointments_user_idx" ON "appointments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "appointments_lead_idx" ON "appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "appointments_deal_idx" ON "appointments" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "appointments_date_time_idx" ON "appointments" USING btree ("date_time");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_idx" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_operation_idx" ON "ai_usage_logs" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "dealers_user_id_idx" ON "dealers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dealers_status_idx" ON "dealers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dealers_type_idx" ON "dealers" USING btree ("dealer_type");--> statement-breakpoint
CREATE INDEX "dealers_created_at_idx" ON "dealers" USING btree ("created_at");
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin", "owner"]);
export const messageCategoryEnum = pgEnum("message_category", ["general", "alert", "question", "event", "safety"]);
export const reactionTypeEnum = pgEnum("reaction_type", ["like", "helpful", "funny", "warning"]);
export const reportReasonEnum = pgEnum("report_reason", ["spam", "harassment", "inappropriate", "scam", "other"]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "dismissed"]);
export const modActionEnum = pgEnum("mod_action", ["hide", "unhide", "warn", "ban", "unban", "role_change"]);
export const modTargetEnum = pgEnum("mod_target", ["message", "user", "business_post"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["monthly", "yearly", "lifetime"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "expired", "cancelled"]);
export const subscriptionTypeEnum = pgEnum("subscription_type", ["user", "business"]);

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  role: userRoleEnum("role").notNull().default("user"),
  isPremium: boolean("is_premium").notNull().default(false),
  premiumTier: subscriptionTierEnum("premium_tier"),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  warningCount: integer("warning_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  category: messageCategoryEnum("category").notNull().default("general"),
  likesCount: integer("likes_count").notNull().default(0),
  flagCount: integer("flag_count").notNull().default(0),
  isHidden: boolean("is_hidden").notNull().default(false),
  hiddenBy: varchar("hidden_by").references(() => users.id),
  hiddenReason: text("hidden_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const businessProfiles = pgTable("business_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  businessName: text("business_name").notNull(),
  description: text("description"),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  subscriptionTier: subscriptionTierEnum("subscription_tier"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const businessPosts = pgTable("business_posts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  businessProfileId: varchar("business_profile_id").notNull().references(() => businessProfiles.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radius: doublePrecision("radius").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  isHidden: boolean("is_hidden").notNull().default(false),
  hiddenBy: varchar("hidden_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const reactions = pgTable("reactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: reactionTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  businessPostId: varchar("business_post_id").references(() => businessPosts.id, { onDelete: "cascade" }),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reason: reportReasonEnum("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const moderationLogs = pgTable("moderation_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  moderatorId: varchar("moderator_id").notNull().references(() => users.id),
  action: modActionEnum("action").notNull(),
  targetType: modTargetEnum("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  reason: text("reason"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: subscriptionTypeEnum("type").notNull(),
  tier: subscriptionTierEnum("tier").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  purchaseToken: text("purchase_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  latitude: true,
  longitude: true,
  category: true,
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).pick({
  businessName: true,
  description: true,
  category: true,
});

export const insertBusinessPostSchema = createInsertSchema(businessPosts).pick({
  content: true,
  latitude: true,
  longitude: true,
  radius: true,
});

export const insertReactionSchema = createInsertSchema(reactions).pick({
  messageId: true,
  type: true,
});

export const insertReportSchema = z.object({
  messageId: z.string().optional(),
  businessPostId: z.string().optional(),
  reason: z.enum(["spam", "harassment", "inappropriate", "scam", "other"]),
  details: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type BusinessPost = typeof businessPosts.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ModerationLog = typeof moderationLogs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

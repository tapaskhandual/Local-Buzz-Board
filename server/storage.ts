import { eq, and, sql, lt, desc, ne } from "drizzle-orm";
import { db, pool } from "./db";
import {
  users, messages, businessProfiles, businessPosts,
  reactions, reports, moderationLogs, subscriptions,
  type User, type InsertUser, type Message, type BusinessProfile,
  type BusinessPost, type Reaction, type Report, type ModerationLog
} from "@shared/schema";

const ROLE_HIERARCHY: Record<string, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function createUser(data: InsertUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user;
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
  const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
  return user;
}

export async function createMessage(userId: string, data: { content: string; latitude: number; longitude: number; category?: string }): Promise<Message> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [message] = await db.insert(messages).values({
    userId,
    content: data.content,
    latitude: data.latitude,
    longitude: data.longitude,
    category: (data.category as any) || "general",
    expiresAt,
  }).returning();
  return message;
}

export async function getNearbyMessages(lat: number, lng: number, radiusMiles: number): Promise<(Message & { username: string; displayName: string | null; distance: number })[]> {
  const now = new Date();
  const allMessages = await db.select({
    id: messages.id,
    userId: messages.userId,
    content: messages.content,
    latitude: messages.latitude,
    longitude: messages.longitude,
    category: messages.category,
    parentId: messages.parentId,
    likesCount: messages.likesCount,
    replyCount: messages.replyCount,
    flagCount: messages.flagCount,
    isHidden: messages.isHidden,
    hiddenBy: messages.hiddenBy,
    hiddenReason: messages.hiddenReason,
    createdAt: messages.createdAt,
    expiresAt: messages.expiresAt,
    username: users.username,
    displayName: users.displayName,
  })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(and(
      eq(messages.isHidden, false),
      sql`${messages.expiresAt} > ${now}`,
      sql`${messages.parentId} IS NULL`
    ))
    .orderBy(desc(messages.createdAt));

  return allMessages
    .map(m => ({
      ...m,
      distance: haversineDistance(lat, lng, m.latitude, m.longitude),
    }))
    .filter(m => m.distance <= radiusMiles);
}

export async function getRepliesForMessage(messageId: string): Promise<(Message & { username: string; displayName: string | null })[]> {
  const now = new Date();
  return db.select({
    id: messages.id,
    userId: messages.userId,
    content: messages.content,
    latitude: messages.latitude,
    longitude: messages.longitude,
    category: messages.category,
    parentId: messages.parentId,
    likesCount: messages.likesCount,
    replyCount: messages.replyCount,
    flagCount: messages.flagCount,
    isHidden: messages.isHidden,
    hiddenBy: messages.hiddenBy,
    hiddenReason: messages.hiddenReason,
    createdAt: messages.createdAt,
    expiresAt: messages.expiresAt,
    username: users.username,
    displayName: users.displayName,
  })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(and(
      eq(messages.parentId, messageId),
      eq(messages.isHidden, false),
      sql`${messages.expiresAt} > ${now}`
    ))
    .orderBy(messages.createdAt);
}

export async function createReply(userId: string, parentId: string, parentExpiresAt: Date, data: { content: string; latitude: number; longitude: number }): Promise<Message> {
  const replyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiresAt = parentExpiresAt < replyExpiry ? parentExpiresAt : replyExpiry;
  const [reply] = await db.insert(messages).values({
    userId,
    content: data.content,
    latitude: data.latitude,
    longitude: data.longitude,
    category: "general",
    parentId,
    expiresAt,
  }).returning();
  await db.update(messages)
    .set({ replyCount: sql`${messages.replyCount} + 1` })
    .where(eq(messages.id, parentId));
  return reply;
}

export async function deleteRepliesForMessage(parentId: string): Promise<void> {
  await db.delete(messages).where(eq(messages.parentId, parentId));
}

export async function getUserReactionsForMessages(userId: string, messageIds: string[]): Promise<Record<string, string>> {
  if (messageIds.length === 0) return {};
  const userReactions = await db.select({
    messageId: reactions.messageId,
    type: reactions.type,
  }).from(reactions).where(
    and(eq(reactions.userId, userId), sql`${reactions.messageId} = ANY(ARRAY[${sql.join(messageIds.map(id => sql`${id}`), sql`, `)}]::varchar[])`)
  );
  const map: Record<string, string> = {};
  for (const r of userReactions) {
    map[r.messageId] = r.type;
  }
  return map;
}

export async function getMessageById(id: string): Promise<Message | undefined> {
  const [message] = await db.select().from(messages).where(eq(messages.id, id));
  return message;
}

export async function addReaction(userId: string, messageId: string, type: string): Promise<Reaction> {
  const existing = await db.select().from(reactions).where(
    and(eq(reactions.userId, userId), eq(reactions.messageId, messageId))
  );
  if (existing.length > 0) {
    const [updated] = await db.update(reactions)
      .set({ type: type as any })
      .where(eq(reactions.id, existing[0].id))
      .returning();
    return updated;
  }
  const [reaction] = await db.insert(reactions).values({
    userId,
    messageId,
    type: type as any,
  }).returning();
  await db.update(messages)
    .set({ likesCount: sql`${messages.likesCount} + 1` })
    .where(eq(messages.id, messageId));
  return reaction;
}

export async function getReactionsForMessage(messageId: string): Promise<Reaction[]> {
  return db.select().from(reactions).where(eq(reactions.messageId, messageId));
}

export async function getUserReactionForMessage(userId: string, messageId: string): Promise<Reaction | undefined> {
  const [reaction] = await db.select().from(reactions).where(
    and(eq(reactions.userId, userId), eq(reactions.messageId, messageId))
  );
  return reaction;
}

export async function createReport(reporterId: string, data: { messageId?: string; businessPostId?: string; reason: string; details?: string }): Promise<Report> {
  const [report] = await db.insert(reports).values({
    reporterId,
    messageId: data.messageId || null,
    businessPostId: data.businessPostId || null,
    reason: data.reason as any,
    details: data.details,
  }).returning();
  if (data.messageId) {
    await db.update(messages)
      .set({ flagCount: sql`${messages.flagCount} + 1` })
      .where(eq(messages.id, data.messageId));
    const [msg] = await db.select().from(messages).where(eq(messages.id, data.messageId));
    if (msg && msg.flagCount >= 5) {
      await db.update(messages)
        .set({ isHidden: true, hiddenReason: "Auto-hidden: 5+ reports" })
        .where(eq(messages.id, data.messageId));
    }
  }
  return report;
}

export async function getPendingReports(): Promise<(Report & { reporterUsername: string })[]> {
  const result = await db.select({
    id: reports.id,
    messageId: reports.messageId,
    businessPostId: reports.businessPostId,
    reporterId: reports.reporterId,
    reason: reports.reason,
    details: reports.details,
    status: reports.status,
    reviewedBy: reports.reviewedBy,
    reviewedAt: reports.reviewedAt,
    createdAt: reports.createdAt,
    reporterUsername: users.username,
  })
    .from(reports)
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "pending"))
    .orderBy(desc(reports.createdAt));
  return result;
}

export async function reviewReport(reportId: string, reviewerId: string, status: "reviewed" | "dismissed"): Promise<Report | undefined> {
  const [report] = await db.update(reports)
    .set({ status: status as any, reviewedBy: reviewerId, reviewedAt: new Date() })
    .where(eq(reports.id, reportId))
    .returning();
  return report;
}

export async function hideContent(moderatorId: string, targetType: "message" | "business_post", targetId: string, reason: string): Promise<void> {
  if (targetType === "message") {
    await db.update(messages)
      .set({ isHidden: true, hiddenBy: moderatorId, hiddenReason: reason })
      .where(eq(messages.id, targetId));
  } else {
    await db.update(businessPosts)
      .set({ isHidden: true, hiddenBy: moderatorId })
      .where(eq(businessPosts.id, targetId));
  }
  await db.insert(moderationLogs).values({
    moderatorId,
    action: "hide",
    targetType: targetType as any,
    targetId,
    reason,
  });
}

export async function unhideContent(moderatorId: string, targetType: "message" | "business_post", targetId: string): Promise<void> {
  if (targetType === "message") {
    await db.update(messages)
      .set({ isHidden: false, hiddenBy: null, hiddenReason: null })
      .where(eq(messages.id, targetId));
  } else {
    await db.update(businessPosts)
      .set({ isHidden: false, hiddenBy: null })
      .where(eq(businessPosts.id, targetId));
  }
  await db.insert(moderationLogs).values({
    moderatorId,
    action: "unhide",
    targetType: targetType as any,
    targetId,
  });
}

export async function warnUser(moderatorId: string, userId: string, reason: string): Promise<void> {
  await db.update(users)
    .set({ warningCount: sql`${users.warningCount} + 1` })
    .where(eq(users.id, userId));
  await db.insert(moderationLogs).values({
    moderatorId,
    action: "warn",
    targetType: "user",
    targetId: userId,
    reason,
  });
}

export async function banUser(moderatorId: string, userId: string, reason: string): Promise<void> {
  await db.update(users)
    .set({ isBanned: true, banReason: reason })
    .where(eq(users.id, userId));
  await db.insert(moderationLogs).values({
    moderatorId,
    action: "ban",
    targetType: "user",
    targetId: userId,
    reason,
  });
}

export async function unbanUser(moderatorId: string, userId: string): Promise<void> {
  await db.update(users)
    .set({ isBanned: false, banReason: null })
    .where(eq(users.id, userId));
  await db.insert(moderationLogs).values({
    moderatorId,
    action: "unban",
    targetType: "user",
    targetId: userId,
  });
}

export async function changeUserRole(ownerId: string, userId: string, newRole: "user" | "moderator" | "admin"): Promise<User | undefined> {
  const [updated] = await db.update(users)
    .set({ role: newRole as any })
    .where(eq(users.id, userId))
    .returning();
  await db.insert(moderationLogs).values({
    moderatorId: ownerId,
    action: "role_change",
    targetType: "user",
    targetId: userId,
    metadata: JSON.stringify({ newRole }),
  });
  return updated;
}

export async function getModerationLogs(limit: number = 50): Promise<(ModerationLog & { moderatorUsername: string })[]> {
  const result = await db.select({
    id: moderationLogs.id,
    moderatorId: moderationLogs.moderatorId,
    action: moderationLogs.action,
    targetType: moderationLogs.targetType,
    targetId: moderationLogs.targetId,
    reason: moderationLogs.reason,
    metadata: moderationLogs.metadata,
    createdAt: moderationLogs.createdAt,
    moderatorUsername: users.username,
  })
    .from(moderationLogs)
    .innerJoin(users, eq(moderationLogs.moderatorId, users.id))
    .orderBy(desc(moderationLogs.createdAt))
    .limit(limit);
  return result;
}

export async function getModeratorActionCount(moderatorId: string, hoursAgo: number = 1): Promise<number> {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(moderationLogs)
    .where(and(
      eq(moderationLogs.moderatorId, moderatorId),
      sql`${moderationLogs.createdAt} > ${since}`
    ));
  return Number(result[0]?.count || 0);
}

export function canModerate(actorRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[actorRole] || 0) > (ROLE_HIERARCHY[targetRole] || 0);
}

export async function createBusinessProfile(userId: string, data: { businessName: string; description?: string; category?: string }): Promise<BusinessProfile> {
  const [profile] = await db.insert(businessProfiles).values({
    userId,
    businessName: data.businessName,
    description: data.description,
    category: data.category,
  }).returning();
  return profile;
}

export async function getBusinessProfileByUserId(userId: string): Promise<BusinessProfile | undefined> {
  const [profile] = await db.select().from(businessProfiles).where(eq(businessProfiles.userId, userId));
  return profile;
}

export async function updateBusinessProfile(id: string, data: Partial<BusinessProfile>): Promise<BusinessProfile | undefined> {
  const [profile] = await db.update(businessProfiles).set(data).where(eq(businessProfiles.id, id)).returning();
  return profile;
}

export async function createBusinessPost(userId: string, businessProfileId: string, data: { content: string; latitude: number; longitude: number; radius?: number }): Promise<BusinessPost> {
  const [post] = await db.insert(businessPosts).values({
    userId,
    businessProfileId,
    content: data.content,
    latitude: data.latitude,
    longitude: data.longitude,
    radius: data.radius || 10,
  }).returning();
  return post;
}

export async function getNearbyBusinessPosts(lat: number, lng: number, radiusMiles: number): Promise<(BusinessPost & { businessName: string; businessCategory: string | null; distance: number })[]> {
  const allPosts = await db.select({
    id: businessPosts.id,
    businessProfileId: businessPosts.businessProfileId,
    userId: businessPosts.userId,
    content: businessPosts.content,
    latitude: businessPosts.latitude,
    longitude: businessPosts.longitude,
    radius: businessPosts.radius,
    isActive: businessPosts.isActive,
    isHidden: businessPosts.isHidden,
    hiddenBy: businessPosts.hiddenBy,
    createdAt: businessPosts.createdAt,
    expiresAt: businessPosts.expiresAt,
    businessName: businessProfiles.businessName,
    businessCategory: businessProfiles.category,
  })
    .from(businessPosts)
    .innerJoin(businessProfiles, eq(businessPosts.businessProfileId, businessProfiles.id))
    .where(and(
      eq(businessPosts.isActive, true),
      eq(businessPosts.isHidden, false),
    ))
    .orderBy(desc(businessPosts.createdAt));

  return allPosts
    .map(p => ({
      ...p,
      distance: haversineDistance(lat, lng, p.latitude, p.longitude),
    }))
    .filter(p => p.distance <= radiusMiles);
}

export async function cleanExpiredMessages(): Promise<number> {
  const now = new Date();
  const expired = await db.delete(messages).where(lt(messages.expiresAt, now)).returning();
  return expired.length;
}

export async function getUserMessages(userId: string): Promise<Message[]> {
  return db.select().from(messages)
    .where(eq(messages.userId, userId))
    .orderBy(desc(messages.createdAt));
}

export async function activateSubscription(userId: string, type: "user" | "business", tier: "monthly" | "yearly" | "lifetime", purchaseToken?: string): Promise<void> {
  let endDate: Date | null = null;
  if (tier === "monthly") endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  else if (tier === "yearly") endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await db.insert(subscriptions).values({
    userId,
    type: type as any,
    tier: tier as any,
    status: "active",
    endDate,
    purchaseToken,
  });

  if (type === "user") {
    await db.update(users)
      .set({ isPremium: true, premiumTier: tier as any })
      .where(eq(users.id, userId));
  } else if (type === "business") {
    await db.update(businessProfiles)
      .set({ subscriptionTier: tier as any, subscriptionStatus: "active" })
      .where(eq(businessProfiles.userId, userId));
  }
}

export async function getUserSubscriptions(userId: string) {
  return db.select().from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function debugDbCheck(): Promise<string[]> {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  return result.rows.map((r: any) => r.table_name);
}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as storage from "./storage";
import { getBusyAreas } from "./busy-areas";
import { insertUserSchema, insertMessageSchema, insertBusinessProfileSchema, insertBusinessPostSchema, insertReactionSchema, insertReportSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable must be set");
}
const FREE_RADIUS_MILES = 5;
const PREMIUM_RADIUS_MILES = 25;
const MOD_RATE_LIMIT = 50;

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

const BANNED_WORDS = ["spam", "scam"];
function filterContent(content: string): boolean {
  const lower = content.toLowerCase();
  return !BANNED_WORDS.some(word => lower.includes(word));
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/debug/db", async (_req: Request, res: Response) => {
    try {
      const result = await storage.debugDbCheck();
      res.json({ ok: true, tables: result });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message, code: error?.code });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
      });
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
      return res.status(201).json({
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, isPremium: user.isPremium },
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "Account banned: " + (user.banReason || "Contact support") });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, isPremium: user.isPremium, premiumTier: user.premiumTier },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, isPremium: user.isPremium, premiumTier: user.premiumTier,
        warningCount: user.warningCount, createdAt: user.createdAt,
      });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.put("/api/auth/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { displayName } = req.body;
      const user = await storage.updateUser(req.userId!, { displayName });
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, isPremium: user.isPremium,
      });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.isBanned) return res.status(403).json({ message: "Account banned" });

      const parsed = insertMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      if (!filterContent(parsed.data.content)) {
        return res.status(400).json({ message: "Content contains prohibited words" });
      }
      const message = await storage.createMessage(req.userId!, parsed.data);
      return res.status(201).json(message);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: error?.message || "An unexpected error occurred" });
    }
  });

  app.get("/api/messages/nearby", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "lat and lng are required" });
      }
      const user = await storage.getUserById(req.userId!);
      const radius = user?.isPremium ? PREMIUM_RADIUS_MILES : FREE_RADIUS_MILES;
      const messages = await storage.getNearbyMessages(lat, lng, radius);
      const messageIds = messages.map(m => m.id);
      const userReactions = await storage.getUserReactionsForMessages(req.userId!, messageIds);
      const messagesWithReactions = messages.map(m => ({
        ...m,
        userReaction: userReactions[m.id] || null,
      }));
      return res.json({ messages: messagesWithReactions, radius });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/messages/mine", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const messages = await storage.getUserMessages(req.userId!);
      return res.json(messages);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/messages/:id/react", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertReactionSchema.safeParse({ messageId: req.params.id, ...req.body });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const message = await storage.getMessageById(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      const reaction = await storage.addReaction(req.userId!, req.params.id, parsed.data.type);
      return res.json(reaction);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/messages/:id/report", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertReportSchema.safeParse({ messageId: req.params.id, ...req.body });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const report = await storage.createReport(req.userId!, parsed.data);
      return res.status(201).json(report);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/messages/:id/replies", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const message = await storage.getMessageById(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      const replies = await storage.getRepliesForMessage(req.params.id);
      return res.json({ replies });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/messages/:id/reply", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.isBanned) return res.status(403).json({ message: "Account banned" });
      const parent = await storage.getMessageById(req.params.id);
      if (!parent) return res.status(404).json({ message: "Message not found" });
      if (parent.parentId) {
        return res.status(400).json({ message: "Cannot reply to a reply" });
      }
      const { content } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Reply content is required" });
      }
      if (content.trim().length > 300) {
        return res.status(400).json({ message: "Reply too long (max 300 characters)" });
      }
      if (!filterContent(content)) {
        return res.status(400).json({ message: "Content contains prohibited words" });
      }
      const reply = await storage.createReply(req.userId!, req.params.id, parent.expiresAt, {
        content: content.trim(),
        latitude: parent.latitude,
        longitude: parent.longitude,
      });
      return res.status(201).json(reply);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/business/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getBusinessProfileByUserId(req.userId!);
      if (existing) return res.status(409).json({ message: "Business profile already exists" });
      const parsed = insertBusinessProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const profile = await storage.createBusinessProfile(req.userId!, parsed.data);
      return res.status(201).json(profile);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/business/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getBusinessProfileByUserId(req.userId!);
      if (!profile) return res.status(404).json({ message: "No business profile" });
      return res.json(profile);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.put("/api/business/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getBusinessProfileByUserId(req.userId!);
      if (!profile) return res.status(404).json({ message: "No business profile" });
      const { businessName, description, category } = req.body;
      const allowedFields: Record<string, any> = {};
      if (businessName !== undefined) allowedFields.businessName = businessName;
      if (description !== undefined) allowedFields.description = description;
      if (category !== undefined) allowedFields.category = category;
      if (Object.keys(allowedFields).length === 0) return res.status(400).json({ message: "No valid fields to update" });
      const updated = await storage.updateBusinessProfile(profile.id, allowedFields);
      return res.json(updated);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/business/posts", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const profile = await storage.getBusinessProfileByUserId(req.userId!);
      if (!profile) return res.status(404).json({ message: "Create a business profile first" });
      if (profile.subscriptionStatus !== "active") {
        return res.status(403).json({ message: "Active business subscription required to post" });
      }
      const parsed = insertBusinessPostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const post = await storage.createBusinessPost(req.userId!, profile.id, parsed.data);
      return res.status(201).json(post);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/business/posts/nearby", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "lat and lng are required" });
      }
      const user = await storage.getUserById(req.userId!);
      const radius = user?.isPremium ? PREMIUM_RADIUS_MILES : FREE_RADIUS_MILES;
      const posts = await storage.getNearbyBusinessPosts(lat, lng, radius);
      return res.json({ posts, radius });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/subscriptions/activate", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { type: clientType, tier: clientTier, purchaseToken, revenuecatId } = req.body;

      const rcSecret = process.env.REVENUECAT_API_SECRET;
      if (!rcSecret && process.env.NODE_ENV === "production") {
        return res.status(503).json({ message: "Subscription service not configured" });
      }

      let resolvedType: "user" | "business" = "user";
      let resolvedTier: "monthly" | "yearly" | "lifetime" = "monthly";

      if (rcSecret) {
        if (!revenuecatId) {
          return res.status(400).json({ message: "revenuecatId is required for subscription verification" });
        }
        try {
          const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${revenuecatId}`, {
            headers: { Authorization: `Bearer ${rcSecret}` },
          });
          if (!rcRes.ok) {
            return res.status(502).json({ message: "Failed to verify subscription with RevenueCat" });
          }
          const rcData = await rcRes.json();
          const appUserId = rcData?.subscriber?.original_app_user_id;
          if (appUserId !== String(req.userId)) {
            return res.status(403).json({ message: "Subscription does not belong to this user" });
          }
          const entitlements = rcData?.subscriber?.entitlements || {};
          const premium = entitlements["premium"];
          if (!premium || (premium.expires_date && new Date(premium.expires_date) < new Date())) {
            return res.status(403).json({ message: "No active subscription found in RevenueCat" });
          }

          const productId = (premium.product_identifier || "").toLowerCase();
          if (productId.includes("lifetime")) {
            resolvedTier = "lifetime";
          } else if (productId.includes("yearly") || productId.includes("annual")) {
            resolvedTier = "yearly";
          } else {
            resolvedTier = "monthly";
          }

          if (productId.includes("business")) {
            resolvedType = "business";
          } else {
            resolvedType = "user";
          }
        } catch (rcError) {
          console.error("RevenueCat verification error:", rcError);
          return res.status(502).json({ message: "RevenueCat verification failed" });
        }
      } else {
        if (!clientType || !clientTier) return res.status(400).json({ message: "type and tier required" });
        if (!["user", "business"].includes(clientType)) return res.status(400).json({ message: "type must be user or business" });
        if (!["monthly", "yearly", "lifetime"].includes(clientTier)) return res.status(400).json({ message: "Invalid tier" });
        resolvedType = clientType;
        resolvedTier = clientTier;
      }

      await storage.activateSubscription(req.userId!, resolvedType, resolvedTier, purchaseToken);
      const user = await storage.getUserById(req.userId!);
      return res.json({ message: "Subscription activated", user: { id: user!.id, isPremium: user!.isPremium, premiumTier: user!.premiumTier } });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/subscriptions", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const subs = await storage.getUserSubscriptions(req.userId!);
      return res.json(subs);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/hide/:type/:id", authMiddleware, requireRole("moderator", "admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.getModeratorActionCount(req.userId!);
      if (count >= MOD_RATE_LIMIT) return res.status(429).json({ message: "Rate limit: max 50 actions per hour" });
      const targetType = req.params.type as "message" | "business_post";
      await storage.hideContent(req.userId!, targetType, req.params.id, req.body.reason || "No reason provided");
      return res.json({ message: "Content hidden" });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/unhide/:type/:id", authMiddleware, requireRole("admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const targetType = req.params.type as "message" | "business_post";
      await storage.unhideContent(req.userId!, targetType, req.params.id);
      return res.json({ message: "Content restored" });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/warn/:userId", authMiddleware, requireRole("moderator", "admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.getModeratorActionCount(req.userId!);
      if (count >= MOD_RATE_LIMIT) return res.status(429).json({ message: "Rate limit exceeded" });
      const target = await storage.getUserById(req.params.userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (!storage.canModerate(req.userRole!, target.role)) {
        return res.status(403).json({ message: "Cannot moderate users with equal or higher role" });
      }
      await storage.warnUser(req.userId!, req.params.userId, req.body.reason || "No reason");
      return res.json({ message: "User warned" });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/ban/:userId", authMiddleware, requireRole("admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const target = await storage.getUserById(req.params.userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (!storage.canModerate(req.userRole!, target.role)) {
        return res.status(403).json({ message: "Cannot ban users with equal or higher role" });
      }
      await storage.banUser(req.userId!, req.params.userId, req.body.reason || "No reason");
      return res.json({ message: "User banned" });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/unban/:userId", authMiddleware, requireRole("admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const target = await storage.getUserById(req.params.userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (!storage.canModerate(req.userRole!, target.role)) {
        return res.status(403).json({ message: "Cannot unban users with equal or higher role" });
      }
      await storage.unbanUser(req.userId!, req.params.userId);
      return res.json({ message: "User unbanned" });
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/moderation/reports", authMiddleware, requireRole("moderator", "admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const reports = await storage.getPendingReports();
      return res.json(reports);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.post("/api/moderation/reports/:id/review", authMiddleware, requireRole("moderator", "admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!["reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Status must be reviewed or dismissed" });
      }
      const report = await storage.reviewReport(req.params.id, req.userId!, status);
      return res.json(report);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.put("/api/moderation/role/:userId", authMiddleware, requireRole("owner"), async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.body;
      if (!["user", "moderator", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (req.params.userId === req.userId) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      const updated = await storage.changeUserRole(req.userId!, req.params.userId, role);
      return res.json(updated);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/moderation/logs", authMiddleware, requireRole("admin", "owner"), async (req: AuthRequest, res: Response) => {
    try {
      const logs = await storage.getModerationLogs();
      return res.json(logs);
    } catch (error: any) {
      console.error("Server error:", error);
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  app.get("/api/busy-areas", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: "Valid lat (-90 to 90) and lng (-180 to 180) are required" });
      }
      const user = await storage.getUserById(req.userId!);
      const radius = user?.isPremium ? PREMIUM_RADIUS_MILES : FREE_RADIUS_MILES;
      const areas = await getBusyAreas(lat, lng, radius);
      return res.json({ areas, radius });
    } catch (error: any) {
      console.error("Busy areas error:", error.message);
      if (error.message?.includes("Overpass")) {
        return res.status(502).json({ message: "Upstream service temporarily unavailable" });
      }
      return res.status(500).json({ message: "Failed to fetch busy areas" });
    }
  });

  setInterval(async () => {
    try {
      const deleted = await storage.cleanExpiredMessages();
      if (deleted > 0) console.log(`Cleanup: removed ${deleted} expired messages`);
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }, 60 * 60 * 1000);

  const httpServer = createServer(app);
  return httpServer;
}

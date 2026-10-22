import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./isAuth.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requestsByUser = new Map<string, RateLimitEntry>();
export const aiRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const now = Date.now();
  const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60_000;
  const maxRequests = Number(process.env.AI_RATE_LIMIT_PER_MINUTE) || 20;
  let entry = requestsByUser.get(userId);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    res.setHeader("Retry-After", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
    res.status(429).json({ message: "AI request limit reached. Please wait before trying again." });
    return;
  }

  entry.count += 1;
  requestsByUser.set(userId, entry);
  // Opportunistically remove expired entries so this stays bounded over time.
  if (requestsByUser.size > 1_000) {
    for (const [key, value] of requestsByUser) {
      if (value.resetAt <= now) requestsByUser.delete(key);
    }
  }
  next();
};

export const resetAIRateLimitForTests = (): void => requestsByUser.clear();

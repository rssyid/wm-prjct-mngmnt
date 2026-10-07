import { getRedisClient } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest } from "next/server";

let authRateLimiter: Ratelimit | null = null;
let presignRateLimiter: Ratelimit | null = null;

function getAuthRateLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!authRateLimiter) {
    authRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "5 m"),
      prefix: "rl:auth",
      analytics: false,
    });
  }
  return authRateLimiter;
}

function getPresignRateLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!presignRateLimiter) {
    presignRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      prefix: "rl:presign",
      analytics: false,
    });
  }
  return presignRateLimiter;
}

/**
 * Mendapatkan IP client dari headers atau request.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return (req as unknown as { ip?: string }).ip || "127.0.0.1";
}

/**
 * Mengekstrak identifier IP + email dari request login credentials.
 */
export async function extractAuthRateLimitKey(req: NextRequest): Promise<string> {
  const ip = getClientIp(req);
  let email = "unknown";

  try {
    const clone = req.clone();
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await clone.json();
      if (data?.email && typeof data.email === "string") {
        email = data.email.toLowerCase().trim();
      }
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await clone.formData();
      const formEmail = formData.get("email");
      if (typeof formEmail === "string") {
        email = formEmail.toLowerCase().trim();
      }
    } else {
      const text = await clone.text();
      const params = new URLSearchParams(text);
      const urlEmail = params.get("email");
      if (urlEmail) {
        email = urlEmail.toLowerCase().trim();
      }
    }
  } catch {
    // Abaikan error parsing body, fallback ke IP saja
  }

  return `${ip}:${email}`;
}

/**
 * Memeriksa batas laju percobaan login kredensial (maks 10x per 5 menit per IP + email).
 */
export async function checkAuthRateLimit(req: NextRequest): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = getAuthRateLimiter();
  if (!limiter) {
    return { success: true, limit: 10, remaining: 10, reset: 0 };
  }

  try {
    const identifier = await extractAuthRateLimitKey(req);
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("[RateLimit] Error checking auth rate limit:", error);
    // Graceful fail-open agar sistem login tidak terblokir bila terjadi error jaringan
    return { success: true, limit: 10, remaining: 10, reset: 0 };
  }
}

/**
 * Memeriksa batas laju presigned upload URL (maks 60x per jam per user).
 */
export async function checkPresignRateLimit(userId: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limiter = getPresignRateLimiter();
  if (!limiter) {
    return { success: true, limit: 60, remaining: 60, reset: 0 };
  }

  try {
    const result = await limiter.limit(`user:${userId}`);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("[RateLimit] Error checking presign rate limit:", error);
    return { success: true, limit: 60, remaining: 60, reset: 0 };
  }
}

import { authOptions } from "@/lib/auth";
import { checkAuthRateLimit } from "@/lib/ratelimit";
import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const nextAuthHandler = NextAuth(authOptions);

export async function POST(
  req: NextRequest,
  ctx: { params: { nextauth?: string[] } }
) {
  // Cek apakah request ditujukan untuk callback login credentials
  const pathname = req.nextUrl.pathname;
  if (pathname.includes("/callback/credentials")) {
    const rateLimit = await checkAuthRateLimit(req);
    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000)
      );

      return NextResponse.json(
        {
          error: "Terlalu banyak percobaan masuk. Silakan coba lagi dalam 5 menit.",
          message: "Terlalu banyak percobaan masuk. Silakan coba lagi dalam 5 menit.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSec.toString(),
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.reset.toString(),
          },
        }
      );
    }
  }

  return nextAuthHandler(req, ctx);
}

export { nextAuthHandler as GET };

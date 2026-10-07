import { withAuth } from "next-auth/middleware";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error("NEXTAUTH_SECRET belum diset di environment variables");
}

export default withAuth({
  secret,
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - /login (halaman login)
     * - /api/auth (NextAuth API routes)
     * - /api/health (Liveness probe)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, public assets
     */
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico
     */
    "/((?!login|api/auth|_next|favicon\\.ico).*)",
  ],
};

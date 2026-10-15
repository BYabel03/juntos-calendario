import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { register } from "controllers/user";
import { canManageReservations, isCalendarAdminEmail } from "lib/calendarPermissions";

import type { User } from "models/user";

export default NextAuth({
  // A provider is available only after both OAuth credentials are configured.
  providers: [
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    ...(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  pages: { error: "/" },
  secret: process.env.NEXT_AUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.calendarEmailVerified = false;
        // Only administrator candidates need this additional provider verification.
        if (isCalendarAdminEmail(token.email)) {
          if (account.provider === "google") {
            const identity = profile as { email?: string; email_verified?: boolean } | undefined;
            token.calendarEmailVerified = identity?.email_verified === true && identity.email === token.email;
          } else if (account.provider === "github" && account.access_token) {
            try {
              const response = await fetch("https://api.github.com/user/emails", {
                headers: { Authorization: `Bearer ${account.access_token}`, Accept: "application/vnd.github+json" },
              });
              const emails = response.ok ? await response.json() : [];
              token.calendarEmailVerified = Array.isArray(emails) && emails.some((entry) =>
                entry.verified === true && typeof entry.email === "string" &&
                entry.email.toLowerCase() === token.email?.toLowerCase());
            } catch {
              token.calendarEmailVerified = false;
            }
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.isCalendarAdmin = canManageReservations(token);
      const { user } = session;
      try {
        if (!user) {
          return session;
        }

        const userBody: Omit<User, "id"> = {
          email: user.email || "",
          avatar: user.image || "",
          username: user.name || "",
        };

        const [userFromDB] = await register(userBody);

        if (userFromDB) {
          session.userId = String(userFromDB.id);
        }
        return session;
      } catch (error) {
        console.log(error);
        return session;
      }
    },
  },
});

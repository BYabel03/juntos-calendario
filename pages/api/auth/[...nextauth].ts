import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { register } from "controllers/user";

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
    async session({ session }) {
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
          session.userId = userFromDB.id;
        }
        return session;
      } catch (error) {
        console.log(error);
        return session;
      }
    },
  },
});

import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { MASTERMIND_IDS } from "@/lib/admin/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise, { databaseName: "Database" }),
  providers: [Discord],
  session: { strategy: "database", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.discordId = (user as any).discordId ?? "";
        session.user.username = (user as any).username ?? "";
        session.user.globalName = (user as any).globalName ?? "";
        session.user.isMastermind = (MASTERMIND_IDS as readonly string[]).includes(session.user.discordId ?? '');
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord" && profile) {
        (user as any).discordId = profile.id ?? "";
        (user as any).username = (profile as any).username ?? "";
        (user as any).globalName = (profile as any).global_name ?? "";
      }
      return true;
    },
  },
});

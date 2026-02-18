import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordId?: string;
      username?: string;
      globalName?: string;
    } & DefaultSession["user"];
  }

  interface User {
    discordId?: string;
    username?: string;
    globalName?: string;
  }
}

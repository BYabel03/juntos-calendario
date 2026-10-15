import "next-auth";

// The social pages use the database ID added by the session callback.
declare module "next-auth" {
  interface Session {
    userId?: string;
  }
}

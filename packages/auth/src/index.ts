import { db } from "@se-project/db";
import * as schema from "@se-project/db/schema/auth";
import { env } from "@se-project/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { ac, owner, eventHead, staff } from "./permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  plugins: [
    nextCookies(),
    organization({
      ac,
      roles: { owner, eventHead, staff },
      allowUserToCreateOrganization: async () => true,
      creatorRole: "owner",
    }),
  ],
});

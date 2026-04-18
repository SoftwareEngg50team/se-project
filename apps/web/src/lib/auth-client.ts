import { ac, eventHead, owner, staff } from "@se-project/auth/permissions";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac: ac,
      roles: { owner, eventHead, staff },
    }),
  ],
});

import { ORPCError, os } from "@orpc/server";
import { auth } from "@se-project/auth";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function ensureOrganizationForUser(headers: Headers, user: { id: string; name?: string | null }) {
  const organizations = await auth.api.listOrganizations({ headers });
  if (organizations.length > 0) {
    return organizations[0];
  }

  const organizationName = user.name?.trim()
    ? `${user.name.trim()}'s Organization`
    : "My Organization";
  const baseSlug = toSlug(organizationName) || "organization";
  const suffix = user.id.slice(0, 8).toLowerCase();

  return auth.api.createOrganization({
    headers,
    body: {
      name: organizationName,
      slug: `${baseSlug}-${suffix}`,
    },
  });
}

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export function requirePermission(
  permissions: Record<string, string[]>,
) {
  return o.middleware(async ({ context, next }) => {
    if (!context.session?.user) {
      throw new ORPCError("UNAUTHORIZED");
    }

    try {
      const organization = await ensureOrganizationForUser(
        context.headers,
        context.session.user,
      );

      const result = await auth.api.hasPermission({
        headers: context.headers,
        body: {
          permissions,
          organizationId: organization.id,
        },
      });

      if (!result.success) {
        throw new ORPCError("FORBIDDEN", {
          message: "You do not have permission to perform this action",
        });
      }
    } catch (error) {
      if (error instanceof ORPCError) throw error;
      throw new ORPCError("FORBIDDEN", {
        message: "You do not have permission to perform this action. Please ensure you are part of an organization.",
      });
    }

    return next({
      context: {
        session: context.session,
      },
    });
  });
}

// Convenience procedures for common permission patterns
export const ownerProcedure = protectedProcedure.use(
  requirePermission({ organization: ["update"] }),
);
export const eventHeadProcedure = protectedProcedure.use(
  requirePermission({ event: ["create"] }),
);
export const staffProcedure = protectedProcedure.use(
  requirePermission({ event: ["read"] }),
);

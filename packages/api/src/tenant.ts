import { ORPCError } from "@orpc/server";
import { auth } from "@se-project/auth";
import { db, and, eq } from "@se-project/db";
import { member } from "@se-project/db/schema/auth";

import type { Context } from "./context";

type SessionLike = Pick<Context, "headers" | "session">;

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function resolveOrganizationId(context: SessionLike) {
  const user = context.session?.user;
  const session = context.session;

  if (!user || !session) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const activeOrganizationId = session.session.activeOrganizationId;

  if (activeOrganizationId) {
    const activeMembership = await db.query.member.findFirst({
      where: and(
        eq(member.userId, user.id),
        eq(member.organizationId, activeOrganizationId),
      ),
    });

    if (activeMembership) {
      return activeOrganizationId;
    }
  }

  const memberships = await db.query.member.findMany({
    where: eq(member.userId, user.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (memberships.length > 0 && memberships[0]) {
    return memberships[0].organizationId;
  }

  const organizationName = user.name?.trim()
    ? `${user.name.trim()}'s Organization`
    : "My Organization";
  const baseSlug = toSlug(organizationName) || "organization";
  const suffix = user.id.slice(0, 8).toLowerCase();

  const organization = await auth.api.createOrganization({
    headers: context.headers,
    body: {
      name: organizationName,
      slug: `${baseSlug}-${suffix}`,
    },
  });

  return organization.id;
}

export async function resolveOrganizationUserIds(context: SessionLike) {
  const user = context.session?.user;

  if (!user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const organizationId = await resolveOrganizationId(context);
  const memberships = await db.query.member.findMany({
    where: eq(member.organizationId, organizationId),
  });

  const ids = new Set<string>([user.id]);
  for (const row of memberships) {
    ids.add(row.userId);
  }

  return {
    organizationId,
    userIds: Array.from(ids),
  };
}

export function ensureScopedIds(userIds: string[]) {
  if (userIds.length === 0) {
    throw new ORPCError("FORBIDDEN", {
      message: "No accessible organization users found",
    });
  }

  return userIds;
}

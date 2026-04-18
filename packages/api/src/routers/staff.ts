import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, or, count } from "@se-project/db";
import { user, member } from "@se-project/db/schema/auth";
import { protectedProcedure } from "../index";
import { userSchema } from "../schemas";

const staffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  role: z.string().nullable(),
});

export const staffRouter = {
  list: protectedProcedure
    .route({
      tags: ["Staff"],
      summary: "List staff members",
      description:
        "Returns a paginated list of staff members with their organisation roles. Filter by role or search by name/email.",
    })
    .input(
      z.object({
        role: z.enum(["owner", "event_head", "staff"]).optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .output(z.object({ users: z.array(staffMemberSchema), total: z.number().int() }))
    .handler(async ({ input, context }) => {
      const { role, search, page, limit } = input;
      const offset = (page - 1) * limit;

      // Get users with their member roles from the active organization
      const orgId = context.session?.session?.activeOrganizationId;

      if (!orgId) {
        // No active organization, return all users without role info
        const conditions = [];

        if (search) {
          conditions.push(
            or(
              ilike(user.name, `%${search}%`),
              ilike(user.email, `%${search}%`),
            ),
          );
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [users, totalResult] = await Promise.all([
          db.query.user.findMany({
            where,
            limit,
            offset,
          }),
          db
            .select({ total: count() })
            .from(user)
            .where(where ?? undefined),
        ]);

        return {
          users: users.map((u) => ({ ...u, role: null })),
          total: totalResult[0]?.total ?? 0,
        };
      }

      // With an active org, join with member table to get roles
      const conditions = [];

      if (role) {
        conditions.push(eq(member.role, role));
      }

      if (search) {
        conditions.push(
          or(
            ilike(user.name, `%${search}%`),
            ilike(user.email, `%${search}%`),
          ),
        );
      }

      conditions.push(eq(member.organizationId, orgId));

      const where = and(...conditions);

      const [users, totalResult] = await Promise.all([
        db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            role: member.role,
          })
          .from(user)
          .innerJoin(member, eq(user.id, member.userId))
          .where(where)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(user)
          .innerJoin(member, eq(user.id, member.userId))
          .where(where),
      ]);

      return {
        users,
        total: totalResult[0]?.total ?? 0,
      };
    }),

  getById: protectedProcedure
    .route({
      tags: ["Staff"],
      summary: "Get staff member",
      description:
        "Fetch a staff member by ID, including their organisation role.",
    })
    .input(z.object({ id: z.string() }))
    .output(userSchema.extend({ role: z.string().nullable() }))
    .handler(async ({ input }) => {
      const result = await db.query.user.findFirst({
        where: eq(user.id, input.id),
        with: {
          members: true,
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      // Get the role from the first membership
      const role = result.members?.[0]?.role ?? null;

      return {
        ...result,
        role,
        members: undefined,
      };
    }),
};

import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db, eq, and, ilike, or, count, inArray } from "@se-project/db";
import { user, member } from "@se-project/db/schema/auth";
import { event } from "@se-project/db/schema/events";
import { staffAssignment } from "@se-project/db/schema/staff";
import { protectedProcedure, eventHeadProcedure } from "../index";
import { userSchema } from "../schemas";
import { ensureScopedIds, resolveOrganizationId, resolveOrganizationUserIds } from "../tenant";

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
  addByEmail: eventHeadProcedure
    .route({
      tags: ["Staff"],
      summary: "Add existing user to staff",
      description:
        "Adds an already registered user to your organization as staff or event head.",
    })
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["event_head", "staff"]).default("staff"),
      }),
    )
    .output(
      z.object({
        status: z.enum(["added", "exists"]),
        message: z.string(),
      }),
    )
    .handler(async ({ input, context }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const organizationId = await resolveOrganizationId(context);

      const existingUser = await db.query.user.findFirst({
        where: eq(user.email, normalizedEmail),
      });

      if (!existingUser) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No account found with this email. Ask the user to sign up first.",
        });
      }

      const existingMembership = await db.query.member.findFirst({
        where: and(
          eq(member.userId, existingUser.id),
          eq(member.organizationId, organizationId),
        ),
      });

      if (existingMembership) {
        return {
          status: "exists" as const,
          message: "User is already a member of your organization.",
        };
      }

      await db.insert(member).values({
        id: crypto.randomUUID(),
        userId: existingUser.id,
        organizationId,
        role: input.role,
      });

      return {
        status: "added" as const,
        message: "Staff member added successfully.",
      };
    }),

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
      const { organizationId, userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);

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

      conditions.push(eq(member.organizationId, organizationId));
      conditions.push(inArray(member.userId, scopedUserIds));

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

  workloadSummary: protectedProcedure
    .route({
      tags: ["Staff"],
      summary: "Get staff workload summary",
      description:
        "Returns assignment counts and upcoming workload per staff member in your organization.",
    })
    .output(
      z.array(
        z.object({
          userId: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          totalAssignments: z.number().int(),
          upcomingAssignments: z.number().int(),
        }),
      ),
    )
    .handler(async ({ context }) => {
      const { organizationId, userIds } = await resolveOrganizationUserIds(context);
      const scopedUserIds = ensureScopedIds(userIds);
      const now = new Date();

      const staffMembers = await db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
        })
        .from(user)
        .innerJoin(member, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, organizationId),
            inArray(member.userId, scopedUserIds),
            inArray(member.role, ["staff", "event_head"]),
          ),
        );

      if (staffMembers.length === 0) {
        return [];
      }

      const assignments = await db
        .select({
          userId: staffAssignment.userId,
          startDate: event.startDate,
          createdBy: event.createdBy,
        })
        .from(staffAssignment)
        .innerJoin(event, eq(staffAssignment.eventId, event.id))
        .where(inArray(staffAssignment.userId, staffMembers.map((m) => m.userId)));

      return staffMembers.map((staff) => {
        const scopedAssignments = assignments.filter(
          (assignment) =>
            assignment.userId === staff.userId &&
            scopedUserIds.includes(assignment.createdBy),
        );

        const upcomingAssignments = scopedAssignments.filter(
          (assignment) => assignment.startDate >= now,
        ).length;

        return {
          userId: staff.userId,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          totalAssignments: scopedAssignments.length,
          upcomingAssignments,
        };
      });
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
    .handler(async ({ input, context }) => {
      const organizationId = await resolveOrganizationId(context);

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
      const role = result.members?.find((m) => m.organizationId === organizationId)?.role ?? null;

      if (!role) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      return {
        ...result,
        role,
        members: undefined,
      };
    }),
};

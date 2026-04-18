import { z } from "zod";
import { auth } from "@se-project/auth";
import { db, eq, desc } from "@se-project/db";
import { organization, member, user } from "@se-project/db/schema/auth";
import { userProfile } from "@se-project/db/schema/profile";
import { protectedProcedure } from "../index";

type Metadata = Record<string, unknown>;

function parseMetadata(raw: string | null) {
  if (!raw) {
    return {} as Metadata;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Metadata;
    }
  } catch {
    return {} as Metadata;
  }

  return {} as Metadata;
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function ensureOrganization(
  headers: Headers,
  session: {
    user: { id: string; name?: string | null | undefined };
    session: { activeOrganizationId?: string | null | undefined };
  },
) {
  if (session.session.activeOrganizationId) {
    const active = await db.query.organization.findFirst({
      where: eq(organization.id, session.session.activeOrganizationId),
    });
    if (active) {
      return active;
    }
  }

  const memberships = await db.query.member.findMany({
    where: eq(member.userId, session.user.id),
    orderBy: desc(member.createdAt),
    with: { organization: true },
  });

  if (memberships.length > 0 && memberships[0]?.organization) {
    return memberships[0].organization;
  }

  const orgName = session.user.name?.trim()
    ? `${session.user.name.trim()}'s Organization`
    : "My Organization";
  const slug = `${normalizeSlug(orgName) || "organization"}-${session.user.id.slice(0, 8).toLowerCase()}`;

  return auth.api.createOrganization({
    headers,
    body: {
      name: orgName,
      slug,
    },
  });
}

const paymentSettingsSchema = z.object({
  invoiceBrandColor: z.string().optional(),
  billingAddress: z.string().optional(),
  billingEmail: z.string().optional(),
  billingPhone: z.string().optional(),
  billingWebsite: z.string().optional(),
  taxId: z.string().optional(),
  upiId: z.string().optional(),
  upiName: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentNotes: z.string().optional(),
});

export const profileRouter = {
  getMine: protectedProcedure
    .route({
      tags: ["Profile"],
      summary: "Get current user profile",
      description: "Returns profile details and payment preferences for the logged-in user.",
    })
    .output(
      z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
        }),
        profile: z.object({
          phone: z.string(),
          title: z.string(),
          bio: z.string(),
          address: z.string(),
          city: z.string(),
          state: z.string(),
          country: z.string(),
          postalCode: z.string(),
          website: z.string(),
        }),
        paymentSettings: paymentSettingsSchema,
      }),
    )
    .handler(async ({ context }) => {
      const session = context.session;
      const currentUser = await db.query.user.findFirst({
        where: eq(user.id, session.user.id),
      });

      const currentProfile = await db.query.userProfile.findFirst({
        where: eq(userProfile.userId, session.user.id),
      });

      const activeOrganization = await ensureOrganization(context.headers, session);
      const metadata = parseMetadata(activeOrganization.metadata ?? null);

      return {
        user: {
          id: session.user.id,
          name: currentUser?.name ?? session.user.name,
          email: currentUser?.email ?? session.user.email,
          image: currentUser?.image ?? session.user.image ?? null,
        },
        profile: {
          phone: currentProfile?.phone ?? "",
          title: currentProfile?.title ?? "",
          bio: currentProfile?.bio ?? "",
          address: currentProfile?.address ?? "",
          city: currentProfile?.city ?? "",
          state: currentProfile?.state ?? "",
          country: currentProfile?.country ?? "",
          postalCode: currentProfile?.postalCode ?? "",
          website: currentProfile?.website ?? "",
        },
        paymentSettings: {
          invoiceBrandColor: String(metadata.invoiceBrandColor ?? ""),
          billingAddress: String(metadata.billingAddress ?? ""),
          billingEmail: String(metadata.billingEmail ?? ""),
          billingPhone: String(metadata.billingPhone ?? ""),
          billingWebsite: String(metadata.billingWebsite ?? ""),
          taxId: String(metadata.taxId ?? ""),
          upiId: String(metadata.upiId ?? ""),
          upiName: String(metadata.upiName ?? ""),
          bankName: String(metadata.bankName ?? ""),
          bankAccountName: String(metadata.bankAccountName ?? ""),
          bankAccountNumber: String(metadata.bankAccountNumber ?? ""),
          bankIfsc: String(metadata.bankIfsc ?? ""),
          paymentTerms: String(metadata.paymentTerms ?? ""),
          paymentNotes: String(metadata.paymentNotes ?? ""),
        },
      };
    }),

  updateMine: protectedProcedure
    .route({
      tags: ["Profile"],
      summary: "Update current user profile",
      description: "Updates name, photo and additional profile fields for the current user.",
    })
    .input(
      z.object({
        name: z.string().min(2),
        image: z.string().url().or(z.literal("")).optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        bio: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
        website: z.string().optional(),
      }),
    )
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      await db
        .update(user)
        .set({
          name: input.name,
          image: input.image?.trim() ? input.image.trim() : null,
        })
        .where(eq(user.id, userId));

      await db
        .insert(userProfile)
        .values({
          id: crypto.randomUUID(),
          userId,
          phone: input.phone?.trim() || null,
          title: input.title?.trim() || null,
          bio: input.bio?.trim() || null,
          address: input.address?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          country: input.country?.trim() || null,
          postalCode: input.postalCode?.trim() || null,
          website: input.website?.trim() || null,
        })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: {
            phone: input.phone?.trim() || null,
            title: input.title?.trim() || null,
            bio: input.bio?.trim() || null,
            address: input.address?.trim() || null,
            city: input.city?.trim() || null,
            state: input.state?.trim() || null,
            country: input.country?.trim() || null,
            postalCode: input.postalCode?.trim() || null,
            website: input.website?.trim() || null,
            updatedAt: new Date(),
          },
        });

      return { success: true } as const;
    }),

  updatePaymentSettings: protectedProcedure
    .route({
      tags: ["Profile"],
      summary: "Update invoice payment settings",
      description: "Stores optional UPI and bank details used by invoice PDF/Excel exports.",
    })
    .input(paymentSettingsSchema)
    .output(z.object({ success: z.literal(true) }))
    .handler(async ({ input, context }) => {
      const activeOrganization = await ensureOrganization(context.headers, context.session);
      const existingMetadata = parseMetadata(activeOrganization.metadata ?? null);

      const nextMetadata = {
        ...existingMetadata,
        invoiceBrandColor: input.invoiceBrandColor?.trim() || null,
        billingAddress: input.billingAddress?.trim() || null,
        billingEmail: input.billingEmail?.trim() || null,
        billingPhone: input.billingPhone?.trim() || null,
        billingWebsite: input.billingWebsite?.trim() || null,
        taxId: input.taxId?.trim() || null,
        upiId: input.upiId?.trim() || null,
        upiName: input.upiName?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccountName: input.bankAccountName?.trim() || null,
        bankAccountNumber: input.bankAccountNumber?.trim() || null,
        bankIfsc: input.bankIfsc?.trim() || null,
        paymentTerms: input.paymentTerms?.trim() || null,
        paymentNotes: input.paymentNotes?.trim() || null,
      };

      await db
        .update(organization)
        .set({ metadata: JSON.stringify(nextMetadata) })
        .where(eq(organization.id, activeOrganization.id));

      return { success: true } as const;
    }),
};

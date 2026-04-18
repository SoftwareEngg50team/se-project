"use client";

import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Landmark, Palette, QrCode, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@se-project/ui/components/button";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { Textarea } from "@se-project/ui/components/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { Avatar, AvatarFallback, AvatarImage } from "@se-project/ui/components/avatar";
import Loader from "@/components/loader";
import { PageHeader } from "@/components/shared/page-header";
import { orpc } from "@/utils/orpc";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  image: z.string().url("Enter a valid image URL").or(z.literal("")),
  phone: z.string(),
  title: z.string(),
  bio: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  postalCode: z.string(),
  website: z.string(),
});

const paymentSchema = z.object({
  invoiceBrandColor: z.string(),
  billingAddress: z.string(),
  billingEmail: z.string(),
  billingPhone: z.string(),
  billingWebsite: z.string(),
  taxId: z.string(),
  upiId: z.string(),
  upiName: z.string(),
  bankName: z.string(),
  bankAccountName: z.string(),
  bankAccountNumber: z.string(),
  bankIfsc: z.string(),
  paymentTerms: z.string(),
  paymentNotes: z.string(),
});

function initialFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(orpc.profile.getMine.queryOptions());

  const updateProfile = useMutation(orpc.profile.updateMine.mutationOptions());
  const updatePayment = useMutation(orpc.profile.updatePaymentSettings.mutationOptions());

  const profileDefaults = useMemo(
    () => ({
      name: data?.user.name ?? "",
      image: data?.user.image ?? "",
      phone: data?.profile.phone ?? "",
      title: data?.profile.title ?? "",
      bio: data?.profile.bio ?? "",
      address: data?.profile.address ?? "",
      city: data?.profile.city ?? "",
      state: data?.profile.state ?? "",
      country: data?.profile.country ?? "",
      postalCode: data?.profile.postalCode ?? "",
      website: data?.profile.website ?? "",
    }),
    [data],
  );

  const paymentDefaults = useMemo(
    () => ({
      invoiceBrandColor: data?.paymentSettings.invoiceBrandColor ?? "",
      billingAddress: data?.paymentSettings.billingAddress ?? "",
      billingEmail: data?.paymentSettings.billingEmail ?? "",
      billingPhone: data?.paymentSettings.billingPhone ?? "",
      billingWebsite: data?.paymentSettings.billingWebsite ?? "",
      taxId: data?.paymentSettings.taxId ?? "",
      upiId: data?.paymentSettings.upiId ?? "",
      upiName: data?.paymentSettings.upiName ?? "",
      bankName: data?.paymentSettings.bankName ?? "",
      bankAccountName: data?.paymentSettings.bankAccountName ?? "",
      bankAccountNumber: data?.paymentSettings.bankAccountNumber ?? "",
      bankIfsc: data?.paymentSettings.bankIfsc ?? "",
      paymentTerms: data?.paymentSettings.paymentTerms ?? "",
      paymentNotes: data?.paymentSettings.paymentNotes ?? "",
    }),
    [data],
  );

  const profileForm = useForm({
    defaultValues: profileDefaults,
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync(value, {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: [["profile", "getMine"]] });
          toast.success("Profile updated successfully");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to update profile");
        },
      });
    },
    validators: {
      onSubmit: profileSchema,
    },
  });

  const paymentForm = useForm({
    defaultValues: paymentDefaults,
    onSubmit: async ({ value }) => {
      await updatePayment.mutateAsync(value, {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: [["profile", "getMine"]] });
          toast.success("Invoice payment settings saved");
        },
        onError: (error) => {
          toast.error(error.message || "Failed to save payment settings");
        },
      });
    },
    validators: {
      onSubmit: paymentSchema,
    },
  });

  if (isLoading || !data) {
    return <Loader />;
  }

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Profile & Settings"
        description="Manage your personal details, avatar, and invoice payment methods."
      />

      <Card className="surface-glow border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="size-5 text-primary" />
            Account Identity
          </CardTitle>
          <CardDescription>
            Keep your profile up to date with contact information and a professional photo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/70 p-4">
            <Avatar size="lg">
              <AvatarImage src={profileForm.state.values.image || undefined} alt={profileForm.state.values.name} />
              <AvatarFallback>{initialFromName(profileForm.state.values.name || data.user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{profileForm.state.values.name || data.user.name}</p>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              profileForm.handleSubmit();
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <profileForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Full Name</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-sm text-destructive">{error?.message}</p>
                    ))}
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="title">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Role / Title</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} placeholder="Event Manager" />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="image">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      <Camera className="size-4" />
                      Profile Photo URL
                    </Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} placeholder="https://images.example.com/photo.jpg" />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-sm text-destructive">{error?.message}</p>
                    ))}
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="phone">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Phone</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} placeholder="+91 9876543210" />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="website">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Website</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} placeholder="https://yourcompany.com" />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="bio">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name}>Bio</Label>
                    <Textarea id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} rows={3} placeholder="A quick summary about you and your role." />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="address">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name}>Address</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} placeholder="Street, Area" />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="city">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>City</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
                  </div>
                )}
              </profileForm.Field>
              <profileForm.Field name="state">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>State</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
                  </div>
                )}
              </profileForm.Field>
              <profileForm.Field name="country">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Country</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
                  </div>
                )}
              </profileForm.Field>
              <profileForm.Field name="postalCode">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Postal Code</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} onBlur={field.handleBlur} />
                  </div>
                )}
              </profileForm.Field>
            </div>

            <profileForm.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  <Save className="mr-2 size-4" />
                  {isSubmitting ? "Saving profile..." : "Save Profile"}
                </Button>
              )}
            </profileForm.Subscribe>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5 text-primary" />
            Invoice Payment Methods (Optional)
          </CardTitle>
          <CardDescription>
            These settings power QR payment and bank transfer details in invoice PDF and Excel exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              paymentForm.handleSubmit();
            }}
            className="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <paymentForm.Field name="invoiceBrandColor">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2"><Palette className="size-4" />Invoice Accent Color</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="#1A3C8F" />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="taxId">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Tax ID / GSTIN</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="billingEmail">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Billing Email</Label>
                    <Input id={field.name} type="email" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="billingPhone">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Billing Phone</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="billingWebsite">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Billing Website</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="upiId">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2"><QrCode className="size-4" />UPI ID</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="business@bank" />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="upiName">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>UPI Name</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="EventFlow Pvt Ltd" />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="bankName">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2"><Landmark className="size-4" />Bank Name</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="bankAccountName">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Account Holder Name</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="bankAccountNumber">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Account Number</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="bankIfsc">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>IFSC</Label>
                    <Input id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="billingAddress">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name}>Billing Address</Label>
                    <Textarea id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} rows={2} />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="paymentTerms">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name}>Payment Terms</Label>
                    <Textarea id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} rows={3} placeholder="Payment due within 7 days..." />
                  </div>
                )}
              </paymentForm.Field>
              <paymentForm.Field name="paymentNotes">
                {(field) => (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={field.name}>Payment Notes</Label>
                    <Textarea id={field.name} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} rows={3} placeholder="Extra instructions for customers." />
                  </div>
                )}
              </paymentForm.Field>
            </div>

            <paymentForm.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  <Save className="mr-2 size-4" />
                  {isSubmitting ? "Saving settings..." : "Save Payment Settings"}
                </Button>
              )}
            </paymentForm.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

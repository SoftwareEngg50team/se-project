"use client";

import { Button } from "@se-project/ui/components/button";
import { Input } from "@se-project/ui/components/input";
import { Label } from "@se-project/ui/components/label";
import { Textarea } from "@se-project/ui/components/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { orpc } from "@/utils/orpc";

interface EventFormProps {
  defaultValues?: {
    name: string;
    startDate: string;
    endDate: string;
    location: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    notes: string;
    totalRevenue: string;
  };
  eventId?: string;
}

const eventSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().min(1, "Location is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientPhone: z.string(),
  clientEmail: z.string().refine(
    (val) => val === "" || z.string().email().safeParse(val).success,
    { message: "Please enter a valid email address" },
  ),
  notes: z.string(),
  totalRevenue: z.string().refine(
    (val) => val === "" || /^\d+$/.test(val),
    { message: "Total revenue must be a whole number in paise" },
  ),
});

export function EventForm({ defaultValues, eventId }: EventFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = Boolean(eventId);

  const createEvent = useMutation(orpc.events.create.mutationOptions());
  const updateEvent = useMutation(orpc.events.update.mutationOptions());

  const form = useForm({
    defaultValues: defaultValues ?? {
      name: "",
      startDate: "",
      endDate: "",
      location: "",
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      notes: "",
      totalRevenue: "",
    },
    onSubmit: async ({ value }) => {
      const totalRevenue = value.totalRevenue.trim() === "" ? undefined : Number(value.totalRevenue);

      const payload = {
        name: value.name,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate),
        location: value.location,
        clientName: value.clientName,
        clientPhone: value.clientPhone || undefined,
        clientEmail: value.clientEmail || undefined,
        notes: value.notes || undefined,
        totalRevenue,
      };

      try {
        if (isEditing && eventId) {
          await updateEvent.mutateAsync({ id: eventId, ...payload });
          queryClient.invalidateQueries({
            queryKey: [["events", "list"]],
          });
          queryClient.invalidateQueries({
            queryKey: orpc.events.getById.queryOptions({ input: { id: eventId } }).queryKey,
          });
          router.push(`/events/${eventId}`);
          toast.success("Event updated successfully");
        } else {
          await createEvent.mutateAsync(payload);
          queryClient.invalidateQueries({
            queryKey: [["events", "list"]],
          });
          router.push("/events");
          toast.success("Event created successfully");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save event",
        );
      }
    },
    validators: {
      onSubmit: eventSchema,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-8"
    >
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Event Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter event name"
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="startDate">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Start Date</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="datetime-local"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="endDate">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>End Date</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="datetime-local"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="location">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Location</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter event location"
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="clientName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Client Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter client name"
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="clientPhone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Client Phone</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="tel"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter phone number"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="clientEmail">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Client Email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter email address"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-red-500">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Notes</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={4}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="totalRevenue">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Total Revenue (in paise)</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  inputMode="numeric"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter amount in paise"
                />
                <p className="text-xs text-muted-foreground">
                  Display value: {field.state.value ? `\u20B9${(Number(field.state.value) / 100).toFixed(2)}` : "—"}
                </p>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Update Event"
                  : "Create Event"}
            </Button>
          )}
        </form.Subscribe>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(isEditing && eventId ? `/events/${eventId}` : "/events")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { EventForm } from "@/components/events/event-form";

function toDatetimeLocal(date: string | Date): string {
  if (!date) return "";
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: eventData, isLoading } = useQuery(
    orpc.events.getById.queryOptions({ input: { id } }),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading event...</p>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Event not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Event</h1>
        <p className="text-muted-foreground">
          Update the details for {eventData.name}.
        </p>
      </div>
      <EventForm
        eventId={id}
        defaultValues={{
          name: eventData.name,
          startDate: toDatetimeLocal(eventData.startDate),
          endDate: toDatetimeLocal(eventData.endDate),
          location: eventData.location,
          clientName: eventData.clientName,
          clientPhone: eventData.clientPhone ?? "",
          clientEmail: eventData.clientEmail ?? "",
          notes: eventData.notes ?? "",
          totalRevenue: eventData.totalRevenue != null ? String(eventData.totalRevenue) : "",
        }}
      />
    </div>
  );
}

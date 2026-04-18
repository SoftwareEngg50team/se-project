import { EventForm } from "@/components/events/event-form";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Event</h1>
        <p className="text-muted-foreground">Fill in the details to create a new event.</p>
      </div>
      <EventForm />
    </div>
  );
}

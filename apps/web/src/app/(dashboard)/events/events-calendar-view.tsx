"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { orpc } from "@/utils/orpc";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageHeader } from "@/components/shared/page-header";

type Event = {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  location: string;
  status: string;
  clientName: string;
};

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

function getEventsByDate(events: Event[]): Map<string, Event[]> {
  const eventsByDate = new Map<string, Event[]>();
  
  events.forEach((event) => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    // Add event for each day it spans
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!eventsByDate.has(dateStr)) {
        eventsByDate.set(dateStr, []);
      }
      eventsByDate.get(dateStr)!.push(event);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return eventsByDate;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "upcoming":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "in_progress":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
}

export function EventsCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data, isLoading } = useQuery(
    orpc.events.list.queryOptions({
      input: { status: undefined },
    }),
  );

  const events = (data?.events ?? []) as Event[];
  const eventsByDate = getEventsByDate(events);
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days: (number | null)[] = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Events Calendar" description="View your events on a calendar">
        <Button render={<Link href="/events/new" />}>
          <Plus className="mr-2 size-4" />
          New Event
        </Button>
      </PageHeader>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <CardTitle>{monthName}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0 bg-muted/50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="border-r border-b border-border px-2 py-3 text-center text-xs font-semibold uppercase text-muted-foreground last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0 bg-background">
              {days.map((day, idx) => {
                const dateStr = day
                  ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                      .toISOString()
                      .split("T")[0]
                  : null;
                
                const dayEvents = dateStr ? (eventsByDate.get(dateStr) ?? []) : [];
                const isToday =
                  day &&
                  new Date().toDateString() ===
                    new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                return (
                  <div
                    key={idx}
                    className={`min-h-[120px] border-r border-b border-border p-2 ${
                      !day ? "bg-muted/30" : "bg-background"
                    } ${isToday ? "bg-primary/5" : ""} last:border-r-0`}
                  >
                    {day && (
                      <>
                        <div
                          className={`mb-2 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {day}
                        </div>
                        
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <Link
                              key={event.id}
                              href={`/events/${event.id}`}
                              className={`block truncate rounded px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 ${getStatusColor(
                                event.status,
                              )}`}
                              title={`${event.name} - ${event.clientName}`}
                            >
                              {event.name}
                            </Link>
                          ))}
                          
                          {dayEvents.length > 3 && (
                            <div className="rounded px-2 py-1 text-xs font-medium text-muted-foreground">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading events...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { status: "upcoming", label: "Upcoming" },
          { status: "in_progress", label: "In Progress" },
          { status: "completed", label: "Completed" },
          { status: "cancelled", label: "Cancelled" },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`size-3 rounded ${getStatusColor(status).split(" ")[0]}`} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

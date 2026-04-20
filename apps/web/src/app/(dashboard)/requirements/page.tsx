"use client";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";

type Section = {
  title: string;
  items: string[];
};

const sections: Section[] = [
  {
    title: "1. Identification of Users",
    items: [
      "1.1. Primary Users",
      "Owner - Oversees business operations, confirms event bookings, handles payments and financial tracking, and makes equipment purchase decisions.",
      "Event Head - Manages event execution, allocates equipment to events, assigns staff members, and coordinates logistics.",
      "1.2. Secondary Users - On-ground staff.",
      "1.3. Tertiary Users - Customers (event organizers, wedding planners), equipment repair vendors.",
    ],
  },
  {
    title: "2. User Research",
    items: [
      "2.1. Research Method",
      "Interview conducted with the Owner.",
      "Direct observation of on-ground staff during event preparation and dismantling.",
    ],
  },
  {
    title: "3. Findings from Owner Interview",
    items: [
      "3.1. Inventory Management Issues",
      "Equipment availability is tracked manually.",
      "No centralized system to see which items are allocated to which event.",
      "Confusion when multiple events occur on the same date.",
      "Damage reporting is informal.",
      "No documented maintenance history.",
      "3.2. Staff Management Issues",
      "Staff assignments communicated via WhatsApp.",
      "No formal record of event-wise staff deployment.",
      "Attendance not systematically recorded.",
      "Payments calculated manually.",
      "Difficult to calculate labor cost per event.",
      "Regular reminder to staff for their assigned projects.",
      "3.3. Billing and Payment Issues",
      "Invoices created manually.",
      "No structured tracking of pending payments.",
      "Partial payments are difficult to manage.",
      "No dashboard view of outstanding dues.",
      "Follow-ups are memory-based.",
    ],
  },
  {
    title: "4. User Stories",
    items: [
      "4.1. Event Management",
      "As an Event Head, I want to create an event with date, location, and client details, so that all operational planning is centralized.",
      "As an Event Head, I want to view all upcoming events in a calendar view, so that scheduling conflicts are visible in advance.",
      "4.2. Inventory Management",
      "As an Event Head, I want to check equipment availability for a selected event date before confirming a booking, so that double allocation of equipment is avoided.",
      "As an Event Head, I want to assign specific equipment items to an event at least 24 hours before event start time, so that preparation can be completed in advance.",
      "As an Event Head, I want to update equipment status as Available, Assigned, In Transit, At Event, or Under Repair, so that real-time inventory condition is visible.",
      "As an Event Head, I want to confirm equipment return after an event and record missing or damaged items within 12 hours of completion, so that inventory discrepancies are documented immediately.",
      "As an Owner, I want to view monthly equipment utilization reports, so that purchase decisions are data-driven.",
      "4.3. Staff Communication and Assignment",
      "As an Event Head, I want the system to send a weekly message to all staff listing upcoming events, so that they are informed about scheduled work in advance.",
      "As an Event Head, I want an automatic message to be sent immediately when a staff member is assigned to a new event, so that they receive instant notification.",
      "As an Event Head, I want an automatic message to be sent immediately if an assigned event is cancelled, so that unnecessary travel is avoided.",
      "4.4. Attendance and Salary Tracking",
      "As an Event Head, I want to record staff attendance on event day, so that salary calculations are accurate.",
      "As an Owner, I want to calculate total salary payout for each event, so that labor costs are clearly tracked.",
      "4.5. Expense Tracking",
      "As an Owner, I want to record all event-related expenses including salaries, food, transportation, equipment repair, and miscellaneous costs, so that total event cost is documented.",
      "As an Owner, I want to view a complete expense summary for each event, so that I can evaluate profitability.",
      "As an Owner, I want to see profit or loss for each event after subtracting all expenses from total revenue, so that business performance is measurable.",
      "4.6. Payment and Invoice Tracking",
      "As an Owner, I want to record advance payment received at the time of booking, so that event confirmation is financially secured.",
      "As an Owner, I want to track remaining balance amount for each event, so that pending payments are clearly visible.",
      "As an Owner, I want to generate an invoice immediately after event completion, so that billing is standardized and not delayed.",
      "As an Owner, I want to record partial payments against invoices, so that outstanding balances remain accurate.",
      "As an Owner, I want to view all unpaid invoices older than 15 days, so that payment follow-ups can be prioritized.",
      "As an Owner, I want to track payments made to vendors for food, transportation, or repairs, so that vendor dues are also monitored.",
      "As an Owner, I want a dashboard showing total revenue, total expenses, total outstanding customer payments, and total vendor dues, so that overall financial status is visible at a glance.",
    ],
  },
];

export default function RequirementsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Project Requirements"
        description="Captured user research, findings, and full user story set."
      />

      <div className="grid gap-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                {section.items.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
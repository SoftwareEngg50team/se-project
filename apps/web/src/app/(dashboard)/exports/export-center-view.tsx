"use client";

import { Download, CalendarDays, ReceiptText, Store } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@se-project/ui/components/card";
import { PageHeader } from "@/components/shared/page-header";

const exportsList = [
  {
    id: "events",
    title: "Events CSV",
    description: "Includes event schedule, client details, and revenue fields.",
    href: "/api/exports/events",
    icon: CalendarDays,
  },
  {
    id: "vendors",
    title: "Vendors CSV",
    description: "Includes vendor contacts and type classifications.",
    href: "/api/exports/vendors",
    icon: Store,
  },
  {
    id: "invoices",
    title: "Invoices CSV",
    description: "Includes amounts, paid totals, balances, and due dates.",
    href: "/api/exports/invoices",
    icon: ReceiptText,
  },
];

export function ExportCenterView() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Export Center"
        description="Download business-ready CSV files for reporting and backup."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportsList.map((item) => (
          <Card key={item.id} className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="size-4 text-primary" />
                {item.title}
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" render={<a href={item.href} />}>
                <Download className="mr-2 size-4" />
                Download CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

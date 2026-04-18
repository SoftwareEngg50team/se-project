"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@se-project/ui/components/breadcrumb";
import { SidebarTrigger } from "@se-project/ui/components/sidebar";
import { Separator } from "@se-project/ui/components/separator";
import { usePathname } from "next/navigation";
import React from "react";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  events: "Events",
  equipment: "Equipment",
  staff: "Staff",
  invoices: "Invoices",
  vendors: "Vendors",
  reports: "Reports",
  notifications: "Notifications",
  profile: "Profile",
  exports: "Export Center",
  assistant: "AI Assistant",
  new: "New",
  edit: "Edit",
};

function isIdSegment(segment: string): boolean {
  // Match UUIDs and other opaque IDs (long alphanumeric strings)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
    || (/^[A-Za-z0-9_-]{20,}$/.test(segment) && !labelMap[segment]);
}

export function TopBar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-sm px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, index) => {
            const href = `/${segments.slice(0, index + 1).join("/")}`;
            const isLast = index === segments.length - 1;
            // Hide long IDs from breadcrumbs - show "Details" instead
            const label = labelMap[segment] || (isIdSegment(segment) ? "Details" : segment);

            return (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <NotificationBell />
      </div>
    </header>
  );
}

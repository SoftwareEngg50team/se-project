"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Package,
  Users,
  FileText,
  Store,
  BarChart3,
  Bell,
  UserRound,
  FileDown,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@se-project/ui/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Events",
    href: "/events",
    icon: CalendarDays,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Equipment",
    href: "/equipment",
    icon: Package,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Staff",
    href: "/staff",
    icon: Users,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: FileText,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Vendors",
    href: "/vendors",
    icon: Store,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserRound,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Exports",
    href: "/exports",
    icon: FileDown,
    roles: ["owner", "eventHead", "staff"],
  },
  {
    label: "Assistant",
    href: "/assistant",
    icon: Sparkles,
    roles: ["owner", "eventHead", "staff"],
  },
];

export function AppSidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const filteredItems = navItems.filter((item) =>
    item.roles.includes(userRole),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-secondary text-white">
                <CalendarDays className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">EventFlow</span>
                <span className="truncate text-xs text-muted-foreground">Management</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-y-1">
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href as any} />}
                    tooltip={item.label}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <ModeToggle />
              <UserMenu />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

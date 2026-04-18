import { auth } from "@se-project/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@se-project/ui/components/sidebar";
import { TooltipProvider } from "@se-project/ui/components/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  let userRole = "staff";
  if (session.session.activeOrganizationId) {
    try {
      const activeMember = await auth.api.getActiveMember({
        headers: await headers(),
      });
      if (activeMember) {
        userRole = activeMember.role ?? "staff";
      }
    } catch {
      // No active org membership, default to staff
    }
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar userRole={userRole} />
        <SidebarInset>
          <TopBar />
          <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl animate-fade-slide-up">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

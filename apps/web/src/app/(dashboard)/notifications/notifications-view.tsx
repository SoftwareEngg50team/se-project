"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  BellRing,
  Settings2,
  ShieldCheck,
  Mail,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@se-project/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@se-project/ui/components/card";
import { Checkbox } from "@se-project/ui/components/checkbox";
import { Separator } from "@se-project/ui/components/separator";
import { ScrollArea } from "@se-project/ui/components/scroll-area";
import { orpc } from "@/utils/orpc";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";

type NotificationPreferences = {
  eventAssignments: boolean;
  paymentUpdates: boolean;
  equipmentAlerts: boolean;
  emailDigest: boolean;
  pushAlerts: boolean;
};

const defaultPreferences: NotificationPreferences = {
  eventAssignments: true,
  paymentUpdates: true,
  equipmentAlerts: true,
  emailDigest: false,
  pushAlerts: false,
};

function formatTime(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadPreferences(): NotificationPreferences {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const raw = window.localStorage.getItem("eventflow.notification-preferences");
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(raw) } as NotificationPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function NotificationsView() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "eventflow.notification-preferences",
      JSON.stringify(preferences),
    );
  }, [preferences]);

  const notificationsQuery = useQuery(
    orpc.notifications.list.queryOptions({
      input: { page: 1, limit: 100, unreadOnly },
    }),
  );

  const unreadCountQuery = useQuery(
    orpc.notifications.getUnreadCount.queryOptions(),
  );
  const markRead = useMutation(orpc.notifications.markRead.mutationOptions());

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = unreadCountQuery.data?.count ?? 0;

  const unreadIds = useMemo(
    () =>
      notifications
        .filter((notification) => !notification.read)
        .map((notification) => notification.id),
    [notifications],
  );

  const handleMarkAllRead = async () => {
    if (unreadIds.length === 0) return;

    await markRead.mutateAsync(
      { ids: unreadIds },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: orpc.notifications.list.queryOptions({
              input: { page: 1, limit: 100, unreadOnly },
            }).queryKey,
          });
          await queryClient.invalidateQueries({
            queryKey: orpc.notifications.getUnreadCount.queryOptions().queryKey,
          });
          toast.success("All notifications marked as read");
        },
        onError: (error) =>
          toast.error(error.message || "Failed to mark notifications as read"),
      },
    );
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Review recent alerts and fine-tune how EventFlow reaches you."
      >
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-sm">
          <BellRing className="size-4 text-primary" />
          <span className="font-medium">{unreadCount} unread</span>
        </div>
        <Button
          variant="outline"
          onClick={handleMarkAllRead}
          disabled={unreadIds.length === 0 || markRead.isPending}
        >
          <CheckCheck className="mr-2 size-4" />
          Mark all as read
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="size-5 text-primary" />
              Activity Feed
            </CardTitle>
            <CardDescription>
              Live notifications for event assignments, payment updates, and equipment changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setUnreadOnly((current) => !current)}
              >
                {unreadOnly ? "Showing unread" : "Show unread only"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Auto-refreshes every 30 seconds from the bell menu.
              </span>
            </div>

            <ScrollArea className="h-[520px] rounded-xl border border-border/60">
              {notificationsQuery.isLoading ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No notifications found.
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`space-y-2 p-4 ${notification.read ? "opacity-65" : "bg-muted/30"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={notification.type} />
                            {!notification.read && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-6 text-foreground">
                            {notification.message}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatTime(notification.sentAt)}
                        </span>
                      </div>
                      {notification.event && (
                        <p className="text-xs text-muted-foreground">
                          Related event: {notification.event.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="size-5 text-primary" />
                Preferences
              </CardTitle>
              <CardDescription>
                Browser-persisted preferences for day-to-day workflow alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "eventAssignments" as const,
                  label: "Event assignment alerts",
                  description: "Get notified when you are assigned to an event.",
                  icon: ShieldCheck,
                },
                {
                  key: "paymentUpdates" as const,
                  label: "Payment updates",
                  description: "Notify me when invoices receive payments.",
                  icon: Mail,
                },
                {
                  key: "equipmentAlerts" as const,
                  label: "Equipment alerts",
                  description: "Track assignment, return, and repair changes.",
                  icon: BellRing,
                },
                {
                  key: "emailDigest" as const,
                  label: "Daily email digest",
                  description: "Bundle non-urgent notifications into one summary.",
                  icon: Mail,
                },
                {
                  key: "pushAlerts" as const,
                  label: "Push notifications",
                  description: "Show browser alerts for urgent changes.",
                  icon: Smartphone,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      checked={preferences[item.key]}
                      onCheckedChange={() => togglePreference(item.key)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Reminder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Notifications are currently delivered in-app. Hooking the preferences to email or push delivery would require a backend preference store and sender jobs.
              </p>
              <Separator />
              <p>
                The current implementation still gives you read/unread state, unread count, and a single place to clear alerts.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
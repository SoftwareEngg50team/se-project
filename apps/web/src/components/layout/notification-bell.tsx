"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@se-project/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@se-project/ui/components/popover";
import { ScrollArea } from "@se-project/ui/components/scroll-area";
import { orpc } from "@/utils/orpc";

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: unreadData } = useQuery({
    ...orpc.notifications.getUnreadCount.queryOptions(),
    refetchInterval: 30000,
  });

  const { data: notificationsData, isLoading } = useQuery({
    ...orpc.notifications.list.queryOptions({
      input: { page: 1, limit: 20 },
    }),
    enabled: open,
  });

  const markRead = useMutation(orpc.notifications.markRead.mutationOptions());

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notificationsData?.notifications ?? [];

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.read)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    await markRead.mutateAsync(
      { ids: unreadIds },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: orpc.notifications.getUnreadCount.queryOptions({}).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: orpc.notifications.list.queryOptions({
              input: { page: 1, limit: 20 },
            }).queryKey,
          });
        },
      },
    );
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        <span className="sr-only">Notifications</span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={handleMarkAllRead}
                disabled={markRead.isPending}
              >
                Mark all as read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              render={<Link href="/notifications" />}
            >
              View all
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex flex-col gap-1 px-4 py-3 ${
                    n.read
                      ? "opacity-60"
                      : "bg-muted/50"
                  }`}
                >
                  <p className="text-sm leading-snug">{n.message}</p>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(n.sentAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

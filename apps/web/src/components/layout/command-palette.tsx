"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@se-project/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@se-project/ui/components/command";
import { CalendarPlus, CreditCard, FileDown, Sparkles, Store, UserRound } from "lucide-react";

type CommandAction = {
  id: string;
  title: string;
  hint: string;
  shortcut: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  group: "Quick Actions" | "Navigation";
};

const actions: CommandAction[] = [
  {
    id: "create-event",
    title: "Create Event",
    hint: "Open new event form",
    shortcut: "E",
    href: "/events/new",
    icon: CalendarPlus,
    group: "Quick Actions",
  },
  {
    id: "add-vendor",
    title: "Add Vendor",
    hint: "Open vendors with add dialog",
    shortcut: "V",
    href: "/vendors?create=1",
    icon: Store,
    group: "Quick Actions",
  },
  {
    id: "record-payment",
    title: "Record Payment",
    hint: "Jump to invoices to record a payment",
    shortcut: "P",
    href: "/invoices",
    icon: CreditCard,
    group: "Quick Actions",
  },
  {
    id: "profile",
    title: "Go to Profile",
    hint: "Profile and payment settings",
    shortcut: "U",
    href: "/profile",
    icon: UserRound,
    group: "Navigation",
  },
  {
    id: "exports",
    title: "Open Export Center",
    hint: "Download CSV exports",
    shortcut: "X",
    href: "/exports",
    icon: FileDown,
    group: "Navigation",
  },
  {
    id: "assistant",
    title: "Open AI Assistant",
    hint: "Chat and execute commands",
    shortcut: "A",
    href: "/assistant",
    icon: Sparkles,
    group: "Navigation",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const grouped = useMemo(() => {
    return {
      quick: actions.filter((action) => action.group === "Quick Actions"),
      navigation: actions.filter((action) => action.group === "Navigation"),
    };
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 border-border/60 bg-background/70"
        onClick={() => setOpen(true)}
      >
        <span className="text-xs text-muted-foreground">Search</span>
        <kbd className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Find an action..." />
          <CommandList>
            <CommandEmpty>No command found.</CommandEmpty>

            <CommandGroup heading="Quick Actions">
              {grouped.quick.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`${action.title} ${action.hint}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(action.href as Route);
                  }}
                >
                  <action.icon className="size-4" />
                  <div className="flex flex-col">
                    <span>{action.title}</span>
                    <span className="text-xs text-muted-foreground">{action.hint}</span>
                  </div>
                  <CommandShortcut>{action.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Navigation">
              {grouped.navigation.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`${action.title} ${action.hint}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(action.href as Route);
                  }}
                >
                  <action.icon className="size-4" />
                  <div className="flex flex-col">
                    <span>{action.title}</span>
                    <span className="text-xs text-muted-foreground">{action.hint}</span>
                  </div>
                  <CommandShortcut>{action.shortcut}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

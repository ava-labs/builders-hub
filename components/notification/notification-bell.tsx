"use client";

import Image from "next/image";
import { useGetNotifications } from "@/hooks/use-get-notifications";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";

export type DbNotification = {
  id: number;
  audience: string;
  type: string;
  title: string;
  content: string;
  content_type: string;
  short_description: string;
  template: string;
  status: string;
};
const metricsBaseUrl: string | undefined =
  process.env.NEXT_PUBLIC_AVALANCHE_METRICS_URL;
type NotificationsResponse = Record<string, DbNotification[]>;

export default function NotificationBell(): React.JSX.Element {
  const { data: session } = useSession() ?? {}
  const [open, setOpen] = useState<boolean>(false);
  const [readedNotifications, setReadedNotifications] = useState<number[]>([]);
  const { resolvedTheme } = useTheme()
  const users: string[] = [session?.user?.id || ''];
  const className: string | undefined = undefined;

  const { data, refetch } = useGetNotifications(users, session?.jwt_token ?? '');

  const notifications: DbNotification[] = useMemo((): DbNotification[] => {
    const payload: NotificationsResponse | null = (data ?? null) as NotificationsResponse | null;
    if (!payload) return [];
    const merged: DbNotification[] = users.flatMap((u: string): DbNotification[] => payload[u] ?? []);
    const uniqueById: Map<number, DbNotification> = new Map<number, DbNotification>();
    merged.forEach((n: DbNotification) => uniqueById.set(n.id, n));
    return Array.from(uniqueById.values());
  }, [data, users]);

  useEffect((): void => {
    if (open) return;
    if (readedNotifications.length === 0) return;

    const fetchNotifications = async (): Promise<void> => {
      try {
        const response: Response = await fetch(`/api/notifications/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(readedNotifications),
        });

        if (!response.ok) {
          const text: string = await response.text();
          throw new Error(text || "Failed to read notifications");
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setReadedNotifications([]);
        refetch();
      }
    };

    void fetchNotifications();
  }, [open, readedNotifications.length, users]);

  const readNotification = (id: number) => {
    if (readedNotifications.includes(id)) return;
    setReadedNotifications([...readedNotifications, id]);
  }

  const handleMarkAllAsRead = (): void => {
    setReadedNotifications(notifications.map((n: DbNotification) => n.id))
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild >
        <button
          type="button"
          className={cn("relative inline-flex h-9 w-9 items-center justify-center", className)}
          aria-label="Open notifications"
        >
          {
            resolvedTheme == 'dark' ? (
              notifications.some((n) => n.status == 'sent') ? (
                <Image
                  src="/images/bell-dot.svg"
                  alt="notification bell"
                  width={24}
                  height={24}
                />
              ) : (
                <Image
                  src="/images/bell.svg"
                  alt="notification bell"
                  width={24}
                  height={24}
                />
              )

            ) : (
              notifications.some((n) => n.status == 'sent') ? (
                <Image
                  src="/images/bell-dot-light.svg"
                  alt="notification bell"
                  width={24}
                  height={24}
                />
              ) : (
                <Image
                  src="/images/bell-light.svg"
                  alt="notification bell"
                  width={24}
                  height={24}
                />
              )
            )
          }
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "flex flex-col justify-between",
          "translate-x-[-38px] translate-y-3.5",
          "w-[378px] h-[591px] px-6 py-0 pb-6",
          "bg-zinc-50 dark:bg-zinc-950 border-red-600! border",
          "border border-border rounded-lg shadow-2xl"
        )}
      >
        <div className="w-full flex flex-col justify-between gap-1 py-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Notifications</h2>
            <PopoverClose className="cursor-pointer">
              <Image src="/images/close-icon.svg" alt="close-icon" width={24} height={24} />
            </PopoverClose>
          </div>
          <p className="text-sm text-zinc-400">You have {notifications.filter((n) => n.status == 'sent').length} unread notifications.</p>
        </div>
        <div className="custom-scroll dark:custom-scroll w-full max-h-[380px] overflow-y-auto overflow-x-hidden flex-1 flex flex-col items-start p-y-6">
          {
            notifications.length > 0 && (
              notifications.map((notification: DbNotification) => (
                <div key={notification.id} className="w-[95%] cursor-pointer">
                  <NotificationAccordionItem notification={notification} readNotification={readNotification} />
                </div>
              ))
            )
          }
        </div>
        {
          notifications.length > 0 && (
            <PopoverClose onClick={() => handleMarkAllAsRead()} className="cursor-pointer w-full! bg-zinc-400  dark:bg-zinc-50 py-2 px-4 h-10 text-sm text-zinc-900 flex items-center justify-center gap-0 rounded-md">
              {
                resolvedTheme == 'dark' ? (
                  <Image src="/images/check.svg" alt="check-icon" className="mr-2" width={16} height={16} />
                ) : (
                  <Image src="/images/check-light.svg" alt="check-icon" className="mr-2" width={16} height={16} />
                )
              }
              <p className="text-zinc-950">Mark all as read</p>
            </PopoverClose>
          )
        }
      </PopoverContent>
    </Popover>
  );
}

type NotificationAccordionItemProps = {
  notification: DbNotification;
  readNotification: (id: number) => void;
};

export function NotificationAccordionItem(
  { notification, readNotification }: NotificationAccordionItemProps
): React.JSX.Element {
  const [openValue, setOpenValue] = useState<string>('');

  useEffect(() => {
    if (openValue && notification.status !== 'read') {
      readNotification(notification.id);
      notification.status = 'read';
    }
  }, [openValue])

  return (
    <Accordion type="single" className="w-full"
      value={openValue}
      onValueChange={setOpenValue}
      onClick={() => setOpenValue(openValue ? '' : `notif-${notification.id}`)}
    >

      <AccordionItem value={`notif-${notification.id}`} className="border-0 p-0 min-h-[87px]">
        <AccordionTrigger className="rounded-xl px-4 py-3 hover:no-underline hover:bg-transparent p-0">
          <div className="flex w-full items-start gap-3">
            <span className={`mt-2 inline-flex h-2.5 w-2.5 rounded-full ${notification.status === 'sent' ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-800'}`} />
            <div className="flex-1 text-lef gap-4">
              <div className="font-medium text-sm">{notification.title}</div>
              {notification.short_description ? (
                <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {notification.short_description.slice(0, 30)}
                </div>
              ) : null}
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4 pt-2">
          {notification.content}
        </AccordionContent>
      </AccordionItem>

    </Accordion>
  );
}
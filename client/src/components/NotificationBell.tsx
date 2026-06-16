import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, MessageSquare, Star, UserPlus, BookOpen, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useLocation } from "wouter";

const TYPE_ICONS: Record<string, typeof Bell> = {
  new_message: MessageSquare,
  new_content_request: Star,
  new_subscriber: UserPlus,
  lesson_booked: Calendar,
  lesson_confirmed: CheckCircle2,
  lesson_completed: CheckCircle2,
  lesson_cancelled: XCircle,
  content_delivered: BookOpen,
  new_review: Star,
};

/** Return the URL (path + optional #hash) to navigate to when a notification is clicked. */
function getNotificationUrl(type: string, userType: string | undefined): string {
  const isCoach = userType === "coach" || userType === "both";
  switch (type) {
    case "new_content_request":
      return isCoach ? "/coach/dashboard#content-requests" : "/dashboard#content-requests";
    case "new_message":
      return isCoach ? "/coach/dashboard#inbox" : "/dashboard#messages";
    case "new_subscriber":
      return "/coach/dashboard#students";
    case "lesson_booked":
    case "lesson_confirmed":
    case "lesson_cancelled":
    case "lesson_completed":
      return isCoach ? "/coach/dashboard#schedule" : "/dashboard#lessons";
    case "new_review":
      return isCoach ? "/coach/dashboard#reviews" : "/dashboard";
    case "content_delivered":
      return "/dashboard#content-library";
    default:
      return isCoach ? "/coach/dashboard" : "/dashboard";
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: notifications } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: !!user && open },
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  if (!user) return null;

  const count = unreadCount ?? 0;
  const userType = (user as any)?.userType as string | undefined;

  const handleNotificationClick = (n: any) => {
    if (!n.readAt) markRead.mutate({ notificationId: n.id });
    setOpen(false);
    const url = getNotificationUrl(n.type, userType);
    const [path, hash] = url.split("#");
    navigate(path);
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-96 overflow-y-auto bg-ink-deep border-border/40 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-bone-muted">
            Notifications
          </span>
          {count > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-[11px] text-ember hover:text-ember/80 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {!notifications || notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-bone-muted/30" />
            <p className="text-sm text-bone-muted">No notifications yet</p>
          </div>
        ) : (
          <div>
            {(notifications as any[]).map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const isUnread = !n.readAt;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-ink-raised/50 transition-colors cursor-pointer ${
                    isUnread ? "border-l-2 border-l-ember bg-ink-raised/30" : ""
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isUnread ? "text-ember" : "text-bone-muted"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${isUnread ? "text-bone" : "text-bone-muted"}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-bone-muted truncate">{n.body}</div>
                    <div className="text-[11px] text-bone-muted/60 mt-0.5">
                      {n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

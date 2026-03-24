import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bell, CalendarDays, Camera, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { getNotificationFeedCategory, isNotificationCenterItem, type NotificationFeedCategory } from "@/lib/notifications";
import type { CalendarMode, NotificationItem, UserAccount, UserId } from "@/types";

const BOTTLE_TONE_STYLE: Record<string, { shell: string; fill: string }> = {
  rose: {
    shell: "from-[#101320] via-[#20263b] to-[#0e1325]",
    fill: "from-[#ffd5f3] to-[#ef68d0]"
  },
  mint: {
    shell: "from-[#0e1324] via-[#1f273d] to-[#12192b]",
    fill: "from-[#c5fff5] to-[#34d8a2]"
  },
  sky: {
    shell: "from-[#101828] via-[#1f2840] to-[#0f1727]",
    fill: "from-[#d6f1ff] to-[#5abaff]"
  },
  sunset: {
    shell: "from-[#18101c] via-[#291d31] to-[#140d18]",
    fill: "from-[#ffe0b0] to-[#ff8d67]"
  },
  lavender: {
    shell: "from-[#151126] via-[#231c3c] to-[#100d1f]",
    fill: "from-[#efe0ff] to-[#a56eff]"
  }
};

type FilterKey = "all" | "story" | "entry" | "mood";

const MiniBottle = ({
  label,
  emoji,
  tone,
  level,
  isPink
}: {
  label: string;
  emoji: string;
  tone: string;
  level: number;
  isPink: boolean;
}) => {
  const palette = BOTTLE_TONE_STYLE[tone] ?? BOTTLE_TONE_STYLE.rose;

  return (
    <div
      className={cn(
        "relative flex h-[96px] w-[84px] flex-col items-center justify-end overflow-hidden rounded-[20px] border px-2.5 pb-2.5 pt-2",
        isPink ? "border-white/[0.82] bg-white/[0.82]" : "border-white/[0.12] bg-[#091120]/[0.98]"
      )}
    >
      <div className="absolute top-0 h-4 w-9 rounded-b-[12px] bg-white/82 shadow-[0_8px_22px_rgba(255,255,255,0.26)]" />
      <div className={cn("absolute inset-x-2 bottom-2 rounded-[16px] bg-gradient-to-b", palette.shell)} />
      <div
        className={cn("absolute inset-x-3 bottom-3 rounded-[14px] bg-gradient-to-b", palette.fill)}
        style={{ height: `${Math.max(16, Math.min(92, level))}%` }}
      />
      <div className="relative z-[1] text-lg leading-none">{emoji}</div>
      <div className="relative z-[1] mt-auto w-full rounded-full bg-black/18 px-2 py-1 text-center text-[9px] font-semibold text-white">
        {label || "Без слов"}
      </div>
      <div className={cn("relative z-[1] mt-1 text-[10px] font-semibold", isPink ? "text-pink-700" : "text-slate-200")}>{level}%</div>
    </div>
  );
};

export const NotificationCenter = ({
  isOpen,
  isPink,
  currentUserId,
  notifications,
  users,
  onClose,
  onMarkRead,
  onOpenDate
}: {
  isOpen: boolean;
  isPink: boolean;
  currentUserId?: UserId | null;
  notifications: NotificationItem[];
  users: Record<UserId, UserAccount>;
  onClose: () => void;
  onMarkRead: (notificationId: string) => void;
  onOpenDate: (date: string, mode: CalendarMode) => void;
}) => {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const centerNotifications = useMemo(
    () => notifications.filter((item) => isNotificationCenterItem(item, currentUserId)),
    [currentUserId, notifications]
  );

  const filteredNotifications = useMemo(() => {
    return centerNotifications.filter((item) => {
      const category = getNotificationFeedCategory(item);
      if (filter !== "all" && category !== filter) {
        return false;
      }

      if (showUnreadOnly && item.read) {
        return false;
      }

      return true;
    });
  }, [centerNotifications, filter, showUnreadOnly]);

  const counters = useMemo(
    () => ({
      all: centerNotifications.length,
      story: centerNotifications.filter((item) => getNotificationFeedCategory(item) === "story").length,
      entry: centerNotifications.filter((item) => getNotificationFeedCategory(item) === "entry").length,
      mood: centerNotifications.filter((item) => getNotificationFeedCategory(item) === "mood").length,
      unread: centerNotifications.filter((item) => !item.read).length
    }),
    [centerNotifications]
  );

  const filterChips: Array<{ key: FilterKey; label: string; icon: typeof Bell }> = [
    { key: "all", label: "Все", icon: Bell },
    { key: "story", label: "Истории", icon: Camera },
    { key: "entry", label: "Записи", icon: CalendarDays },
    { key: "mood", label: "Настроение", icon: Heart }
  ];

  const openNotification = (item: NotificationItem) => {
    onMarkRead(item.id);
    if (item.date && item.mode) {
      onOpenDate(item.date, item.mode);
      onClose();
    }
  };

  const categoryBadgeClass = (category: NotificationFeedCategory) => {
    if (category === "story") {
      return isPink ? "bg-[#fff0f6] text-pink-700" : "bg-[#152033] text-sky-100";
    }
    if (category === "entry") {
      return isPink ? "bg-[#fff7ee] text-[#8b5b23]" : "bg-[#1a2233] text-[#ffe7a8]";
    }
    if (category === "mood") {
      return isPink ? "bg-[#f7efff] text-[#7f49d6]" : "bg-[#1a1730] text-[#cab1ff]";
    }
    return isPink ? "bg-white text-pink-700" : "bg-white/[0.08] text-slate-200";
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-slate-950/82 backdrop-blur-[12px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "absolute inset-0 flex flex-col overflow-hidden border-t px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[430px] sm:rounded-[34px] sm:border sm:px-4 sm:pb-4 sm:pt-4",
              isPink
                ? "border-white/[0.86] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,250,0.99))] text-[#3c2537]"
                : "border-white/[0.12] bg-[#07111f]/[0.98] text-white"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[18px] border px-3 py-2 text-sm font-semibold",
                  isPink ? "border-white/[0.86] bg-white/[0.88] text-pink-700" : "border-white/[0.12] bg-white/[0.06] text-slate-100"
                )}
              >
                <ArrowLeft className="size-4" />
                Назад
              </button>

              <div className="min-w-0 text-center">
                <div className={cn("text-[10px] uppercase tracking-[0.28em]", isPink ? "text-pink-500/[0.80]" : "text-sky-200/[0.68]")}>центр уведомлений</div>
                <div className="mt-1 text-lg font-semibold">Уведомления</div>
              </div>

            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2">
              {filterChips.map(({ key, label, icon: Icon }) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
                      active
                        ? isPink
                          ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                          : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
                        : isPink
                          ? "bg-white text-pink-700"
                          : "bg-white/[0.06] text-slate-100"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] leading-none">{counters[key]}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowUnreadOnly((value) => !value)}
                className={cn(
                  "rounded-full px-3 py-2 text-[11px] font-semibold",
                  showUnreadOnly
                    ? isPink
                      ? "bg-[#ffe0f1] text-pink-700"
                      : "bg-[#18253b] text-sky-100"
                    : isPink
                      ? "bg-white text-pink-700"
                      : "bg-white/[0.06] text-slate-200"
                )}
              >
                Новые · {counters.unread}
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto pb-2 pr-1 [scrollbar-width:none]">
              <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                  <div className={cn("rounded-[22px] border px-4 py-5 text-center", isPink ? "border-white/[0.82] bg-white/[0.62]" : "border-white/[0.10] bg-white/[0.04]") }>
                    <Sparkles className={cn("mx-auto size-6", isPink ? "text-pink-500" : "text-sky-300")}/>
                    <div className="mt-3 text-sm font-semibold">Пока пусто</div>
                  </div>
                ) : null}

                {filteredNotifications.map((item) => {
                  const category = getNotificationFeedCategory(item);
                  const authorName = users[item.authorId]?.nickname ?? "Пара";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className={cn(
                        "w-full rounded-[22px] border p-3.5 text-left transition active:scale-[0.99]",
                        isPink ? "border-white/[0.86] bg-white/[0.90]" : "border-white/[0.10] bg-[#091220]/[0.98]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                            <span className={cn("rounded-full px-3 py-1", categoryBadgeClass(category))}>
                              {category === "story" ? "История" : category === "entry" ? "Запись" : "Настроение"}
                            </span>
                            <span className={cn("rounded-full px-3 py-1", isPink ? "bg-white text-pink-700" : "bg-white/[0.08] text-slate-200")}>{authorName}</span>
                            <span
                              className={cn(
                                "rounded-full px-3 py-1",
                                item.read
                                  ? isPink
                                    ? "bg-[#f6edf4] text-pink-700"
                                    : "bg-white/[0.08] text-slate-300"
                                  : "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                              )}
                            >
                              {item.read ? "Просмотрено" : "Новое"}
                            </span>
                          </div>
                          <div className="mt-2 text-[14px] font-semibold leading-5">{item.message}</div>
                        </div>
                        {!item.read ? <div className="mt-1 size-2.5 shrink-0 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500" /> : null}
                      </div>

                      {category === "mood" && item.moodBefore && item.moodAfter ? (
                        <div className={cn("mt-3 rounded-[20px] border px-3 py-3", isPink ? "border-white/[0.80] bg-[#fff7fb]" : "border-white/[0.08] bg-[#0c1627]") }>
                          <div className="mb-2 text-sm font-semibold">Настроение</div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-2">
                              <div className={cn("text-center text-[11px] font-semibold uppercase tracking-[0.2em]", isPink ? "text-pink-700/65" : "text-slate-300/65")}>Было</div>
                              <MiniBottle {...item.moodBefore} isPink={isPink} />
                            </div>
                            <div className={cn("rounded-full px-3 py-2 text-xs font-semibold", isPink ? "bg-white text-pink-700" : "bg-white/[0.06] text-slate-200")}>→</div>
                            <div className="space-y-2">
                              <div className={cn("text-center text-[11px] font-semibold uppercase tracking-[0.2em]", isPink ? "text-pink-700/65" : "text-slate-300/65")}>Стало</div>
                              <MiniBottle {...item.moodAfter} isPink={isPink} />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className={cn("text-[11px] uppercase tracking-[0.24em]", isPink ? "text-pink-700/60" : "text-slate-300/60")}>{item.createdAt.slice(0, 16).replace("T", " ")}</div>
                        {item.date && item.mode ? (
                          <div className={cn("rounded-full px-3 py-2 text-xs font-semibold", isPink ? "bg-[#eef5ff] text-[#4463de]" : "bg-[#16243b] text-sky-100")}>Открыть день</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

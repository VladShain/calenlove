import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ElementType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Play,
  Plus,
  Settings,
  BarChart3,
  X
} from "lucide-react";
import { NOTIFIED_KEY } from "@/data/defaultState";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { formatDateLabel, todayKey } from "@/lib/date";
import { isNotificationCenterItem } from "@/lib/notifications";
import { compressImageFile } from "@/lib/image";
import { CalendarPage } from "@/components/CalendarPage";
import { DayModal } from "@/components/DayModal";
import { GalleryPage } from "@/components/GalleryPage";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SettingsPage } from "@/components/SettingsPage";
import { SoonPage } from "@/components/SoonPage";
import { useAppStore } from "@/store/useAppStore";
import type { CalendarEntry, CalendarMode, PageKey } from "@/types";

const NAV_ITEMS: Array<{ key: PageKey; label: string; icon: ElementType }> = [
  { key: "calendar", label: "Основа", icon: CalendarDays },
  { key: "gallery", label: "Галерея", icon: Camera },
  { key: "soon", label: "Статистика", icon: BarChart3 },
  { key: "settings", label: "Настройки", icon: Settings }
];

const StoryViewer = ({
  entries,
  index,
  isPink,
  onClose,
  onChange,
  onOpenDay
}: {
  entries: CalendarEntry[];
  index: number | null;
  isPink: boolean;
  onClose: () => void;
  onChange: (nextIndex: number) => void;
  onOpenDay: (entry: CalendarEntry) => void;
}) => {
  const activeEntry = index == null ? null : entries[index] ?? null;

  return (
    <AnimatePresence>
      {activeEntry ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/72 p-3 backdrop-blur-[8px] sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.985 }}
            className="relative w-full max-w-[470px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={cn("mb-3 flex items-center justify-center gap-1 px-2", entries.length > 1 ? "opacity-100" : "opacity-0")}>
              {entries.map((entry, progressIndex) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onChange(progressIndex)}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all",
                    progressIndex === index ? "bg-white" : "bg-white/28"
                  )}
                />
              ))}
            </div>

            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (entries.length <= 1 || index == null) return;
                if (info.offset.x <= -80) {
                  onChange((index + 1) % entries.length);
                } else if (info.offset.x >= 80) {
                  onChange((index - 1 + entries.length) % entries.length);
                }
              }}
              className={cn(
                "relative overflow-hidden rounded-[40px] border p-3 shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl",
                isPink ? "border-white/[0.84] bg-white/[0.18]" : "border-white/[0.12] bg-slate-950/[0.42]"
              )}
            >
              <div className="absolute inset-0 scale-110 blur-2xl">
                {activeEntry.imageUrl ? <img src={activeEntry.imageUrl} alt={activeEntry.title} className="h-full w-full object-cover opacity-40" /> : null}
              </div>

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#08080b]">
                <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-transparent to-black/34" />
                <div className="flex min-h-[72vh] items-center justify-center bg-[#08080b] sm:min-h-[78vh]">
                  {activeEntry.imageUrl ? (
                    <img src={activeEntry.imageUrl} alt={activeEntry.title} className="max-h-[78vh] w-full object-contain" />
                  ) : null}
                </div>

                <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3 text-white">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-white/78">История дня</div>
                    <div className="mt-2 text-xl font-semibold leading-tight">{activeEntry.title}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className={cn("rounded-full px-3 py-1 font-semibold", activeEntry.mode === "love" ? "bg-pink-500 text-white" : "bg-[#ffe7a8] text-[#5d4b22]")}>{activeEntry.mode === "love" ? "Влюблённые" : "Работа"}</span>
                      <span className="rounded-full bg-black/28 px-3 py-1 font-semibold text-white/90">{formatDateLabel(activeEntry.date, "d MMMM yyyy")}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-white/20 bg-black/20 p-2 text-white backdrop-blur-md"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {entries.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onChange(((index ?? 0) - 1 + entries.length) % entries.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/22 p-3 text-white backdrop-blur-md"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(((index ?? 0) + 1) % entries.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/22 p-3 text-white backdrop-blur-md"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                ) : null}

                <div className="absolute inset-x-4 bottom-4 space-y-3">
                  <div className="rounded-[24px] border border-white/14 bg-black/24 px-4 py-3 text-sm leading-6 text-white/90 backdrop-blur-md">
                    {activeEntry.text || activeEntry.previewText || "Открой этот день и посмотри детали."}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      type="button"
                      onClick={() => onOpenDay(activeEntry)}
                      className={cn(
                        "w-full rounded-[22px] px-4 py-3 text-sm font-semibold",
                        isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
                      )}
                    >
                      Перейти к дню
                    </button>
                    <div className="rounded-[22px] border border-white/14 bg-black/22 px-4 py-3 text-center text-sm font-medium text-white/90 backdrop-blur-md">
                      {(index ?? 0) + 1} / {entries.length}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export const AppShell = () => {
  const {
    session,
    snapshot,
    setPage,
    logout,
    markNotificationRead,
    addEntry,
    uploadAttachment,
    openDate,
    setMode
  } = useAppStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const theme = snapshot.settings.theme;
  const isPink = theme === "whitePink";
  const liteModeEnabled = snapshot.settings.optimizationLiteMode;
  const glassEffectsEnabled = !liteModeEnabled && snapshot.settings.optimizationGlass;
  const animatedEffectsEnabled = !liteModeEnabled && snapshot.settings.optimizationAnimations;
  const decorativeEffectsEnabled = !liteModeEnabled && snapshot.settings.optimizationDecor;
  const currentUser = session.currentUserId ? snapshot.users[session.currentUserId] : null;
  const notificationFeed = useMemo(() => snapshot.notifications.filter((item) => isNotificationCenterItem(item, session.currentUserId)), [session.currentUserId, snapshot.notifications]);
  const unreadNotifications = notificationFeed.filter((item) => !item.read).slice(0, 10);
  const notifiedRef = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFIED_KEY);
      if (raw) {
        notifiedRef.current = new Set(JSON.parse(raw) as string[]);
      }
    } catch {
      notifiedRef.current = new Set<string>();
    }
  }, []);

  useEffect(() => {
    if (!session.currentUserId || !snapshot.settings.notificationsEnabled || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    const relevant = notificationFeed
      .filter((item) => !item.read)
      .filter((item) => (item.targetUserId ? item.targetUserId === session.currentUserId : item.authorId !== session.currentUserId))
      .slice(0, 8)
      .reverse();

    const nextIds = new Set(notifiedRef.current);

    relevant.forEach((item) => {
      if (nextIds.has(item.id)) {
        return;
      }

      new Notification("Календарь двоих", {
        body: item.message,
        tag: item.id
      });
      nextIds.add(item.id);
    });

    notifiedRef.current = nextIds;
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(nextIds).slice(-120)));
  }, [notificationFeed, session.currentUserId, snapshot.settings.notificationsEnabled]);

  const visibleStories = useMemo(() => {
    if (!session.currentUserId) {
      return [];
    }

    return [...snapshot.entries]
      .filter((entry) => Boolean(entry.imageUrl))
      .filter((entry) => entry.visibility === "shared" || entry.authorId === session.currentUserId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [session.currentUserId, snapshot.entries]);

  useEffect(() => {
    if (storyViewerIndex == null) {
      return;
    }

    if (visibleStories.length === 0) {
      setStoryViewerIndex(null);
      return;
    }

    if (storyViewerIndex > visibleStories.length - 1) {
      setStoryViewerIndex(0);
    }
  }, [storyViewerIndex, visibleStories.length]);

  const page = useMemo(() => {
    switch (session.page) {
      case "gallery":
        return <GalleryPage />;
      case "soon":
        return <SoonPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <CalendarPage />;
    }
  }, [session.page]);

  const backgroundStyle = liteModeEnabled
    ? undefined
    : buildPhotoGlassStyle(snapshot.settings.backgroundImage, theme, isPink ? 0.74 : 0.66);
  const shellBackgroundStyle = glassEffectsEnabled
    ? buildPhotoGlassStyle(
        snapshot.settings.backgroundImage,
        theme,
        isPink ? 0.84 : 0.82,
        isPink
          ? "linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,239,246,0.64))"
          : "linear-gradient(180deg, rgba(6,13,25,0.42), rgba(7,15,28,0.62))"
      )
    : undefined;

  const handleStoryFile = async (file?: File | null) => {
    if (!file || !session.currentUserId) {
      return;
    }

    const compressed = await compressImageFile(file, 1800, 0.82);
    const uploaded = await uploadAttachment(compressed.originalName, compressed.dataUrl);
    await addEntry({
      date: todayKey(),
      mode: session.mode,
      title: `История ${currentUser?.nickname ?? "пары"}`,
      text: session.mode === "love" ? "Быстрая история дня" : "Быстрая рабочая история",
      previewText: "История",
      visibility: "shared",
      imageUrl: uploaded,
      imageName: compressed.originalName
    });
    setPage("gallery");
    setStoryMenuOpen(false);
  };

  const openRandomStory = () => {
    if (visibleStories.length === 0) {
      return;
    }

    const randomIndex = Math.floor(Math.random() * visibleStories.length);
    setStoryViewerIndex(randomIndex);
  };

  const openStoryDay = (entry: CalendarEntry) => {
    setStoryViewerIndex(null);
    setPage("calendar");
    setMode(entry.mode);
    openDate(entry.date);
  };

  const openNotificationDate = (date: string, mode: CalendarMode) => {
    setNotificationsOpen(false);
    setPage("calendar");
    setMode(mode);
    openDate(date);
  };


  const headerDescription =
    session.page === "calendar"
      ? session.mode === "love"
        ? "Календарь для двоих с мягким фоном и живыми деталями"
        : "Рабочий календарь со сменами и спокойным визуалом"
      : session.page === "soon"
        ? "Статистика по заработку, часам и сменам"
        : session.page === "gallery"
          ? "Фотографии из ячеек с быстрым переходом к дню"
          : "Профиль, темы, приватность, аналитика и память";

  const mobileHeaderDescription =
    session.page === "calendar"
      ? session.mode === "love"
        ? "Главный экран пары"
        : "Рабочий режим"
      : session.page === "soon"
        ? "Статистика по сменам"
        : session.page === "gallery"
          ? "Фото и истории"
          : "Параметры приложения";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative min-h-[100dvh] overflow-hidden px-0 pb-[calc(7.9rem+env(safe-area-inset-bottom))] pt-0 sm:px-4 sm:py-4 lg:px-8 lg:py-6",
        theme === "whitePink" ? "app-bg-whitePink" : theme === "darkRed" ? "app-bg-darkRed" : theme === "blackout" ? "app-bg-blackout" : "app-bg-luxuryBlue",
        !glassEffectsEnabled && "no-glass-effects",
        !animatedEffectsEnabled && "reduce-motion-ui",
        !decorativeEffectsEnabled && "reduce-decor-ui"
      )}
      style={backgroundStyle}
    >
      <div
        className={cn(
          "mx-auto flex min-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 sm:min-h-[calc(100vh-1.5rem-env(safe-area-inset-bottom))] sm:max-w-[860px] sm:rounded-[40px] sm:border",
          glassEffectsEnabled ? "backdrop-blur-2xl" : "bg-transparent",
          isPink ? "sm:border-white/[0.80] bg-white/[0.28]" : "sm:border-white/[0.12] bg-white/[0.06]"
        )}
        style={shellBackgroundStyle}
      >
        <header
          className={cn(
            "sticky top-0 z-20 border-b px-3 pb-1.5 pt-[max(0.55rem,env(safe-area-inset-top))] sm:px-5 sm:pb-3 sm:pt-4 lg:px-6",
            isPink
              ? "border-white/[0.70] bg-white/[0.32] text-[#402b39]"
              : "border-white/[0.10] bg-slate-950/[0.24] text-white"
          )}
        >
          <div className="relative min-h-[74px] sm:min-h-[88px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
              <div data-decorative="true" className={cn("h-14 w-[220px] rounded-b-[28px] blur-3xl sm:h-20 sm:w-[280px] sm:rounded-b-[36px]", isPink ? "bg-pink-100/95" : "bg-sky-400/10")} />
            </div>

            <div className="absolute right-0 top-0 z-[2] flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={openRandomStory}
                disabled={visibleStories.length === 0}
                className={cn(
                  "relative rounded-[16px] border px-2 py-2 transition active:scale-95 backdrop-blur-xl disabled:cursor-default disabled:opacity-45 sm:rounded-[20px] sm:px-3 sm:py-3",
                  isPink ? "border-white/[0.80] bg-white/[0.64] text-pink-700 shadow-rose" : "border-white/[0.10] bg-white/[0.08] text-sky-100"
                )}
                title="Случайная история"
              >
                <Play className="size-4" />
              </button>

              <button
                onClick={() => setNotificationsOpen((value) => !value)}
                className={cn(
                  "relative rounded-[16px] border px-2 py-2 transition active:scale-95 backdrop-blur-xl sm:rounded-[20px] sm:px-3 sm:py-3",
                  isPink ? "border-white/[0.80] bg-white/[0.64] text-pink-700 shadow-rose" : "border-white/[0.10] bg-white/[0.08] text-sky-100"
                )}
                title="Уведомления"
              >
                <Bell className="size-4" />
                {unreadNotifications.length > 0 ? <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-1.5 py-[1px] text-[10px] font-semibold leading-none text-white">{Math.min(unreadNotifications.length, 9)}</span> : null}
              </button>

              <button
                onClick={logout}
                className={cn(
                  "rounded-[16px] border px-2 py-2 transition active:scale-95 backdrop-blur-xl sm:rounded-[20px] sm:px-3 sm:py-3",
                  isPink ? "border-white/[0.80] bg-white/[0.64] text-pink-700 shadow-rose" : "border-white/[0.10] bg-white/[0.08] text-sky-100"
                )}
                title="Выход"
              >
                <LogOut className="size-4" />
              </button>
            </div>

            <div className="relative z-[1] mx-auto flex max-w-[360px] flex-col items-center px-11 pt-2 text-center sm:max-w-[540px] sm:px-0 sm:pt-0">
              <div className={cn("text-[9px] uppercase tracking-[0.28em] sm:text-[11px] sm:tracking-[0.35em]", isPink ? "text-pink-500/[0.80]" : "text-sky-200/[0.60]")}>Календарь двоих</div>
              <div className="mt-1 flex items-center justify-center gap-1 sm:gap-2">
                <span className="truncate text-[18px] font-semibold leading-none sm:text-[31px]">{currentUser?.nickname ?? "Пользователь"}</span>
                <Heart className={cn("size-4", isPink ? "text-pink-500" : "text-sky-300")} fill="currentColor" />
                <button
                  type="button"
                  onClick={() => setStoryMenuOpen((value) => !value)}
                  className={cn(
                    "rounded-full border p-1.5 transition active:scale-95 sm:p-1.5",
                    isPink ? "border-white/[0.84] bg-white/[0.76] text-pink-700 shadow-rose" : "border-white/[0.12] bg-white/[0.08] text-sky-100"
                  )}
                  title="Добавить историю"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className={cn("mt-1 text-[10px] sm:hidden", isPink ? "text-[#8c6578]" : "text-slate-300/[0.66]")}>{mobileHeaderDescription}</div>
              <div className={cn("mt-2 hidden max-w-[480px] text-sm sm:block", isPink ? "text-[#8c6578]" : "text-slate-300/[0.78]")}>{headerDescription}</div>
            </div>
          </div>

        </header>

        <main className="touch-pan-y relative flex-1 overflow-y-auto overscroll-contain pb-[calc(8.6rem+env(safe-area-inset-bottom))] [scrollbar-width:none] sm:pb-[6.8rem]">
          <div className="px-2.5 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4 lg:px-6">{page}</div>
        </main>

      </div>

      <nav
        className={cn(
          "app-shell-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1.5 border-t px-2.5 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-14px_36px_rgba(8,14,28,0.28)] transition duration-300 sm:bottom-[max(0.5rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[860px] sm:-translate-x-1/2 sm:rounded-[26px] sm:border sm:gap-2 sm:px-4 sm:shadow-[0_24px_60px_rgba(8,14,28,0.34)]",
          glassEffectsEnabled ? "backdrop-blur-2xl" : "backdrop-blur-0",
          isPink ? "border-white/[0.78] bg-[rgba(255,246,251,0.96)] sm:bg-white/[0.48]" : "border-white/[0.10] bg-[#08111f]/95 sm:bg-slate-950/[0.68]"
        )}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = session.page === key;
          return (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-1.5 text-[10px] font-medium leading-none transition active:scale-95 backdrop-blur-xl sm:min-h-[68px] sm:rounded-[20px] sm:px-2 sm:py-3 sm:text-[11px]",
                active
                  ? isPink
                    ? "bg-gradient-to-b from-pink-500 to-fuchsia-500 text-white shadow-[0_18px_40px_rgba(226,66,170,0.26)]"
                    : "bg-gradient-to-b from-sky-400 to-indigo-500 text-white shadow-lg"
                  : isPink
                    ? "bg-white text-pink-700 shadow-none"
                    : "bg-[#111b2d] text-slate-100 shadow-none"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="truncate text-center">{label}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {storyMenuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/74 p-3 pt-[max(6rem,env(safe-area-inset-top)+4rem)] backdrop-blur-[8px] sm:p-6"
            onClick={() => setStoryMenuOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className={cn(
                "w-[min(92vw,360px)] rounded-[28px] border p-4 shadow-glow",
                isPink ? "border-white/[0.90] bg-white/[0.97] text-[#3c2537]" : "border-white/[0.14] bg-slate-950/[0.96] text-white"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 text-center">
                <div className="text-lg font-semibold">Быстрая история</div>
                <div className={cn("mt-1 text-sm leading-6", isPink ? "text-pink-700/[0.72]" : "text-slate-300/[0.72]")}>Добавь снимок из галереи или камеры. Панель стала плотнее, чтобы ничего не сливалось с фоном.</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className={cn("rounded-[22px] px-4 py-3 text-sm font-semibold", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}
                >
                  Из галереи
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className={cn("rounded-[22px] px-4 py-3 text-sm font-semibold", isPink ? "bg-white/[0.76] text-pink-700 shadow-rose" : "bg-white/[0.06] text-slate-100")}
                >
                  Сделать снимок
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStoryMenuOpen(false)}
                className={cn("mt-2 w-full rounded-[22px] px-4 py-3 text-sm", isPink ? "text-pink-700" : "text-slate-300")}
              >
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <NotificationCenter
        isOpen={notificationsOpen}
        isPink={isPink}
        currentUserId={session.currentUserId}
        notifications={notificationFeed}
        users={snapshot.users}
        onClose={() => setNotificationsOpen(false)}
        onMarkRead={(notificationId) => {
          void markNotificationRead(notificationId);
        }}
        onOpenDate={openNotificationDate}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => void handleStoryFile(event.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => void handleStoryFile(event.target.files?.[0])}
      />

      <StoryViewer
        entries={visibleStories}
        index={storyViewerIndex}
        isPink={isPink}
        onClose={() => setStoryViewerIndex(null)}
        onChange={setStoryViewerIndex}
        onOpenDay={openStoryDay}
      />
      <DayModal />
    </motion.div>
  );
};

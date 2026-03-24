import { useMemo } from "react";
import { motion } from "framer-motion";
import { BriefcaseBusiness, ChevronLeft, ChevronRight } from "lucide-react";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { buildCalendarDays, daysBetween, formatMonthLabel, todayKey, weekdayLabels } from "@/lib/date";
import { TamagotchiDock } from "@/components/TamagotchiDock";
import { useAppStore } from "@/store/useAppStore";


const FLOATING_ITEMS = {
  love: ["💗", "💖", "💕", "💘", "💞", "💓", "💝", "💟", "💌", "🌸", "🩷", "💗", "💖", "💕", "💞", "💘"],
  work: ["📅", "🗓️", "📌", "📝", "🕒", "📎", "✅", "📍", "🧾", "⌛", "📅", "📝", "💼", "🧠", "📋", "🗂️"]
};

const withAlpha = (hex: string | undefined, alpha: number) => {
  if (!hex) return undefined;
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized;
  if (safe.length !== 6) return undefined;
  const value = Number.parseInt(safe, 16);
  if (Number.isNaN(value)) return undefined;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const FloatingMood = ({ mode, isPink, blurStrength }: { mode: "love" | "work"; isPink: boolean; blurStrength: number }) => {
  const items = FLOATING_ITEMS[mode];

  return (
    <div data-decorative="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((emoji, index) => (
        <motion.span
          key={`${mode}-${emoji}-${index}`}
          initial={{ opacity: isPink ? 0.56 : 0.16, y: 18 }}
          animate={{
            opacity: isPink ? [0.42, 0.86, 0.42] : [0.10, 0.24, 0.10],
            x: [0, index % 2 === 0 ? 26 : -24, 0],
            y: [0, -42, 0],
            rotate: [0, index % 2 === 0 ? 11 : -11, 0]
          }}
          transition={{
            duration: 10 + index * 0.75,
            delay: index * 0.38,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut"
          }}
          className="absolute select-none"
          style={{
            left: `${4 + (index * 8.5) % 88}%`,
            top: `${6 + ((index * 9) % 74)}%`,
            fontSize: `${34 + ((index * 5) % 28)}px`,
            filter: isPink
              ? `blur(${Math.max(0, blurStrength * 0.08).toFixed(1)}px) drop-shadow(0 18px 28px rgba(255,103,177,0.52))`
              : `blur(${Math.max(0.2, blurStrength * 0.14).toFixed(1)}px) drop-shadow(0 16px 24px rgba(91,174,255,0.18))`
          }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
};

export const CalendarPage = () => {
  const { snapshot, session, monthCursor, moveMonth, openDate, setMode } = useAppStore();
  const currentMonth = new Date(monthCursor);
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const theme = snapshot.settings.theme;
  const isPink = theme === "whitePink";
  const liteModeEnabled = snapshot.settings.optimizationLiteMode;
  const animatedEffectsEnabled = !liteModeEnabled && snapshot.settings.optimizationAnimations;
  const decorativeEffectsEnabled = !liteModeEnabled && snapshot.settings.optimizationDecor;
  const today = todayKey();
  const photoBackground = snapshot.settings.backgroundImage;
  const currentUserId = session.currentUserId ?? "vlad";

  const entries = snapshot.entries.filter((entry) => entry.mode === session.mode && (entry.visibility === "shared" || entry.authorId === currentUserId));
  const relationDays = daysBetween(snapshot.settings.relationStartDate);

  const gridCardStyle = buildPhotoGlassStyle(
    photoBackground,
    theme,
    isPink ? 0.86 : 0.84,
    isPink
      ? "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,236,245,0.80))"
      : "linear-gradient(180deg, rgba(8,16,28,0.42), rgba(8,16,28,0.78))"
  );
  const dockStyle = buildPhotoGlassStyle(
    photoBackground,
    theme,
    isPink ? 0.88 : 0.84,
    isPink
      ? "linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,236,245,0.78))"
      : "linear-gradient(180deg, rgba(8,15,29,0.44), rgba(8,15,29,0.78))"
  );

  return (
    <div className="relative overflow-hidden pb-24 sm:pb-0">
      {decorativeEffectsEnabled ? <FloatingMood mode={session.mode} isPink={isPink} blurStrength={snapshot.settings.backgroundDecorBlur} /> : null}

      <div className="mx-auto flex max-w-[820px] flex-col gap-2 pb-6 sm:gap-4 sm:pb-0">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative overflow-visible rounded-[28px] border px-2 pb-2 pt-10 shadow-glow backdrop-blur-2xl sm:rounded-[38px] sm:px-5 sm:pb-5 sm:pt-16",
            isPink
              ? "border-white/[0.84] bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(255,238,246,0.88))] text-[#3c2537] shadow-[0_20px_54px_rgba(232,161,196,0.12)]"
              : "border-white/[0.10] bg-white/[0.05] text-white"
          )}
          style={gridCardStyle}
        >
          <div className={cn("pointer-events-none absolute inset-x-16 top-2.5 h-6 rounded-b-[20px] blur-2xl sm:inset-x-24 sm:top-4 sm:h-10 sm:rounded-b-[32px]", isPink ? "bg-pink-100/18" : "bg-sky-500/10")} />

          <div className="absolute left-1/2 top-2.5 z-[3] -translate-x-1/2 sm:top-4">
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full border p-1 shadow-[0_10px_22px_rgba(227,144,185,0.10)] backdrop-blur-2xl sm:p-1.5",
                isPink ? "border-white/[0.88] bg-white" : "border-white/[0.12] bg-slate-950/[0.82]"
              )}
            >
              <button
                onClick={() => setMode("love")}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-[10px] font-semibold transition sm:px-5 sm:text-xs",
                  session.mode === "love" ? (isPink ? "text-white" : "text-slate-950") : isPink ? "text-pink-700" : "text-slate-200"
                )}
              >
                {session.mode === "love" ? (
                  <motion.span
                    layoutId="calendar-mode-chip"
                    className={cn("absolute inset-0 rounded-full", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500" : "bg-gradient-to-r from-sky-400 to-indigo-400")}
                  />
                ) : null}
                <span className="relative z-[1]">Влюблённые</span>
              </button>
              <button
                onClick={() => setMode("work")}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-[10px] font-semibold transition sm:px-5 sm:text-xs",
                  session.mode === "work" ? (isPink ? "text-white" : "text-slate-950") : isPink ? "text-pink-700" : "text-slate-200"
                )}
              >
                {session.mode === "work" ? (
                  <motion.span
                    layoutId="calendar-mode-chip"
                    className={cn("absolute inset-0 rounded-full", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500" : "bg-gradient-to-r from-sky-400 to-indigo-400")}
                  />
                ) : null}
                <span className="relative z-[1]">Работа</span>
              </button>
            </div>
          </div>

          <div className="relative z-[1] mt-2 flex items-center justify-between gap-1.5 sm:mt-3">
            <button
              onClick={() => moveMonth(-1)}
              className={cn("rounded-[14px] p-2 backdrop-blur-xl sm:rounded-[20px] sm:p-3", isPink ? "bg-white/[0.78] text-pink-700 shadow-rose" : "bg-white/[0.05] text-slate-100")}
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className={cn("text-[9px] uppercase tracking-[0.22em] opacity-70 sm:text-[11px] sm:tracking-[0.35em]", isPink ? "text-pink-600/[0.80]" : "text-sky-200/[0.68]")}>{session.mode === "love" ? "Любовный режим" : "Рабочий режим"}</div>
              <div className="mt-1 text-[24px] font-semibold leading-none sm:mt-2 sm:text-[44px]">{formatMonthLabel(currentMonth)}</div>
              <div className={cn("mt-0.5 text-[11px]", isPink ? "text-pink-700/[0.76]" : "text-slate-300/[0.72]")}>{session.mode === "love" ? `${relationDays} день вашей истории` : "Рабочие смены и заметки"}</div>
            </div>

            <button
              onClick={() => moveMonth(1)}
              className={cn("rounded-[14px] p-2 backdrop-blur-xl sm:rounded-[20px] sm:p-3", isPink ? "bg-white/[0.78] text-pink-700 shadow-rose" : "bg-white/[0.05] text-slate-100")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="relative z-[1] mt-2.5 grid grid-cols-7 gap-0.5 sm:mt-5 sm:gap-3">
            {weekdayLabels.map((label) => (
              <div key={label} className={cn("text-center text-[9px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.22em]", isPink ? "text-pink-700/[0.72]" : "text-slate-300/[0.72]")}>{label}</div>
            ))}
          </div>

          <div className="relative z-[1] mt-1.5 grid grid-cols-7 gap-0.5 sm:mt-3 sm:gap-3">
            {calendarDays.map((day) => {
              const dayEntries = entries.filter((entry) => entry.date === day.key);
              const previewItems = dayEntries.slice(0, session.mode === "work" ? 1 : 2);
              const isToday = day.key === today;
              const leadEntry = previewItems[0];
              const hasVladEntry = dayEntries.some((entry) => entry.authorId === "vlad");
              const hasLiyaEntry = dayEntries.some((entry) => entry.authorId === "liya");
              const hasEditedLove = session.mode === "love" && dayEntries.some((entry) => entry.updatedAt !== entry.createdAt);
              const cellStyle = day.isCurrentMonth
                ? buildPhotoGlassStyle(
                    photoBackground,
                    theme,
                    isPink ? 0.96 : 0.82,
                    session.mode === "love"
                      ? isPink
                        ? "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,241,248,0.98))"
                        : "linear-gradient(180deg, rgba(10,22,38,0.58), rgba(7,16,31,0.86))"
                      : isPink
                        ? "linear-gradient(180deg, rgba(255,252,254,0.94), rgba(246,241,250,0.98))"
                        : "linear-gradient(180deg, rgba(24,30,43,0.74), rgba(30,38,51,0.92))"
                  )
                : undefined;

              return (
                <motion.button
                  key={day.key}
                  whileHover={animatedEffectsEnabled ? { y: -2, scale: 1.01 } : undefined}
                  whileTap={animatedEffectsEnabled ? { scale: 0.985 } : undefined}
                  onClick={() => openDate(day.key)}
                  className={cn(
                    "group relative aspect-square overflow-hidden border p-1.5 text-left transition sm:p-3",
                    session.mode === "love" ? "rounded-[12px] sm:rounded-[18px]" : "rounded-[10px] sm:rounded-[18px]",
                    day.isCurrentMonth
                      ? isPink
                        ? "border-pink-200/[0.98] bg-[#fffafc] shadow-[0_18px_36px_rgba(230,133,188,0.10)] backdrop-blur-xl"
                        : session.mode === "love"
                          ? "border-[#22324d] bg-[#09111fcc] shadow-[0_14px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                          : "border-[#31394b] bg-[#232b38cc] shadow-[0_12px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                      : isPink
                        ? "border-white/[0.78] bg-white/[0.78] opacity-60"
                        : "border-white/[0.05] bg-white/[0.03] opacity-60"
                  )}
                  style={cellStyle}
                >
                  <div className={cn("pointer-events-none absolute inset-x-1 top-0 h-6 rounded-b-[10px] opacity-80 blur-xl sm:inset-x-2 sm:h-10 sm:rounded-b-[20px] sm:blur-2xl", isPink ? (session.mode === "love" ? "bg-pink-100/[0.98]" : "bg-violet-100/[0.88]") : session.mode === "love" ? "bg-sky-500/[0.10]" : "bg-slate-500/[0.15]")} />
                  {isToday ? <div className={cn("pointer-events-none absolute inset-0 rounded-[inherit] ring-2", isPink ? "ring-pink-400/[0.9]" : "ring-sky-300/[0.75]")} /> : null}

                  <div className="relative z-[1] flex items-center justify-between gap-1">
                    <span className={cn("text-[12px] font-semibold sm:text-sm", isToday && isPink ? "text-pink-700" : isToday ? "text-sky-200" : isPink ? "text-[#4f3342]" : "text-slate-100")}>{day.dayNumber}</span>
                    {dayEntries.length > 0 ? (
                      session.mode === "love" ? (
                        <span
                          className={cn(
                            "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm",
                            hasVladEntry && hasLiyaEntry
                              ? "bg-[linear-gradient(90deg,#7ec8ff_0%,#7ec8ff_50%,#ff9ad2_50%,#ff9ad2_100%)] text-white"
                              : hasVladEntry
                                ? "bg-sky-400/18 text-sky-200"
                                : "bg-pink-400/18 text-pink-200"
                          )}
                        >
                          ♥
                        </span>
                      ) : (
                        <BriefcaseBusiness className={cn("size-3", isPink ? "text-pink-500" : "text-sky-300")} />
                      )
                    ) : null}
                  </div>

                  <div className="relative z-[1] mt-1 flex h-[calc(100%-1.15rem)] flex-col justify-end gap-0.5 sm:mt-2 sm:gap-1">
                    {session.mode === "work" ? (
                      dayEntries.length > 0 ? (
                        <div className="flex flex-col justify-end gap-1">
                          <div
                            className="truncate rounded-[8px] border px-1 py-0.5 text-[7px] font-semibold leading-tight shadow-sm sm:rounded-xl sm:px-2 sm:py-1.5 sm:text-[10px]"
                            style={{
                              background: withAlpha(leadEntry?.workMeta?.color, 0.92) ?? "#ffe7a8",
                              borderColor: withAlpha(leadEntry?.workMeta?.color, 1) ?? "#f2cf71",
                              color: "#5d4b22"
                            }}
                          >
                            <span className="truncate">{leadEntry?.workMeta?.icon ? `${leadEntry.workMeta.icon} ` : ""}{leadEntry?.previewText || leadEntry?.title || "Смена"}</span>
                          </div>
                          {dayEntries.length > 1 ? (
                            <div className={cn("text-[7px] font-medium sm:text-[9px]", isPink ? "text-pink-700/70" : "text-slate-300/70")}>ещё {dayEntries.length - 1}</div>
                          ) : null}
                        </div>
                      ) : null
                    ) : (
                      dayEntries.length > 0 ? (
                        <div className="flex flex-col justify-end gap-1">
                          <div
                            className={cn(
                              "rounded-[10px] px-1.5 py-1 text-[7px] leading-tight backdrop-blur-xl sm:rounded-[14px] sm:px-2 sm:py-1.5 sm:text-[10px]",
                              isPink ? "bg-white/[0.96] text-[#4b3140]" : "bg-white/[0.08] text-slate-100"
                            )}
                            style={{
                              borderColor: withAlpha(leadEntry?.workMeta?.color, 0.9),
                              borderWidth: 1,
                              borderStyle: "solid"
                            }}
                          >
                            <div className="line-clamp-2 font-semibold">{leadEntry?.workMeta?.icon ? `${leadEntry.workMeta.icon} ` : ""}{leadEntry?.previewText || leadEntry?.title || "Наша заметка"}</div>
                            {dayEntries.length > 1 || hasEditedLove ? (
                              <div className={cn("mt-0.5 flex items-center gap-1 text-[6px] sm:text-[8px]", isPink ? "text-pink-700/70" : "text-slate-300/72")}>
                                {dayEntries.length > 1 ? <span>+{dayEntries.length - 1}</span> : null}
                                {hasEditedLove ? <span>изм.</span> : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={dockStyle}>
          <TamagotchiDock isPink={isPink} animated={animatedEffectsEnabled} />
        </motion.div>
      </div>

    </div>
  );
};
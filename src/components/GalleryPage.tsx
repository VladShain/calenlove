import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Images,
  Lock,
  UserRound,
  Users,
  X
} from "lucide-react";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/date";
import { useAppStore } from "@/store/useAppStore";
import type { CalendarEntry, CalendarMode } from "@/types";

interface GalleryGroup {
  key: string;
  date: string;
  mode: CalendarMode;
  entries: CalendarEntry[];
  authors: string[];
}

export const GalleryPage = () => {
  const { snapshot, session, openDate, setMode, setPage } = useAppStore();
  const theme = snapshot.settings.theme;
  const isPink = theme === "whitePink";
  const currentUserId = session.currentUserId;
  const cardStyle = buildPhotoGlassStyle(snapshot.settings.backgroundImage, theme, isPink ? 0.92 : 0.84);
  const [selectedGroup, setSelectedGroup] = useState<GalleryGroup | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const groups = useMemo<GalleryGroup[]>(() => {
    const visibleEntries = snapshot.entries.filter((entry) => {
      if (!entry.imageUrl || !currentUserId) return false;
      return entry.visibility === "shared" || entry.authorId === currentUserId;
    });

    const grouped = new Map<string, CalendarEntry[]>();
    visibleEntries.forEach((entry) => {
      const key = `${entry.mode}:${entry.date}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    });

    return Array.from(grouped.entries())
      .map(([key, entries]) => {
        const sortedEntries = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const authors = [...new Set(sortedEntries.map((entry) => snapshot.users[entry.authorId].nickname))];
        const cover = sortedEntries[0];

        return {
          key,
          date: cover.date,
          mode: cover.mode,
          entries: sortedEntries,
          authors
        };
      })
      .sort((left, right) => {
        if (left.date === right.date) {
          return left.mode.localeCompare(right.mode);
        }
        return right.date.localeCompare(left.date);
      });
  }, [currentUserId, snapshot.entries, snapshot.users]);

  const activeEntry = selectedGroup ? selectedGroup.entries[photoIndex] : null;

  const openDay = (group: GalleryGroup) => {
    setSelectedGroup(null);
    setPhotoIndex(0);
    setMode(group.mode);
    setPage("calendar");
    openDate(group.date);
  };

  const openGroup = (group: GalleryGroup, index = 0) => {
    setSelectedGroup(group);
    setPhotoIndex(index);
  };

  const movePhoto = (direction: -1 | 1) => {
    if (!selectedGroup || selectedGroup.entries.length === 0) {
      return;
    }

    setPhotoIndex((old) => (old + direction + selectedGroup.entries.length) % selectedGroup.entries.length);
  };

  return (
    <div className="space-y-3">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-[24px] border p-4 backdrop-blur-2xl",
          isPink ? "border-white/[0.84] bg-white/[0.72] text-[#3c2537]" : "border-white/[0.10] bg-white/[0.05] text-white"
        )}
        style={cardStyle}
      >
        <div className="flex items-center gap-2 text-base font-semibold">
          <Images className={cn("size-5", isPink ? "text-pink-500" : "text-sky-300")} />
          Галерея вложений
        </div>
      </motion.section>

      {groups.length === 0 ? (
        <div
          className={cn(
            "rounded-[30px] border p-5 text-sm backdrop-blur-2xl",
            isPink ? "border-white/[0.84] bg-white/[0.72] text-pink-900" : "border-white/[0.10] bg-white/[0.05] text-slate-200"
          )}
          style={cardStyle}
        >
          Пока нет фото.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group, index) => {
            const cover = group.entries[0];
            return (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                key={group.key}
                onClick={() => openGroup(group)}
                className={cn(
                  "overflow-hidden rounded-[28px] border text-left shadow-glass backdrop-blur-2xl",
                  isPink ? "border-white/[0.84] bg-white/[0.76]" : "border-white/[0.10] bg-white/[0.05] text-white"
                )}
                style={cardStyle}
              >
                <div className="relative">
                  <img src={cover.imageUrl} alt={cover.title} className="h-48 w-full object-cover" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", group.mode === "love" ? "bg-pink-500 text-white" : "bg-[#ffe7a8] text-[#5d4b22]")}>{group.mode === "love" ? "Влюблённые" : "Работа"}</span>
                    <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">{group.entries.length} фото</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="line-clamp-1 text-base font-semibold">{cover.title}</div>
                    <div className="mt-1 text-xs text-white/80">{formatDateLabel(group.date, "d MMMM yyyy")}</div>
                  </div>
                </div>

                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1", isPink ? "bg-[#fff4fa] text-pink-700" : "bg-white/[0.07] text-slate-200")}>
                      <UserRound className="size-3" />
                      {group.authors.join(" · ")}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1", cover.visibility === "shared" ? isPink ? "bg-white text-pink-700" : "bg-sky-400/[0.15] text-sky-100" : isPink ? "bg-white text-fuchsia-700" : "bg-white/[0.10] text-slate-200")}>
                      {cover.visibility === "shared" ? <Users className="size-3" /> : <Lock className="size-3" />}
                      {cover.visibility === "shared" ? "Общие записи" : "Личные записи"}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-xs opacity-70">{cover.text || "Без текста"}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedGroup && activeEntry ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/68 p-3 backdrop-blur-sm sm:p-6"
            onClick={() => {
              setSelectedGroup(null);
              setPhotoIndex(0);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              className={cn(
                "w-full max-w-[980px] overflow-hidden rounded-[34px] border p-4 shadow-glow backdrop-blur-2xl",
                isPink ? "border-white/[0.84] bg-white/[0.82] text-[#3c2537]" : "border-white/[0.10] bg-slate-950/[0.62] text-white"
              )}
              style={cardStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className={cn("text-[11px] uppercase tracking-[0.3em]", isPink ? "text-pink-500/[0.72]" : "text-sky-200/[0.64]")}>Просмотр фото</div>
                  <div className="mt-1 text-xl font-semibold">{activeEntry.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className={cn("rounded-full px-3 py-1", activeEntry.mode === "love" ? "bg-pink-500 text-white" : "bg-[#ffe7a8] text-[#5d4b22]")}>{activeEntry.mode === "love" ? "Влюблённые" : "Работа"}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1", isPink ? "bg-[#fff4fa] text-pink-700" : "bg-white/[0.07] text-slate-200")}>
                      <UserRound className="size-3" />
                      {snapshot.users[activeEntry.authorId].nickname}
                    </span>
                    <span className={cn("rounded-full px-3 py-1", isPink ? "bg-white text-pink-700" : "bg-white/[0.07] text-slate-200")}>{formatDateLabel(activeEntry.date)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedGroup(null);
                    setPhotoIndex(0);
                  }}
                  className={cn("rounded-2xl p-3", isPink ? "bg-white text-pink-700" : "bg-white/[0.06] text-slate-100")}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-black/[0.05] bg-[#09090c]">
                <img src={activeEntry.imageUrl} alt={activeEntry.title} className="max-h-[68vh] w-full object-contain bg-[#09090c]" />
                {selectedGroup.entries.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => movePhoto(-1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/38 p-3 text-white backdrop-blur-md"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/38 p-3 text-white backdrop-blur-md"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {selectedGroup.entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={cn(
                      "h-2.5 rounded-full transition-all",
                      index === photoIndex
                        ? activeEntry.mode === "love"
                          ? "w-10 bg-gradient-to-r from-pink-500 to-fuchsia-500"
                          : "w-10 bg-[#f0c766]"
                        : isPink
                          ? "w-2.5 bg-pink-200"
                          : "w-2.5 bg-white/20"
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <button
                  type="button"
                  onClick={() => openDay(selectedGroup)}
                  className={cn("rounded-[22px] px-4 py-3 text-sm font-medium", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}
                >
                  <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" /> Перейти к ячейке дня</span>
                </button>

                <a
                  href={activeEntry.imageUrl}
                  download={activeEntry.imageName || `${activeEntry.title}.jpg`}
                  className={cn("rounded-[22px] px-4 py-3 text-sm font-medium text-center", isPink ? "bg-white text-pink-700" : "bg-white/[0.06] text-slate-100")}
                >
                  <span className="inline-flex items-center gap-2"><ArrowDownToLine className="size-4" /> Скачать</span>
                </a>

                <div className={cn("rounded-[22px] px-4 py-3 text-sm", isPink ? "bg-[#fff4fa] text-pink-900" : "bg-white/[0.05] text-slate-300")}>
                  {photoIndex + 1} / {selectedGroup.entries.length}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

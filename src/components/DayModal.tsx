import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateLabel } from "@/lib/date";
import { compressImageFile } from "@/lib/image";
import { useAppStore } from "@/store/useAppStore";
import type { CalendarEntry, EntryVisibility, UserId, WorkPreset } from "@/types";

const LOVE_COLORS = ["#7ec8ff", "#ff9ad2", "#c6b7ff", "#ffd9a0", "#a7f0d2", "#ffe4f1"];
const LOVE_EMOJIS = ["💙", "🩷", "💞", "🌸", "🎀", "✨", "🥰", "🌙"];

const initialForm = {
  title: "",
  text: "",
  previewText: "",
  visibility: "shared" as EntryVisibility,
  imageUrl: "",
  imageName: "",
  color: LOVE_COLORS[0],
  icon: LOVE_EMOJIS[0]
};

type LoveView = "day" | "editor";
type WorkView = "day" | "presets" | "editor" | "note";

type WorkPresetDraft = {
  title: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  paidHours: string;
  bonus: number;
  expenses: number;
  color: string;
  icon: string;
  note: string;
};

const WORK_COLORS = ["#f8e49b", "#cfe6ff", "#f5c9ec", "#ffd4b0", "#bfe8aa", "#d6dcff", "#f7c5d8", "#efe2a3"];
const WORK_ICONS = ["💼", "🖼️", "💊", "🍕", "💗", "🔥", "🎵", "⏰", "🏀", "📌"];

const withAlpha = (hex: string | undefined, alpha: number) => {
  if (!hex) {
    return undefined;
  }

  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized;
  if (safe.length !== 6) {
    return undefined;
  }

  const value = Number.parseInt(safe, 16);
  if (Number.isNaN(value)) {
    return undefined;
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const createPresetDraft = (preset?: WorkPreset): WorkPresetDraft => ({
  title: preset?.title ?? "Новая смена",
  allDay: preset?.allDay ?? false,
  startTime: preset?.startTime ?? "09:00",
  endTime: preset?.endTime ?? "17:00",
  hourlyRate: preset?.hourlyRate ?? 250,
  paidHours: preset?.paidHours ?? "8ч",
  bonus: preset?.bonus ?? 0,
  expenses: preset?.expenses ?? 0,
  color: preset?.color ?? WORK_COLORS[0],
  icon: preset?.icon ?? WORK_ICONS[0],
  note: preset?.note ?? ""
});

const buildScheduleLabel = (preset: Pick<WorkPresetDraft, "allDay" | "startTime" | "endTime">) => (
  preset.allDay ? "Весь день" : `${preset.startTime} • ${preset.endTime}`
);

const buildRateLabel = (preset: Pick<WorkPresetDraft, "hourlyRate" | "paidHours" | "allDay">) => {
  if (preset.hourlyRate <= 0) {
    return preset.allDay ? "Без оплаты" : preset.paidHours || "Без оплаты";
  }

  const rateText = `${preset.hourlyRate.toFixed(1).replace(/\.0$/, "")} ₽/ч`;
  return preset.paidHours ? `${preset.paidHours} • ${rateText}` : rateText;
};

const buildWorkText = (preset: WorkPresetDraft) => {
  const chunks = [preset.note.trim(), buildScheduleLabel(preset), buildRateLabel(preset)];
  return chunks.filter(Boolean).join("\n");
};

export const DayModal = () => {
  const {
    snapshot,
    session,
    closeDate,
    addEntry,
    updateEntry,
    deleteEntry,
    uploadAttachment,
    markOpenedDateViewed,
    updateSettings
  } = useAppStore();
  const isPink = snapshot.settings.theme === "whitePink";
  const currentUserId = session.currentUserId;
  const [loveView, setLoveView] = useState<LoveView>("day");
  const [workView, setWorkView] = useState<WorkView>("day");
  const [form, setForm] = useState(initialForm);
  const [clipboardStatus, setClipboardStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [presetDraft, setPresetDraft] = useState<WorkPresetDraft>(createPresetDraft());
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingLoveEntryId, setEditingLoveEntryId] = useState<string | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const loveHoldTimeoutRef = useRef<number | null>(null);
  const loveLongPressTriggeredRef = useRef(false);

  const dayEntries = useMemo(() => {
    if (!session.openedDate || !currentUserId) {
      return [];
    }

    return snapshot.entries
      .filter((entry) => {
        if (entry.date !== session.openedDate || entry.mode !== session.mode) {
          return false;
        }
        return entry.visibility === "shared" || entry.authorId === currentUserId;
      })
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  }, [snapshot.entries, session.openedDate, session.mode, currentUserId]);

  const workPresets = snapshot.settings.workPresets ?? [];
  const subtleTextClass = isPink ? "text-[#7b8494]" : "text-slate-300/64";

  useEffect(() => {
    if (!session.openedDate) {
      setForm(initialForm);
      setClipboardStatus("");
      setLoveView("day");
      setWorkView("day");
      setPresetDraft(createPresetDraft());
      setEditingPresetId(null);
      setEditingLoveEntryId(null);
      return;
    }

    setLoveView("day");
    setWorkView("day");
    setPresetDraft(createPresetDraft());
    setEditingPresetId(null);
    setEditingLoveEntryId(null);
  }, [session.openedDate, dayEntries.length]);

  useEffect(() => {
    if (!session.openedDate || dayEntries.length === 0 || !currentUserId) {
      return;
    }

    void markOpenedDateViewed();
  }, [currentUserId, dayEntries.length, markOpenedDateViewed, session.openedDate, session.mode]);

  const handleAttach = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const compressed = await compressImageFile(file, 1800, 0.82);
    const uploaded = await uploadAttachment(compressed.originalName, compressed.dataUrl);
    setForm((old) => ({
      ...old,
      imageUrl: uploaded,
      imageName: compressed.originalName
    }));
    setClipboardStatus(`Фото подготовлено: ${compressed.originalName}`);
    event.target.value = "";
  };

  const openLoveEditor = (entry?: CalendarEntry) => {
    setEditingLoveEntryId(entry?.id ?? null);
    setForm(
      entry
        ? {
            title: entry.title,
            text: entry.text,
            previewText: entry.previewText,
            visibility: entry.visibility,
            imageUrl: entry.imageUrl ?? "",
            imageName: entry.imageName ?? "",
            color: entry.workMeta?.color ?? LOVE_COLORS[0],
            icon: entry.workMeta?.icon ?? LOVE_EMOJIS[0]
          }
        : initialForm
    );
    setClipboardStatus("");
    setLoveView("editor");
  };

  const cancelLovePress = () => {
    if (loveHoldTimeoutRef.current) {
      window.clearTimeout(loveHoldTimeoutRef.current);
      loveHoldTimeoutRef.current = null;
    }
  };

  const startLovePress = (entry: CalendarEntry) => {
    if (!currentUserId || entry.authorId !== currentUserId) {
      return;
    }

    loveLongPressTriggeredRef.current = false;
    loveHoldTimeoutRef.current = window.setTimeout(() => {
      loveLongPressTriggeredRef.current = true;
      openLoveEditor(entry);
    }, 420);
  };

  const releaseLovePress = () => {
    if (loveLongPressTriggeredRef.current) {
      loveLongPressTriggeredRef.current = false;
      cancelLovePress();
      return;
    }

    cancelLovePress();
  };

  const saveLoveEntry = async () => {
    if (!session.openedDate) {
      return;
    }

    const cleanTitle = form.title.trim() || "Наша заметка";
    const cleanText = form.text.trim();
    const preview = (form.previewText.trim() || cleanTitle || cleanText || "Наша заметка").slice(0, 28);
    const payload = {
      date: session.openedDate,
      mode: "love" as const,
      title: cleanTitle,
      text: cleanText,
      previewText: preview,
      visibility: form.visibility,
      imageUrl: form.imageUrl || undefined,
      imageName: form.imageName || undefined,
      workMeta: {
        color: form.color,
        icon: form.icon
      }
    };

    setIsSaving(true);
    if (editingLoveEntryId) {
      await updateEntry(editingLoveEntryId, payload);
    } else {
      await addEntry(payload);
    }
    setForm(initialForm);
    setClipboardStatus("");
    setEditingLoveEntryId(null);
    setLoveView("day");
    setIsSaving(false);
  };

  const saveWorkNote = async () => {
    if (!session.openedDate) {
      return;
    }

    setIsSaving(true);
    await addEntry({
      date: session.openedDate,
      mode: "work",
      title: form.title.trim() || "Рабочая заметка",
      text: form.text.trim(),
      previewText: form.previewText.trim().slice(0, 24) || "Заметка",
      visibility: form.visibility,
      workMeta: {
        color: "#cfe6ff",
        icon: "📝",
        scheduleLabel: "Свободная запись",
        rateLabel: "Без оплаты",
        note: form.text.trim()
      }
    });
    setForm(initialForm);
    setWorkView("day");
    setIsSaving(false);
  };

  const persistWorkPresets = async (presets: WorkPreset[]) => {
    await updateSettings({ workPresets: presets });
  };

  const openPresetEditor = (preset?: WorkPreset) => {
    setEditingPresetId(preset?.id ?? null);
    setPresetDraft(createPresetDraft(preset));
    setWorkView("editor");
  };

  const savePresetOnly = async () => {
    const now = new Date().toISOString();
    const nextPreset: WorkPreset = {
      id: editingPresetId ?? crypto.randomUUID(),
      createdAt: editingPresetId ? workPresets.find((item) => item.id === editingPresetId)?.createdAt ?? now : now,
      updatedAt: now,
      ...presetDraft,
      title: presetDraft.title.trim() || "Новая смена",
      paidHours: presetDraft.paidHours.trim() || (presetDraft.allDay ? "Весь день" : "8ч"),
      note: presetDraft.note.trim()
    };

    const nextPresets = editingPresetId
      ? workPresets.map((item) => (item.id === editingPresetId ? nextPreset : item))
      : [nextPreset, ...workPresets];

    await persistWorkPresets(nextPresets);
    setEditingPresetId(nextPreset.id);
    setWorkView("presets");
  };

  const deletePresetOnly = async () => {
    if (!editingPresetId) {
      return;
    }

    const accepted = window.confirm("Удалить этот пресет?");
    if (!accepted) {
      return;
    }

    await persistWorkPresets(workPresets.filter((item) => item.id !== editingPresetId));
    setEditingPresetId(null);
    setPresetDraft(createPresetDraft());
    setWorkView("presets");
  };

  const applyPresetToDate = async (draft: WorkPresetDraft) => {
    if (!session.openedDate) {
      return;
    }

    setIsSaving(true);
    await addEntry({
      date: session.openedDate,
      mode: "work",
      title: draft.title.trim() || "Новая смена",
      text: buildWorkText(draft),
      previewText: (draft.title.trim() || "Смена").slice(0, 24),
      visibility: "shared",
      workMeta: {
        presetId: editingPresetId ?? undefined,
        color: draft.color,
        icon: draft.icon,
        scheduleLabel: buildScheduleLabel(draft),
        rateLabel: buildRateLabel(draft),
        note: draft.note.trim()
      }
    });
    setIsSaving(false);
    setWorkView("day");
  };

  const assignPreset = async (preset: WorkPreset) => {
    setEditingPresetId(preset.id);
    setPresetDraft(createPresetDraft(preset));
    await applyPresetToDate(createPresetDraft(preset));
  };

  const startPresetPress = (preset: WorkPreset) => {
    longPressTriggeredRef.current = false;
    holdTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openPresetEditor(preset);
    }, 420);
  };

  const cancelPresetPress = () => {
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const releasePresetPress = async (preset: WorkPreset) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      cancelPresetPress();
      return;
    }

    cancelPresetPress();
    await assignPreset(preset);
  };

  const workSheetClass = cn(
    "fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/82 backdrop-blur-[10px] sm:items-center sm:p-5",
    isPink ? "bg-slate-950/75" : "bg-slate-950/82"
  );

  const workPanelClass = cn(
    "relative flex h-[100dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[30px] border px-4 pb-0 pt-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:h-auto sm:max-h-[92dvh] sm:rounded-[34px] sm:px-5 sm:pt-4",
    isPink ? "border-white/[0.88] bg-[linear-gradient(180deg,#f7f9ff_0%,#eef2fa_100%)] text-[#2d3442]" : "border-white/[0.10] bg-[#07111d] text-white"
  );

  const solidPanelClass = cn(
    "rounded-[26px] border p-4",
    isPink ? "border-white/[0.90] bg-white/[0.94]" : "border-white/[0.08] bg-[#0b1726]"
  );


  const lovePanelClass = cn(
    "relative flex h-[100dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[30px] border px-4 pb-0 pt-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:h-auto sm:max-h-[92dvh] sm:rounded-[34px] sm:px-5 sm:pt-4",
    isPink ? "border-white/[0.88] bg-[linear-gradient(180deg,#fff8fc_0%,#fdf2f8_100%)] text-[#382836]" : "border-white/[0.10] bg-[#06101b] text-white"
  );

  return (
    <AnimatePresence>
      {session.openedDate ? (
        session.mode === "work" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={workSheetClass}
            onClick={closeDate}
          >
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className={workPanelClass}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("text-[11px] uppercase tracking-[0.3em]", isPink ? "text-pink-500/70" : "text-sky-200/60")}>Рабочий день</div>
                  <div className="mt-1 text-[24px] font-semibold leading-none">{formatDateLabel(session.openedDate)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {workView === "day" ? (
                    <button
                      type="button"
                      onClick={() => setWorkView("presets")}
                      className="inline-flex size-11 items-center justify-center rounded-full border-2 border-sky-300 bg-sky-400/15 text-sky-200 shadow-[0_0_0_4px_rgba(56,189,248,0.08)]"
                    >
                      <Plus className="size-6" />
                    </button>
                  ) : null}
                  <button onClick={closeDate} className={cn("rounded-2xl p-3", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(6.9rem+env(safe-area-inset-bottom))] pr-1">
                {workView === "day" ? (
                  <div className="space-y-3">
                    {dayEntries.length > 0 ? (
                      dayEntries.map((entry) => (
                        <div key={entry.id} className={cn("rounded-[20px] border px-3 py-3", isPink ? "border-white/[0.90] bg-white/[0.95]" : "border-white/[0.08] bg-[#0b1726]")}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-[20px]"
                                style={{ background: withAlpha(entry.workMeta?.color ?? "#cfe6ff", 0.94) ?? "#cfe6ff" }}
                              >
                                {entry.workMeta?.icon ?? "💼"}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-[16px] font-semibold leading-tight">{entry.previewText || entry.title}</div>
                                <div className={cn("mt-0.5 truncate text-[13px]", isPink ? "text-[#556070]" : "text-slate-300/78")}>
                                  {entry.workMeta?.scheduleLabel ?? "Свободная запись"}
                                  {entry.workMeta?.rateLabel ? ` • ${entry.workMeta.rateLabel}` : ""}
                                </div>
                                {entry.workMeta?.note || entry.text ? <div className={cn("mt-0.5 truncate text-[11px]", isPink ? "text-[#7b8395]" : "text-slate-400/76")}>{entry.workMeta?.note || entry.text}</div> : null}
                              </div>
                            </div>
                            {currentUserId === entry.authorId ? (
                              <button type="button" onClick={() => void deleteEntry(entry.id)} className={cn("rounded-2xl p-2", isPink ? "bg-[#fff1f6] text-pink-700" : "bg-white/[0.06] text-slate-100")}>
                                <Trash2 className="size-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={cn("rounded-[24px] border border-dashed px-4 py-8 text-center text-sm", isPink ? "border-white/[0.88] bg-white/[0.92] text-[#687286]" : "border-white/[0.10] bg-[#0b1726] text-slate-300/78")}>
                        Здесь пока пусто
                      </div>
                    )}
                  </div>
                ) : workView === "presets" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setWorkView("day")} className={cn("rounded-2xl p-2", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                        <ArrowLeft className="size-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[22px] font-semibold leading-none">Выбрать смену</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <button type="button" onClick={() => openPresetEditor()} className={cn("rounded-[16px] px-4 py-2.5 text-left text-sm font-semibold", isPink ? "bg-[#eef5ff] text-[#445063]" : "bg-white/[0.06] text-slate-100")}>Создать новую</button>
                      <button type="button" onClick={() => setWorkView("note")} className={cn("rounded-[16px] px-4 py-2.5 text-sm font-semibold", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>Заметка</button>
                    </div>

                    <div className="space-y-3">
                      {workPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onPointerDown={() => startPresetPress(preset)}
                          onPointerUp={() => void releasePresetPress(preset)}
                          onPointerLeave={cancelPresetPress}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            cancelPresetPress();
                            openPresetEditor(preset);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void assignPreset(preset);
                            }
                          }}
                          className={cn("w-full rounded-[20px] border px-3 py-3 text-left", isPink ? "border-white/[0.90] bg-white/[0.95]" : "border-white/[0.08] bg-[#0b1726]")}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: withAlpha(preset.color, 0.94) ?? "#cfe6ff" }}>{preset.icon}</div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[17px] font-semibold leading-tight">{preset.title}</div>
                              <div className={cn("mt-0.5 text-[13px]", isPink ? "text-[#556070]" : "text-slate-300/78")}>{buildScheduleLabel(preset)} • {buildRateLabel(preset)}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : workView === "editor" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setWorkView("presets")} className={cn("rounded-2xl p-2", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                        <ArrowLeft className="size-4" />
                      </button>
                      <div className="text-lg font-semibold">{editingPresetId ? "Изменить пресет" : "Новый пресет"}</div>
                    </div>

                    <div className={solidPanelClass}>
                      <div className="space-y-4">
                        <label className="block">
                          <div className="mb-2 text-sm font-medium">Название</div>
                          <input
                            value={presetDraft.title}
                            onChange={(event) => setPresetDraft((old) => ({ ...old, title: event.target.value }))}
                            className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")}
                            placeholder="Например: Дневная смена"
                          />
                        </label>

                        {presetDraft.allDay ? (
                          <div className={cn("rounded-[18px] border px-4 py-3 text-sm font-medium", isPink ? "border-[#e6edf8] bg-[#f7f9fd] text-[#556070]" : "border-white/[0.08] bg-[#071320] text-slate-200")}>
                            Пресет на весь день
                          </div>
                        ) : null}

                        {!presetDraft.allDay ? (
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <div className="mb-2 text-sm font-medium">Начало</div>
                              <input type="time" value={presetDraft.startTime} onChange={(event) => setPresetDraft((old) => ({ ...old, startTime: event.target.value }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} />
                            </label>
                            <label className="block">
                              <div className="mb-2 text-sm font-medium">Конец</div>
                              <input type="time" value={presetDraft.endTime} onChange={(event) => setPresetDraft((old) => ({ ...old, endTime: event.target.value }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} />
                            </label>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <div className="mb-2 text-sm font-medium">Почасовая ставка</div>
                            <input type="number" value={presetDraft.hourlyRate} onChange={(event) => setPresetDraft((old) => ({ ...old, hourlyRate: Number(event.target.value) || 0 }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} />
                          </label>
                          <label className="block">
                            <div className="mb-2 text-sm font-medium">Оплачиваемое время</div>
                            <input value={presetDraft.paidHours} onChange={(event) => setPresetDraft((old) => ({ ...old, paidHours: event.target.value }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} placeholder="8ч" />
                          </label>
                          <label className="block">
                            <div className="mb-2 text-sm font-medium">Доплата</div>
                            <input type="number" value={presetDraft.bonus} onChange={(event) => setPresetDraft((old) => ({ ...old, bonus: Number(event.target.value) || 0 }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} />
                          </label>
                          <label className="block">
                            <div className="mb-2 text-sm font-medium">Расходы</div>
                            <input type="number" value={presetDraft.expenses} onChange={(event) => setPresetDraft((old) => ({ ...old, expenses: Number(event.target.value) || 0 }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} />
                          </label>
                        </div>

                        <div>
                          <div className="mb-2 text-sm font-medium">Цвет</div>
                          <div className="flex flex-wrap gap-3">
                            {WORK_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setPresetDraft((old) => ({ ...old, color }))}
                                className={cn("size-12 rounded-full border-2", presetDraft.color === color ? "border-sky-300 shadow-[0_0_0_4px_rgba(56,189,248,0.10)]" : "border-transparent")}
                                style={{ background: color }}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-2 text-sm font-medium">Иконка</div>
                          <div className="flex flex-wrap gap-2">
                            {WORK_ICONS.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                onClick={() => setPresetDraft((old) => ({ ...old, icon }))}
                                className={cn("flex size-12 items-center justify-center rounded-full text-xl", presetDraft.icon === icon ? isPink ? "bg-[#eef5ff] text-[#445063]" : "bg-sky-400/15 text-sky-200" : isPink ? "bg-[#f7f9fd] text-[#445063]" : "bg-white/[0.06] text-slate-200")}
                              >
                                {icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="block">
                          <div className="mb-2 text-sm font-medium">Заметка</div>
                          <textarea
                            rows={4}
                            value={presetDraft.note}
                            onChange={(event) => setPresetDraft((old) => ({ ...old, note: event.target.value }))}
                            className={cn("w-full resize-none rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")}
                            placeholder="Короткий комментарий к пресету"
                          />
                        </label>

                        <div className={cn("rounded-[22px] border p-4", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.06] bg-[#071320]")}>
                          <div className="flex items-center gap-3">
                            <div className="flex size-14 items-center justify-center rounded-full text-2xl" style={{ background: withAlpha(presetDraft.color, 0.94) ?? "#cfe6ff" }}>{presetDraft.icon}</div>
                            <div className="min-w-0">
                              <div className="truncate text-lg font-semibold">{presetDraft.title || "Новая смена"}</div>
                              <div className={cn("mt-1 text-sm", isPink ? "text-[#556070]" : "text-slate-300/75")}>{buildScheduleLabel(presetDraft)} • {buildRateLabel(presetDraft)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-3 pb-2">
                      <button type="button" onClick={() => void applyPresetToDate(presetDraft)} disabled={isSaving} className="rounded-[22px] bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-4 text-sm font-semibold text-slate-950">
                        {isSaving ? "Сохраняю..." : "Поставить на день"}
                      </button>
                      <button type="button" onClick={() => void savePresetOnly()} className={cn("rounded-[22px] px-4 py-4", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                        <Save className="size-5" />
                      </button>
                    </div>

                    {editingPresetId ? (
                      <button type="button" onClick={() => void deletePresetOnly()} className={cn("w-full rounded-[22px] px-4 py-3 text-sm font-medium", isPink ? "bg-[#fff1f6] text-pink-700" : "bg-[#2a0d15] text-rose-100")}>
                        Удалить пресет
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await saveWorkNote();
                    }}
                  >
                    <label className="block">
                      <div className="mb-2 text-sm font-medium">Название</div>
                      <input value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} placeholder="Например: планёрка" />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-sm font-medium">Подпись на ячейке</div>
                      <input value={form.previewText} maxLength={24} onChange={(event) => setForm((old) => ({ ...old, previewText: event.target.value }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} placeholder="Короткая подпись" />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-sm font-medium">Текст заметки</div>
                      <textarea rows={5} value={form.text} onChange={(event) => setForm((old) => ({ ...old, text: event.target.value }))} className={cn("w-full resize-none rounded-[20px] border px-4 py-3", isPink ? "border-[#e6edf8] bg-[#f7f9fd]" : "border-white/[0.08] bg-[#071320] text-white")} placeholder="Короткий комментарий к дню" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setForm((old) => ({ ...old, visibility: "shared" }))} className={cn("rounded-[20px] px-4 py-3 text-sm font-medium", form.visibility === "shared" ? "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950" : isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-200")}>Общая</button>
                      <button type="button" onClick={() => setForm((old) => ({ ...old, visibility: "private" }))} className={cn("rounded-[20px] px-4 py-3 text-sm font-medium", form.visibility === "private" ? "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950" : isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-200")}>Личная</button>
                    </div>
                    <button type="submit" disabled={isSaving} className="w-full rounded-[22px] bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-4 text-sm font-semibold text-slate-950">{isSaving ? "Сохраняю..." : "Сохранить запись"}</button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={workSheetClass}
            onClick={closeDate}
          >
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className={lovePanelClass}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("text-[11px] uppercase tracking-[0.3em]", isPink ? "text-pink-500/70" : "text-sky-200/60")}>Любовный день</div>
                  <div className="mt-1 text-[24px] font-semibold leading-none">{formatDateLabel(session.openedDate)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {loveView === "day" ? (
                    <button
                      type="button"
                      onClick={() => openLoveEditor()}
                      className="inline-flex size-11 items-center justify-center rounded-full border-2 border-sky-300 bg-sky-400/15 text-sky-200 shadow-[0_0_0_4px_rgba(56,189,248,0.08)]"
                    >
                      <Plus className="size-6" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setLoveView("day"); setEditingLoveEntryId(null); setForm(initialForm); setClipboardStatus(""); }} className={cn("rounded-2xl p-3", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                      <ArrowLeft className="size-4" />
                    </button>
                  )}
                  <button onClick={closeDate} className={cn("rounded-2xl p-3", isPink ? "bg-white text-[#445063]" : "bg-white/[0.06] text-slate-100")}>
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(6.9rem+env(safe-area-inset-bottom))] pr-1">
                {loveView === "day" ? (
                  <div className="space-y-3">
                    {dayEntries.length > 0 ? (
                      dayEntries.map((entry) => {
                        const isEdited = entry.updatedAt !== entry.createdAt;
                        const viewedBy = entry.viewedBy ?? [];
                        return (
                          <div
                            key={entry.id}
                            onPointerDown={() => startLovePress(entry)}
                            onPointerUp={() => releaseLovePress()}
                            onPointerLeave={cancelLovePress}
                            onContextMenu={(event) => {
                              if (currentUserId === entry.authorId) {
                                event.preventDefault();
                                cancelLovePress();
                                openLoveEditor(entry);
                              }
                            }}
                            className={cn("w-full rounded-[20px] border px-3 py-3 text-left", isPink ? "border-white/[0.90] bg-white/[0.96]" : "border-white/[0.08] bg-[#0b1726]")}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-full text-[22px]" style={{ background: withAlpha(entry.workMeta?.color ?? LOVE_COLORS[0], 0.94) ?? LOVE_COLORS[0] }}>
                                {entry.workMeta?.icon ?? "💙"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-[17px] font-semibold leading-tight">{entry.title}</div>
                                  {isEdited ? <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", isPink ? "bg-[#fff0f7] text-fuchsia-700" : "bg-white/[0.08] text-slate-200")}>изм.</span> : null}
                                </div>
                                {entry.text ? <div className={cn("mt-1 line-clamp-2 text-[12px] leading-5", subtleTextClass)}>{entry.text}</div> : null}
                                <div className={cn("mt-2 flex items-center gap-1 text-[9px]", subtleTextClass)}>
                                  <span>{entry.visibility === "shared" ? "для двоих" : "для себя"}</span>
                                  {viewedBy.length > 0 ? <span>•</span> : null}
                                  {(["vlad", "liya"] as UserId[]).map((userId) => (
                                    viewedBy.includes(userId) ? (
                                      <span key={`${entry.id}-${userId}`} className={cn("inline-flex size-4 items-center justify-center rounded-full text-[8px] font-semibold", userId === "vlad" ? "bg-sky-400/18 text-sky-200" : "bg-pink-400/18 text-pink-200")}>
                                        {snapshot.users[userId].nickname.slice(0, 1)}
                                      </span>
                                    ) : null
                                  ))}
                                </div>
                              </div>
                              {entry.imageUrl ? (
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[16px] border border-black/[0.06] bg-[#090c12]">
                                  <img src={entry.imageUrl} alt={entry.imageName || entry.title} className="h-full w-full object-cover" />
                                </div>
                              ) : null}
                              {currentUserId === entry.authorId ? (
                                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); void deleteEntry(entry.id); }} className={cn("rounded-2xl p-2", isPink ? "bg-white text-pink-600" : "bg-white/[0.05] text-slate-100")}>
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className={cn("rounded-[24px] border border-dashed px-4 py-10 text-center text-sm", isPink ? "border-white/[0.88] bg-white/[0.92] text-[#687286]" : "border-white/[0.10] bg-[#0b1726] text-slate-300/78")}>
                        Пока пусто
                      </div>
                    )}
                  </div>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await saveLoveEntry();
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setForm((old) => ({ ...old, visibility: "shared" }))} className={cn("rounded-[18px] px-4 py-3 text-sm font-medium", form.visibility === "shared" ? isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950" : isPink ? "bg-white text-pink-700" : "bg-white/[0.05] text-slate-200")}>Для двоих</button>
                      <button type="button" onClick={() => setForm((old) => ({ ...old, visibility: "private" }))} className={cn("rounded-[18px] px-4 py-3 text-sm font-medium", form.visibility === "private" ? isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950" : isPink ? "bg-white text-pink-700" : "bg-white/[0.05] text-slate-200")}>Для себя</button>
                    </div>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium">Заголовок</div>
                      <input value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value, previewText: event.target.value.slice(0, 28) }))} className={cn("w-full rounded-[20px] border px-4 py-3", isPink ? "border-white/[0.90] bg-white/[0.95]" : "border-white/[0.08] bg-[#0c1524] text-white")} placeholder="Например: ужин, прогулка, кино" />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium">Описание</div>
                      <textarea rows={5} value={form.text} onChange={(event) => setForm((old) => ({ ...old, text: event.target.value }))} className={cn("w-full resize-none rounded-[20px] border px-4 py-3", isPink ? "border-white/[0.90] bg-white/[0.95]" : "border-white/[0.08] bg-[#0c1524] text-white")} placeholder="Коротко и красиво опиши день" />
                    </label>

                    <div>
                      <div className="mb-2 text-sm font-medium">Цвет</div>
                      <div className="flex flex-wrap gap-2">
                        {LOVE_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setForm((old) => ({ ...old, color }))}
                            className={cn("size-10 rounded-full border-2", form.color === color ? "border-sky-300 shadow-[0_0_0_4px_rgba(56,189,248,0.10)]" : "border-transparent")}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-sm font-medium">Эмодзи</div>
                      <div className="flex flex-wrap gap-2">
                        {LOVE_EMOJIS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setForm((old) => ({ ...old, icon }))}
                            className={cn("flex size-10 items-center justify-center rounded-full text-lg", form.icon === icon ? isPink ? "bg-[#eef5ff] text-[#445063]" : "bg-sky-400/15 text-sky-200" : isPink ? "bg-[#f7f9fd] text-[#445063]" : "bg-white/[0.06] text-slate-200")}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-[20px] border border-dashed px-4 py-3 text-sm", isPink ? "border-white/[0.84] bg-white/[0.90]" : "border-white/[0.15] bg-[#0c1524] text-slate-200")}>
                        <ImagePlus className="size-4" />
                        Фото
                        <input type="file" accept="image/*" className="hidden" onChange={handleAttach} />
                      </label>
                      {form.imageUrl ? (
                        <button type="button" onClick={() => setForm((old) => ({ ...old, imageUrl: "", imageName: "" }))} className={cn("rounded-[20px] px-4 py-3 text-sm", isPink ? "bg-white text-pink-700" : "bg-white/[0.06] text-slate-100")}>
                          Убрать
                        </button>
                      ) : null}
                    </div>

                    {form.imageUrl ? (
                      <div className="overflow-hidden rounded-[22px] border border-black/[0.05] bg-[#0a0a0d]">
                        <img src={form.imageUrl} alt={form.imageName || "Новое фото"} className="max-h-[220px] w-full object-contain" />
                      </div>
                    ) : null}

                    <div className={cn("rounded-[20px] border p-3", isPink ? "border-white/[0.90] bg-white/[0.95]" : "border-white/[0.08] bg-[#0b1726]")}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full text-[21px]" style={{ background: withAlpha(form.color, 0.94) ?? LOVE_COLORS[0] }}>
                          {form.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[16px] font-semibold">{form.title.trim() || "Новая заметка"}</div>
                          <div className={cn("mt-1 truncate text-[12px]", subtleTextClass)}>{form.text.trim() || "Описание появится здесь"}</div>
                        </div>
                      </div>
                    </div>

                    {clipboardStatus ? <div className={cn("rounded-[18px] px-4 py-3 text-sm", isPink ? "bg-white text-pink-700" : "bg-white/[0.05] text-slate-300")}>{clipboardStatus}</div> : null}

                    <button type="submit" disabled={isSaving} className={cn("w-full rounded-[22px] px-4 py-4 text-sm font-semibold", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}>
                      <span className="inline-flex items-center gap-2"><Upload className="size-4" /> {isSaving ? "Сохраняю..." : editingLoveEntryId ? "Сохранить изменения" : "Сохранить"}</span>
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )
      ) : null}
    </AnimatePresence>
  );
};

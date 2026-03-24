import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  ChevronRight,
  Clock3,
  Coins,
  TrendingUp
} from "lucide-react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ru } from "date-fns/locale";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";
import type { CalendarEntry, WorkPreset } from "@/types";

type MetricKey = "earnings" | "hours" | "shifts";
type ChartKind = "bar" | "line" | "area";

type DailyStats = {
  date: string;
  earnings: number;
  hours: number;
  shifts: number;
  title: string;
  icon: string;
  color: string;
  entryCount: number;
};

type SummaryCard = {
  key: MetricKey;
  title: string;
  headline: string;
  subtitle: string;
  values: number[];
  labels: string[];
  icon: typeof Coins;
  tone: string;
  toneSoft: string;
};

const money = (value: number) => `${value.toFixed(1).replace(/\.0$/, "")} ₽`;

const hoursToLabel = (value: number) => {
  const wholeHours = Math.floor(value);
  const minutes = Math.round((value - wholeHours) * 60);
  if (wholeHours <= 0 && minutes <= 0) return "0ч";
  if (minutes <= 0) return `${wholeHours}ч`;
  return `${wholeHours}ч ${minutes}мин`;
};

const shiftLabel = (value: number) => {
  const rounded = Math.round(value);
  if (rounded % 10 === 1 && rounded % 100 !== 11) return `${rounded} смена`;
  if ([2, 3, 4].includes(rounded % 10) && ![12, 13, 14].includes(rounded % 100)) return `${rounded} смены`;
  return `${rounded} смен`;
};

const formatMetricValue = (metric: MetricKey, value: number) => {
  if (metric === "earnings") return money(value);
  if (metric === "hours") return hoursToLabel(value);
  return shiftLabel(value);
};

const parseHours = (value?: string) => {
  if (!value) return null;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*ч/i);
  return match ? Number(match[1]) : null;
};

const parseHourlyRate = (value?: string) => {
  if (!value) return 0;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*₽/i);
  return match ? Number(match[1]) : 0;
};

const durationHours = (start: string, end: string) => {
  const [startHour = "0", startMinute = "0"] = start.split(":");
  const [endHour = "0", endMinute = "0"] = end.split(":");
  const startMinutes = Number(startHour) * 60 + Number(startMinute);
  let endMinutes = Number(endHour) * 60 + Number(endMinute);
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return Math.max(0, (endMinutes - startMinutes) / 60);
};

const getPresetForEntry = (entry: CalendarEntry, presetsById: Map<string, WorkPreset>) => {
  const presetId = entry.workMeta?.presetId;
  if (presetId && presetsById.has(presetId)) {
    return presetsById.get(presetId) ?? null;
  }

  const normalizedTitle = (entry.title || entry.previewText || "").trim().toLowerCase();
  for (const preset of presetsById.values()) {
    if (preset.title.trim().toLowerCase() === normalizedTitle) {
      return preset;
    }
  }

  return null;
};

const getEntryMetrics = (entry: CalendarEntry, presetsById: Map<string, WorkPreset>) => {
  const preset = getPresetForEntry(entry, presetsById);
  const isWorkNote = entry.workMeta?.scheduleLabel === "Свободная запись" || entry.workMeta?.icon === "📝";

  if (isWorkNote) {
    return {
      earnings: 0,
      hours: 0,
      shifts: 0,
      icon: entry.workMeta?.icon ?? "📝",
      color: entry.workMeta?.color ?? "#cfe6ff",
      title: entry.previewText || entry.title || "Заметка"
    };
  }

  if (preset) {
    const paidHours = parseHours(preset.paidHours) ?? (!preset.allDay ? durationHours(preset.startTime, preset.endTime) : 0);
    const earnings = Math.max(0, preset.hourlyRate * paidHours + preset.bonus - preset.expenses);

    return {
      earnings,
      hours: paidHours,
      shifts: 1,
      icon: preset.icon || "💼",
      color: preset.color || "#cfe6ff",
      title: preset.title || entry.previewText || entry.title || "Смена"
    };
  }

  const hours = parseHours(entry.workMeta?.rateLabel) ?? parseHours(entry.workMeta?.scheduleLabel) ?? 0;
  const rate = parseHourlyRate(entry.workMeta?.rateLabel);

  return {
    earnings: Math.max(0, rate * hours),
    hours,
    shifts: rate > 0 || hours > 0 || Boolean(entry.workMeta?.scheduleLabel) ? 1 : 0,
    icon: entry.workMeta?.icon ?? "💼",
    color: entry.workMeta?.color ?? "#cfe6ff",
    title: entry.previewText || entry.title || "Смена"
  };
};

const toneByMetric: Record<MetricKey, string> = {
  earnings: "#f29aaa",
  hours: "#ee969d",
  shifts: "#b6e9b0"
};

const chartOptions: Array<{ key: ChartKind; icon: typeof BarChart3; label: string }> = [
  { key: "bar", icon: BarChart3, label: "Столбцы" },
  { key: "line", icon: TrendingUp, label: "Линия" },
  { key: "area", icon: Activity, label: "Область" }
];

const ChartTypeToggle = ({
  value,
  onChange,
  isPink
}: {
  value: ChartKind;
  onChange: (next: ChartKind) => void;
  isPink: boolean;
}) => (
  <div className={cn("inline-flex items-center gap-1 rounded-full border p-1", isPink ? "border-white/[0.84] bg-white/[0.86]" : "border-white/[0.10] bg-white/[0.05]") }>
    {chartOptions.map(({ key, icon: Icon, label }) => {
      const active = value === key;
      return (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition",
            active
              ? isPink
                ? "bg-[#eef5ff] text-[#4463de]"
                : "bg-sky-400/15 text-sky-100"
              : isPink
                ? "text-[#6b7486]"
                : "text-slate-300/72"
          )}
        >
          <Icon className="size-4" />
        </button>
      );
    })}
  </div>
);

const MetricChart = ({
  values,
  labels,
  tone,
  kind
}: {
  values: number[];
  labels: string[];
  tone: string;
  kind: ChartKind;
}) => {
  const max = Math.max(...values, 0);
  const svgWidth = 320;
  const svgHeight = 120;
  const paddingX = 18;
  const paddingY = 14;
  const innerWidth = svgWidth - paddingX * 2;
  const innerHeight = svgHeight - paddingY * 2;
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = paddingX + (values.length > 1 ? stepX * index : innerWidth / 2);
    const y = paddingY + innerHeight - (max <= 0 ? 0 : (value / max) * innerHeight);
    return { x, y, value };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length > 0
    ? `M ${points[0].x} ${paddingY + innerHeight} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} ${paddingY + innerHeight} Z`
    : "";

  return (
    <div className="mt-3 rounded-[20px] border border-white/8 bg-black/8 px-3 pb-3 pt-3">
      <div className="relative h-[132px] sm:h-[146px]">
        {[0.25, 0.5, 0.75].map((step) => (
          <div
            key={step}
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/18"
            style={{ bottom: `${12 + step * 76}%` }}
          />
        ))}

        {kind === "bar" ? (
          <div className="relative flex h-full items-end gap-2">
            {values.map((value, index) => {
              const height = max <= 0 ? 8 : Math.max(8, (value / max) * 100);
              return (
                <div key={`${labels[index]}-${index}`} className="relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="w-full rounded-t-[16px] rounded-b-[10px] shadow-[0_10px_24px_rgba(0,0,0,0.16)]" style={{ height: `${height}%`, background: tone }} />
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/72">{labels[index]}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative h-full">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full overflow-visible">
              {kind === "area" ? <path d={areaPath} fill={tone} opacity="0.2" /> : null}
              <polyline
                points={linePoints}
                fill="none"
                stroke={tone}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r="4.5" fill={tone} stroke="rgba(7,17,29,0.8)" strokeWidth="2" />
              ))}
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex gap-2">
              {labels.map((label, index) => (
                <div key={`${label}-${index}`} className="flex-1 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-white/72">{label}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const formatDateField = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return format(date, "d MMM yyyy", { locale: ru });
};

const MetricDetailSheet = ({
  metric,
  isPink,
  chartKind,
  onChartKindChange,
  rangeStart,
  rangeEnd,
  onRangeStartChange,
  onRangeEndChange,
  summaryValue,
  bucketValues,
  bucketLabels,
  dayRows,
  onClose,
  onOpenDate
}: {
  metric: MetricKey;
  isPink: boolean;
  chartKind: ChartKind;
  onChartKindChange: (next: ChartKind) => void;
  rangeStart: string;
  rangeEnd: string;
  onRangeStartChange: (next: string) => void;
  onRangeEndChange: (next: string) => void;
  summaryValue: number;
  bucketValues: number[];
  bucketLabels: string[];
  dayRows: DailyStats[];
  onClose: () => void;
  onOpenDate: (date: string) => void;
}) => {
  const titleMap: Record<MetricKey, string> = {
    earnings: "Заработок",
    hours: "Рабочие часы",
    shifts: "Смены"
  };

  const iconMap: Record<MetricKey, typeof Coins> = {
    earnings: Coins,
    hours: Clock3,
    shifts: BriefcaseBusiness
  };

  const summaryTone: Record<MetricKey, string> = {
    earnings: toneByMetric.earnings,
    hours: toneByMetric.hours,
    shifts: toneByMetric.shifts
  };

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] overflow-y-auto bg-[#07111d]"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className={cn(
            "mx-auto flex min-h-screen max-w-[760px] flex-col px-4 pb-[calc(6.8rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]",
            isPink ? "text-[#32273a]" : "text-white"
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={cn("rounded-[18px] border p-3", isPink ? "border-white/[0.84] bg-white/[0.94] text-[#4c4153]" : "border-white/[0.10] bg-[#101b2b] text-slate-100")}
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="text-center text-[20px] font-semibold sm:text-[26px]">{titleMap[metric]}</div>
            <div className="w-10" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={cn("rounded-[18px] border px-3 py-3", isPink ? "border-white/[0.84] bg-white/[0.94]" : "border-white/[0.10] bg-[#101b2b]") }>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Начало</div>
              <input
                type="date"
                value={rangeStart}
                max={rangeEnd}
                onChange={(event) => onRangeStartChange(event.target.value)}
                className="sr-only"
              />
              <div className="mt-2 text-lg font-semibold">{formatDateField(rangeStart)}</div>
            </label>
            <label className={cn("rounded-[18px] border px-3 py-3", isPink ? "border-white/[0.84] bg-white/[0.94]" : "border-white/[0.10] bg-[#101b2b]") }>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Конец</div>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart}
                onChange={(event) => onRangeEndChange(event.target.value)}
                className="sr-only"
              />
              <div className="mt-2 text-lg font-semibold">{formatDateField(rangeEnd)}</div>
            </label>
          </div>

          <div className={cn("mt-4 rounded-[24px] border px-4 py-4", isPink ? "border-white/[0.88] bg-white/[0.96]" : "border-white/[0.10] bg-[#101b2b]") }>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[28px] font-semibold leading-none sm:text-[36px]">{formatMetricValue(metric, summaryValue)}</div>
                <div className="mt-2 text-sm text-white/62">Всего за этот период</div>
              </div>
              <ChartTypeToggle value={chartKind} onChange={onChartKindChange} isPink={isPink} />
            </div>
            <MetricChart values={bucketValues} labels={bucketLabels} tone={summaryTone[metric]} kind={chartKind} />
          </div>

          <div className="mt-5 flex items-center gap-2">
            <CalendarRange className={cn("size-4", isPink ? "text-pink-500" : "text-sky-300")} />
            <div className="text-[11px] uppercase tracking-[0.26em] text-sky-200/60">По дням</div>
          </div>

          <div className="mt-3 space-y-3">
            {dayRows.length > 0 ? (
              dayRows.map((row) => {
                const MetricIcon = iconMap[metric];
                return (
                  <button
                    key={row.date}
                    type="button"
                    onClick={() => onOpenDate(row.date)}
                    className={cn("w-full rounded-[22px] border px-4 py-4 text-left transition active:scale-[0.99]", isPink ? "border-white/[0.84] bg-white/[0.94]" : "border-white/[0.10] bg-[#101b2b]") }
                  >
                    <div className="text-[28px] font-semibold leading-none">{formatMetricValue(metric, metric === "earnings" ? row.earnings : metric === "hours" ? row.hours : row.shifts)}</div>
                    <div className="mt-2 text-sm text-white/62">{formatDateField(row.date)}</div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-full text-2xl" style={{ background: row.color }}>
                          {row.icon || <MetricIcon className="size-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xl font-semibold">{row.title}</div>
                          <div className="mt-1 truncate text-sm text-white/62">
                            {metric === "hours" ? hoursToLabel(row.hours) : metric === "earnings" ? money(row.earnings) : shiftLabel(row.shifts)}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-white/72" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={cn("rounded-[22px] border px-4 py-8 text-center", isPink ? "border-white/[0.84] bg-white/[0.94]" : "border-white/[0.10] bg-[#101b2b]") }>
                В этом периоде пока нет данных.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
};

export const SoonPage = () => {
  const { snapshot, session, openDate, setMode, setPage } = useAppStore();
  const isPink = snapshot.settings.theme === "whitePink";
  const theme = snapshot.settings.theme;
  const currentUserId = session.currentUserId;
  const [detailMetric, setDetailMetric] = useState<MetricKey | null>(null);
  const [detailRangeStart, setDetailRangeStart] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [detailRangeEnd, setDetailRangeEnd] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const cardStyle = buildPhotoGlassStyle(
    snapshot.settings.backgroundImage,
    theme,
    isPink ? 0.92 : 0.88,
    isPink
      ? "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(247,240,248,0.96))"
      : "linear-gradient(180deg, rgba(8,15,29,0.76), rgba(8,15,29,0.94))"
  );

  const visibleWorkEntries = useMemo(() => {
    if (!currentUserId) return [];
    return snapshot.entries.filter((entry) => entry.mode === "work" && (entry.visibility === "shared" || entry.authorId === currentUserId));
  }, [currentUserId, snapshot.entries]);

  const presetsById = useMemo(() => new Map(snapshot.settings.workPresets.map((preset) => [preset.id, preset])), [snapshot.settings.workPresets]);

  const dailyStats = useMemo(() => {
    const map = new Map<string, DailyStats>();

    visibleWorkEntries.forEach((entry) => {
      const metric = getEntryMetrics(entry, presetsById);
      const existing = map.get(entry.date) ?? {
        date: entry.date,
        earnings: 0,
        hours: 0,
        shifts: 0,
        title: metric.title,
        icon: metric.icon,
        color: metric.color,
        entryCount: 0
      };

      const next: DailyStats = {
        ...existing,
        earnings: existing.earnings + metric.earnings,
        hours: existing.hours + metric.hours,
        shifts: existing.shifts + metric.shifts,
        entryCount: existing.entryCount + (metric.shifts > 0 || metric.hours > 0 || metric.earnings > 0 ? 1 : 0)
      };

      if (metric.earnings > existing.earnings || existing.entryCount === 0) {
        next.title = metric.title;
        next.icon = metric.icon;
        next.color = metric.color;
      }

      map.set(entry.date, next);
    });

    return Array.from(map.values()).sort((left, right) => left.date.localeCompare(right.date));
  }, [presetsById, visibleWorkEntries]);

  const dailyStatsByDate = useMemo(() => new Map(dailyStats.map((item) => [item.date, item])), [dailyStats]);

  const currentWeekDays = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, []);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const weekRows = currentWeekDays.map((day) => dailyStatsByDate.get(format(day, "yyyy-MM-dd")));
    const earningsValues = weekRows.map((row) => row?.earnings ?? 0);
    const hoursValues = weekRows.map((row) => row?.hours ?? 0);
    const shiftsValues = weekRows.map((row) => row?.shifts ?? 0);
    const labels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

    return [
      {
        key: "earnings",
        title: "Заработок",
        headline: money(earningsValues.reduce((sum, value) => sum + value, 0)),
        subtitle: "Всего за неделю",
        values: earningsValues,
        labels,
        icon: Coins,
        tone: toneByMetric.earnings,
        toneSoft: isPink ? "bg-[#f9f3ff] text-[#7b5db5]" : "bg-[#1d2340] text-[#c8c5ff]"
      },
      {
        key: "hours",
        title: "Рабочие часы",
        headline: hoursToLabel(hoursValues.reduce((sum, value) => sum + value, 0)),
        subtitle: "Всего за неделю",
        values: hoursValues,
        labels,
        icon: Clock3,
        tone: toneByMetric.hours,
        toneSoft: isPink ? "bg-[#fff2f4] text-[#c55b70]" : "bg-[#2a1f2a] text-[#ffb9c2]"
      },
      {
        key: "shifts",
        title: "Смены",
        headline: shiftLabel(shiftsValues.reduce((sum, value) => sum + value, 0)),
        subtitle: "Всего за неделю",
        values: shiftsValues,
        labels,
        icon: BriefcaseBusiness,
        tone: toneByMetric.shifts,
        toneSoft: isPink ? "bg-[#effee8] text-[#5a9d58]" : "bg-[#1e2c1d] text-[#b8efaf]"
      }
    ];
  }, [currentWeekDays, dailyStatsByDate, isPink]);

  const rangeStartDate = useMemo(() => new Date(`${detailRangeStart}T00:00:00`), [detailRangeStart]);
  const rangeEndDate = useMemo(() => new Date(`${detailRangeEnd}T00:00:00`), [detailRangeEnd]);

  const detailRows = useMemo(() => {
    if (!detailMetric) return [];
    return dailyStats
      .filter((row) => {
        const rowDate = new Date(`${row.date}T00:00:00`);
        if (isBefore(rowDate, rangeStartDate) || isAfter(rowDate, rangeEndDate)) return false;
        if (detailMetric === "earnings") return row.earnings > 0;
        if (detailMetric === "hours") return row.hours > 0;
        return row.shifts > 0;
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [dailyStats, detailMetric, rangeEndDate, rangeStartDate]);

  const detailBucket = useMemo(() => {
    if (!detailMetric) return { labels: [] as string[], values: [] as number[] };
    const days = eachDayOfInterval({ start: rangeStartDate, end: rangeEndDate });
    const buckets: number[] = [];
    const labels: string[] = [];

    days.forEach((day, index) => {
      const bucketIndex = Math.floor(index / 7);
      const row = dailyStatsByDate.get(format(day, "yyyy-MM-dd"));
      const value = detailMetric === "earnings" ? row?.earnings ?? 0 : detailMetric === "hours" ? row?.hours ?? 0 : row?.shifts ?? 0;
      buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + value;
      if (!labels[bucketIndex]) {
        labels[bucketIndex] = String(bucketIndex + 1);
      }
    });

    return { labels, values: buckets };
  }, [dailyStatsByDate, detailMetric, rangeEndDate, rangeStartDate]);

  const detailSummaryValue = useMemo(() => {
    if (!detailMetric) return 0;
    return detailRows.reduce((sum, row) => sum + (detailMetric === "earnings" ? row.earnings : detailMetric === "hours" ? row.hours : row.shifts), 0);
  }, [detailMetric, detailRows]);

  const openWorkDate = (date: string) => {
    setPage("calendar");
    setMode("work");
    openDate(date);
    setDetailMetric(null);
  };

  const openMetric = (metric: MetricKey) => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    setDetailMetric(metric);
    setDetailRangeStart(format(start, "yyyy-MM-dd"));
    setDetailRangeEnd(format(end, "yyyy-MM-dd"));
  };

  const handleStartChange = (next: string) => {
    if (!next) return;
    setDetailRangeStart(next);
    if (new Date(`${next}T00:00:00`) > rangeEndDate) {
      setDetailRangeEnd(next);
    }
  };

  const handleEndChange = (next: string) => {
    if (!next) return;
    setDetailRangeEnd(next);
    if (new Date(`${next}T00:00:00`) < rangeStartDate) {
      setDetailRangeStart(next);
    }
  };

  if (visibleWorkEntries.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("mx-auto max-w-[820px] rounded-[26px] border p-6 text-center", isPink ? "border-white/[0.88] bg-white/[0.92] text-[#6c4d5e]" : "border-white/[0.10] bg-[#09111f]/[0.92] text-slate-300")}
        style={cardStyle}
      >
        <div className="text-lg font-semibold">Пока нет данных</div>
      </motion.section>
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[820px] flex-col gap-3 overflow-visible">
        {summaryCards.map((card, index) => (
          <motion.button
            key={card.key}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => openMetric(card.key)}
            className={cn(
              "w-full rounded-[22px] border p-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.12)]",
              isPink ? "border-white/[0.90] bg-white/[0.95] text-[#3c2537]" : "border-white/[0.10] bg-[#101b2b]/[0.98] text-white"
            )}
            style={cardStyle}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[22px] font-semibold leading-none sm:text-[30px]">{card.headline}</div>
                <div className="mt-1 text-sm text-white/62">{card.subtitle}</div>
              </div>
              <div className={cn("rounded-full px-3 py-2 text-sm font-semibold", card.toneSoft)}>
                <span className="inline-flex items-center gap-2">
                  <card.icon className="size-4" />
                  {card.title}
                </span>
              </div>
            </div>
            <MetricChart values={card.values} labels={card.labels} tone={card.tone} kind={chartKind} />
          </motion.button>
        ))}
      </div>

      {detailMetric ? (
        <MetricDetailSheet
          metric={detailMetric}
          isPink={isPink}
          chartKind={chartKind}
          onChartKindChange={setChartKind}
          rangeStart={detailRangeStart}
          rangeEnd={detailRangeEnd}
          onRangeStartChange={handleStartChange}
          onRangeEndChange={handleEndChange}
          summaryValue={detailSummaryValue}
          bucketValues={detailBucket.values}
          bucketLabels={detailBucket.labels}
          dayRows={detailRows}
          onClose={() => setDetailMetric(null)}
          onOpenDate={openWorkDate}
        />
      ) : null}
    </>
  );
};

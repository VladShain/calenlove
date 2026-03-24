import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ru } from "date-fns/locale";

export const formatDateLabel = (value: string, pattern = "d MMMM yyyy") =>
  format(new Date(value), pattern, { locale: ru });

export const formatMonthLabel = (value: Date) => format(value, "LLLL yyyy", { locale: ru });

export const buildCalendarDays = (current: Date) => {
  const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });

  return eachDayOfInterval({ start, end }).map((day) => ({
    date: day,
    key: format(day, "yyyy-MM-dd"),
    isCurrentMonth: isSameMonth(day, current),
    dayNumber: format(day, "d")
  }));
};

export const monthShift = (current: Date, amount: number) => addMonths(current, amount);

export const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const sameDay = (left: string, right: string) =>
  isSameDay(new Date(left), new Date(right));

export const daysBetween = (from: string, to = new Date().toISOString().slice(0, 10)) => {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
};

export const todayKey = () => format(new Date(), "yyyy-MM-dd");

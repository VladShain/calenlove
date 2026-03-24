import { ensureTamagotchis } from "@/lib/tamagotchi";
import type { AppSnapshot, MoodBottle, UserId, WorkPreset } from "@/types";

export const STORAGE_KEY = "lovers-calendar-app-0-2";
export const REMEMBERED_USER_KEY = "lovers-calendar-remembered-user";
export const NOTIFIED_KEY = "lovers-calendar-notified-ids";
export const CLOUD_SNAPSHOT_ID = "main";
export const APP_VERSION = "0.8.2";

export const DEFAULT_USER_ORDER: UserId[] = ["vlad", "liya"];

export const DEFAULT_MOOD_BOTTLES: Record<UserId, MoodBottle> = {
  vlad: {
    label: "Какаю",
    emoji: "😡",
    tone: "mint",
    level: 74
  },
  liya: {
    label: "Мурчу",
    emoji: "💗",
    tone: "rose",
    level: 68
  }
};

export const createDefaultWorkPresets = (now = new Date().toISOString()): WorkPreset[] => [
  {
    id: "preset-day-shift",
    title: "Дневная смена",
    allDay: false,
    startTime: "08:00",
    endTime: "22:30",
    hourlyRate: 250,
    paidHours: "8ч",
    bonus: 0,
    expenses: 0,
    color: "#f8e49b",
    icon: "💼",
    note: "Основная длинная смена",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-bar",
    title: "бар",
    allDay: false,
    startTime: "08:30",
    endTime: "22:30",
    hourlyRate: 250,
    paidHours: "8ч",
    bonus: 0,
    expenses: 0,
    color: "#cfe6ff",
    icon: "🍸",
    note: "Барная смена",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-admin",
    title: "зав.пр",
    allDay: false,
    startTime: "08:00",
    endTime: "23:00",
    hourlyRate: 270,
    paidHours: "8ч",
    bonus: 0,
    expenses: 0,
    color: "#f5c9ec",
    icon: "📌",
    note: "Ответственная смена",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-8h",
    title: "8 ч смена",
    allDay: false,
    startTime: "08:00",
    endTime: "16:00",
    hourlyRate: 250,
    paidHours: "8ч",
    bonus: 0,
    expenses: 0,
    color: "#cfd5ff",
    icon: "⏰",
    note: "Стандартная короткая смена",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-dayoff",
    title: "Выходной",
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
    hourlyRate: 0,
    paidHours: "Весь день",
    bonus: 0,
    expenses: 0,
    color: "#ffd7ae",
    icon: "🍕",
    note: "Без оплаты",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-sick",
    title: "Больничный",
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
    hourlyRate: 0,
    paidHours: "Весь день",
    bonus: 0,
    expenses: 0,
    color: "#f6c3d1",
    icon: "💊",
    note: "Спокойный день без нагрузки",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-vacation",
    title: "отпуск",
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
    hourlyRate: 0,
    paidHours: "Весь день",
    bonus: 0,
    expenses: 0,
    color: "#efe2a3",
    icon: "🎵",
    note: "Отдых без оплаты",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "preset-sport",
    title: "Спорт",
    allDay: false,
    startTime: "18:00",
    endTime: "19:00",
    hourlyRate: 0,
    paidHours: "1ч",
    bonus: 0,
    expenses: 0,
    color: "#d4defc",
    icon: "🏀",
    note: "Личное время",
    createdAt: now,
    updatedAt: now
  }
];

const createSystemNotification = (now: string) => ({
  id: "notify-069",
  createdAt: now,
  authorId: "vlad" as const,
  targetUserId: "liya" as const,
  message: "Патч 0.8.2 готов. Добавлен GitHub cloud iOS маршрут: push в репозиторий, автосборка на macOS runner и готовый Simulator zip для Appetize.",
  read: false,
  type: "system" as const,
  category: "other" as const
});

export const applyAppMigrations = (snapshot: AppSnapshot): AppSnapshot => {
  const now = snapshot.updatedAt || new Date().toISOString();
  let changed = false;

  const moodBottles: Record<UserId, MoodBottle> = {
    vlad: {
      ...DEFAULT_MOOD_BOTTLES.vlad,
      ...(snapshot.settings.moodBottles?.vlad ?? {}),
      level: snapshot.settings.moodBottles?.vlad?.level ?? DEFAULT_MOOD_BOTTLES.vlad.level
    },
    liya: {
      ...DEFAULT_MOOD_BOTTLES.liya,
      ...(snapshot.settings.moodBottles?.liya ?? {}),
      level: snapshot.settings.moodBottles?.liya?.level ?? DEFAULT_MOOD_BOTTLES.liya.level
    }
  };

  if (
    snapshot.settings.moodBottles?.vlad?.level == null ||
    snapshot.settings.moodBottles?.liya?.level == null
  ) {
    changed = true;
  }

  const normalizedEntries = snapshot.entries
    .filter((entry) => !entry.id.startsWith("seed-031-work-"))
    .map((entry) => ({
      ...entry,
      viewedBy: entry.viewedBy ?? [],
      workMeta: entry.workMeta
        ? {
            presetId: entry.workMeta.presetId,
            color: entry.workMeta.color,
            icon: entry.workMeta.icon,
            scheduleLabel: entry.workMeta.scheduleLabel,
            rateLabel: entry.workMeta.rateLabel,
            note: entry.workMeta.note
          }
        : undefined
    }));

  if (
    normalizedEntries.length !== snapshot.entries.length ||
    snapshot.entries.some((entry) => entry.viewedBy == null)
  ) {
    changed = true;
  }

  const normalizedNotifications = snapshot.notifications.map((item) => ({
    ...item,
    category: item.category ?? (item.type === "story" ? "story" : item.type === "mood" ? "mood" : item.type === "plan" ? "entry" : "other")
  }));

  const hasNotification = normalizedNotifications.some((item) => item.id === "notify-069");
  const notifications = hasNotification
    ? normalizedNotifications
    : [createSystemNotification(now), ...normalizedNotifications];

  if (!hasNotification || normalizedNotifications.some((item) => item.category == null)) {
    changed = true;
  }

  const workPresets = Array.isArray(snapshot.settings.workPresets) && snapshot.settings.workPresets.length > 0
    ? snapshot.settings.workPresets.map((preset) => ({
        ...preset,
        id: preset.id || `preset-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: preset.createdAt || now,
        updatedAt: preset.updatedAt || now,
        icon: preset.icon || "💼",
        color: preset.color || "#cfe6ff",
        paidHours: preset.paidHours || "8ч",
        note: preset.note || ""
      }))
    : createDefaultWorkPresets(now);

  if (!Array.isArray(snapshot.settings.workPresets) || snapshot.settings.workPresets.length === 0) {
    changed = true;
  }

  const tamagotchis = ensureTamagotchis(snapshot.settings.tamagotchis, now);

  return {
    ...snapshot,
    version: APP_VERSION,
    entries: normalizedEntries,
    notifications,
    settings: {
      ...snapshot.settings,
      notificationsEnabled: snapshot.settings.notificationsEnabled ?? true,
      pendingCloudSync: snapshot.settings.pendingCloudSync ?? false,
      themeChosen: snapshot.settings.themeChosen ?? false,
      optimizationLiteMode: snapshot.settings.optimizationLiteMode ?? false,
      optimizationGlass: snapshot.settings.optimizationGlass ?? true,
      optimizationAnimations: snapshot.settings.optimizationAnimations ?? true,
      optimizationDecor: snapshot.settings.optimizationDecor ?? true,
      backgroundDecorBlur: snapshot.settings.backgroundDecorBlur ?? 8,
      moodBottles,
      workPresets,
      tamagotchis
    },
    updatedAt: changed ? new Date().toISOString() : snapshot.updatedAt
  };
};

export const createDefaultSnapshot = (): AppSnapshot => {
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const base: AppSnapshot = {
    version: APP_VERSION,
    users: {
      vlad: {
        id: "vlad",
        nickname: "Vlad",
        login: "Vlad",
        password: "12345678"
      },
      liya: {
        id: "liya",
        nickname: "Liya",
        login: "Liya",
        password: "12345678"
      }
    },
    entries: [
      {
        id: "welcome-love",
        date: today,
        mode: "love",
        title: "Первый день 0.8.2 💖",
        text: "В 0.8.2 появился GitHub cloud iOS маршрут: теперь можно собрать iOS build без Mac и потом смотреть его через Appetize.",
        previewText: "Наш день",
        visibility: "shared",
        authorId: "vlad",
        createdAt: now,
        updatedAt: now,
        viewedBy: []
      },
      {
        id: "welcome-work",
        date: today,
        mode: "work",
        title: "Дневная смена",
        text: "Нажми на ячейку рабочего календаря: теперь там отдельный экран дня, готовые пресеты и создание своих шаблонов.",
        previewText: "Дневная",
        visibility: "shared",
        authorId: "liya",
        createdAt: now,
        updatedAt: now,
        viewedBy: [],
        workMeta: {
          presetId: "preset-day-shift",
          color: "#f8e49b",
          icon: "💼",
          scheduleLabel: "08:00 • 22:30",
          rateLabel: "250 ₽/ч",
          note: "Основная длинная смена"
        }
      }
    ],
    notifications: [
      {
        id: "notify-start",
        createdAt: now,
        authorId: "vlad",
        targetUserId: "liya",
        message: "Патч 0.8.2 готов. Добавлен iOS cloud build через GitHub Actions и новый маршрут пуша из Windows в репозиторий.",
        read: false,
        type: "system",
        category: "other"
      }
    ],
    loginHistory: [],
    settings: {
      theme: "luxuryBlue",
      relationStartDate: today,
      pinEnabled: false,
      pinCode: "0000",
      privacyMode: "romantic",
      developerCloudStatus: "local",
      notificationsEnabled: true,
      pendingCloudSync: false,
      moodBottles: DEFAULT_MOOD_BOTTLES,
      themeChosen: false,
      optimizationLiteMode: false,
      optimizationGlass: true,
      optimizationAnimations: true,
      optimizationDecor: true,
      backgroundDecorBlur: 8,
      workPresets: createDefaultWorkPresets(now),
      tamagotchis: ensureTamagotchis(undefined, now)
    },
    updatedAt: now
  };

  return applyAppMigrations(base);
};

import { create } from "zustand";
import { APP_VERSION, applyAppMigrations, createDefaultSnapshot, createDefaultWorkPresets, DEFAULT_MOOD_BOTTLES, REMEMBERED_USER_KEY } from "@/data/defaultState";
import { ensureTamagotchis } from "@/lib/tamagotchi";
import { authenticate, updateUserAccount } from "@/services/auth";
import {
  fetchCloudSnapshot,
  isCloudConfigured,
  saveCloudSnapshot,
  uploadImageToCloudIfPossible
} from "@/services/api";
import {
  clearBrowserCacheStorage,
  loadLocalSnapshot,
  saveLocalSnapshot
} from "@/services/storage";
import type {
  AppSnapshot,
  CalendarEntry,
  CalendarMode,
  DeveloperState,
  MoodBottle,
  NotificationItem,
  PageKey,
  SessionState,
  ThemeMode,
  UserId,
  WorkEntryMeta
} from "@/types";

interface AddEntryPayload {
  date: string;
  mode: CalendarMode;
  title: string;
  text: string;
  previewText: string;
  visibility: "shared" | "private";
  imageUrl?: string;
  imageName?: string;
  workMeta?: WorkEntryMeta;
}

interface AppStore {
  snapshot: AppSnapshot;
  session: SessionState;
  developer: DeveloperState;
  monthCursor: string;
  bootstrap: () => Promise<void>;
  login: (login: string, password: string, pin?: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  setPage: (page: PageKey) => void;
  setMode: (mode: CalendarMode) => void;
  openDate: (date: string) => void;
  closeDate: () => void;
  moveMonth: (direction: -1 | 1) => void;
  addEntry: (payload: AddEntryPayload) => Promise<void>;
  updateEntry: (entryId: string, payload: AddEntryPayload) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateMoodBottle: (userId: UserId, bottle: MoodBottle) => Promise<void>;
  updateTheme: (theme: ThemeMode) => Promise<void>;
  updateBackground: (backgroundImage?: string, backgroundImageName?: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSnapshot["settings"]>) => Promise<void>;
  updateCurrentUser: (patch: Partial<AppSnapshot["users"][UserId]>) => Promise<void>;
  uploadAttachment: (fileName: string, dataUrl: string) => Promise<string>;
  exportSnapshot: () => AppSnapshot;
  importSnapshot: (snapshot: AppSnapshot) => Promise<void>;
  syncPending: () => Promise<boolean>;
  clearCache: () => Promise<void>;
  markOpenedDateViewed: () => Promise<void>;
}

const createSession = (): SessionState => ({
  currentUserId: null,
  page: "calendar",
  mode: "love",
  openedDate: null,
  isBootstrapped: false
});

const createDeveloperState = (): DeveloperState => ({
  isCloudConfigured,
  isSyncing: false,
  lastCloudMessage: isCloudConfigured ? "Облако подключено." : "Локальный режим без облака."
});

const normalizeSnapshot = (snapshot: AppSnapshot): AppSnapshot => {
  const migrated = applyAppMigrations(snapshot);

  return {
    ...migrated,
    version: APP_VERSION,
    entries: migrated.entries.map((entry) => ({ ...entry, viewedBy: entry.viewedBy ?? [] })),
    settings: {
      ...migrated.settings,
      notificationsEnabled: migrated.settings.notificationsEnabled ?? true,
      pendingCloudSync: migrated.settings.pendingCloudSync ?? false,
      themeChosen: migrated.settings.themeChosen ?? false,
      optimizationLiteMode: migrated.settings.optimizationLiteMode ?? false,
      optimizationGlass: migrated.settings.optimizationGlass ?? true,
      optimizationAnimations: migrated.settings.optimizationAnimations ?? true,
      optimizationDecor: migrated.settings.optimizationDecor ?? true,
      backgroundDecorBlur: migrated.settings.backgroundDecorBlur ?? 8,
      workPresets: migrated.settings.workPresets?.length ? migrated.settings.workPresets : createDefaultWorkPresets(migrated.updatedAt),
      tamagotchis: ensureTamagotchis(migrated.settings.tamagotchis, migrated.updatedAt),
      moodBottles: {
        ...DEFAULT_MOOD_BOTTLES,
        ...migrated.settings.moodBottles,
        vlad: {
          ...DEFAULT_MOOD_BOTTLES.vlad,
          ...migrated.settings.moodBottles.vlad,
          level: migrated.settings.moodBottles.vlad?.level ?? DEFAULT_MOOD_BOTTLES.vlad.level
        },
        liya: {
          ...DEFAULT_MOOD_BOTTLES.liya,
          ...migrated.settings.moodBottles.liya,
          level: migrated.settings.moodBottles.liya?.level ?? DEFAULT_MOOD_BOTTLES.liya.level
        }
      }
    }
  };
};

const hasNetwork = () => typeof navigator === "undefined" || navigator.onLine !== false;

const syncSnapshotState = async (snapshot: AppSnapshot, developer: DeveloperState) => {
  const normalized = normalizeSnapshot(snapshot);

  if (!developer.isCloudConfigured) {
    const localSnapshot: AppSnapshot = {
      ...normalized,
      settings: {
        ...normalized.settings,
        pendingCloudSync: false,
        developerCloudStatus: "local"
      }
    };

    saveLocalSnapshot(localSnapshot);

    return {
      snapshot: localSnapshot,
      developer: {
        ...developer,
        isSyncing: false,
        lastCloudError: undefined,
        lastCloudMessage: "Локальный режим без облака"
      }
    };
  }

  if (!hasNetwork()) {
    const offlineSnapshot: AppSnapshot = {
      ...normalized,
      settings: {
        ...normalized.settings,
        pendingCloudSync: true,
        developerCloudStatus: "cloud-pending"
      }
    };

    saveLocalSnapshot(offlineSnapshot);

    return {
      snapshot: offlineSnapshot,
      developer: {
        ...developer,
        isSyncing: false,
        lastCloudMessage: "Нет сети. Изменения сохранены локально и будут отправлены позже.",
        lastCloudError: undefined
      }
    };
  }

  const result = await saveCloudSnapshot(normalized);
  const hasError = Boolean(result.lastCloudError);

  const finalSnapshot: AppSnapshot = {
    ...normalized,
    settings: {
      ...normalized.settings,
      pendingCloudSync: hasError,
      lastCloudSyncAt: hasError ? normalized.settings.lastCloudSyncAt : new Date().toISOString(),
      developerCloudStatus: hasError ? "cloud-error" : "cloud-online"
    }
  };

  saveLocalSnapshot(finalSnapshot);

  return {
    snapshot: finalSnapshot,
    developer: {
      ...developer,
      ...result,
      isSyncing: false,
      lastCloudMessage: hasError
        ? "Не удалось записать в облако. Данные оставлены локально до повторной попытки."
        : "Облако синхронизировано"
    }
  };
};

export const useAppStore = create<AppStore>((set, get) => ({
  snapshot: createDefaultSnapshot(),
  session: createSession(),
  developer: createDeveloperState(),
  monthCursor: new Date().toISOString(),

  bootstrap: async () => {
    const localSnapshot = normalizeSnapshot(loadLocalSnapshot());
    let snapshot = localSnapshot;
    const developer = createDeveloperState();

    if (isCloudConfigured && hasNetwork() && !localSnapshot.settings.pendingCloudSync) {
      const cloudSnapshot = await fetchCloudSnapshot();
      if (cloudSnapshot?.updatedAt && cloudSnapshot.updatedAt > localSnapshot.updatedAt) {
        snapshot = normalizeSnapshot(cloudSnapshot);
      }
    }

    saveLocalSnapshot(snapshot);

    let rememberedUserId: UserId | null = null;
    try {
      const remembered = window.localStorage.getItem(REMEMBERED_USER_KEY);
      if (remembered === "vlad" || remembered === "liya") {
        rememberedUserId = remembered;
      }
    } catch {
      rememberedUserId = null;
    }

    set({
      snapshot,
      developer: {
        ...developer,
        lastCloudMessage: snapshot.settings.pendingCloudSync
          ? "Найдены локальные изменения. Жду сеть и облако для дозаписи."
          : developer.lastCloudMessage
      },
      session: {
        ...createSession(),
        currentUserId: rememberedUserId,
        isBootstrapped: true
      },
      monthCursor: snapshot.updatedAt
    });

    if (snapshot.settings.pendingCloudSync && isCloudConfigured && hasNetwork()) {
      await get().syncPending();
    }
  },

  login: async (login, password, pin) => {
    const snapshot = get().snapshot;
    const result = authenticate(snapshot, login, password, pin);

    if (!result.success || !result.userId) {
      return {
        ok: false,
        message: result.message
      };
    }

    const now = new Date().toISOString();
    const currentUserId = result.userId;

    const nextSnapshot: AppSnapshot = {
      ...snapshot,
      loginHistory: [
        {
          id: crypto.randomUUID(),
          userId: currentUserId,
          loginAt: now,
          platform: /Android/i.test(navigator.userAgent)
            ? "Android"
            : /Windows/i.test(navigator.userAgent)
              ? "Windows"
              : "Web"
        },
        ...snapshot.loginHistory
      ].slice(0, 120),
      updatedAt: now
    };

    const syncResult = await syncSnapshotState(nextSnapshot, get().developer);

    try {
      window.localStorage.setItem(REMEMBERED_USER_KEY, currentUserId);
    } catch {
      // ignore remembered-user write issues
    }

    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer,
      session: {
        ...get().session,
        currentUserId,
        page: "calendar"
      }
    });

    return {
      ok: true,
      message: result.message
    };
  },

  logout: () => {
    try {
      window.localStorage.removeItem(REMEMBERED_USER_KEY);
    } catch {
      // ignore
    }
    set({
      session: {
        ...get().session,
        currentUserId: null,
        page: "calendar",
        openedDate: null
      }
    });
  },

  setPage: (page) => set((state) => ({ session: { ...state.session, page } })),

  setMode: (mode) => set((state) => ({ session: { ...state.session, mode } })),

  openDate: (date) => set((state) => ({ session: { ...state.session, openedDate: date } })),

  closeDate: () => set((state) => ({ session: { ...state.session, openedDate: null } })),

  moveMonth: (direction) => {
    const cursor = new Date(get().monthCursor);
    cursor.setMonth(cursor.getMonth() + direction);
    set({ monthCursor: cursor.toISOString() });
  },

  updateEntry: async (entryId, payload) => {
    const state = get();
    const authorId = state.session.currentUserId;

    if (!authorId) {
      return;
    }

    const existingEntry = state.snapshot.entries.find((entry) => entry.id === entryId);
    if (!existingEntry || existingEntry.authorId !== authorId) {
      return;
    }

    const now = new Date().toISOString();
    const nextSnapshot: AppSnapshot = {
      ...state.snapshot,
      entries: state.snapshot.entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...payload,
              authorId,
              updatedAt: now
            }
          : entry
      ),
      updatedAt: now
    };

    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);

    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer,
      session: {
        ...state.session,
        openedDate: payload.date
      }
    });
  },

  addEntry: async (payload) => {
    const state = get();
    const authorId = state.session.currentUserId;

    if (!authorId) {
      return;
    }

    const now = new Date().toISOString();

    const nextEntry: CalendarEntry = {
      id: crypto.randomUUID(),
      authorId,
      createdAt: now,
      updatedAt: now,
      ...payload
    };

    const isStory = Boolean(payload.imageUrl);
    const notificationMessage = isStory
      ? `${state.snapshot.users[authorId].nickname} выложил(а) историю за ${payload.date}`
      : payload.visibility === "shared"
        ? `${state.snapshot.users[authorId].nickname} добавил(а) запись на ${payload.date}`
        : `${state.snapshot.users[authorId].nickname} добавил(а) личную запись на ${payload.date}`;

    const nextNotification: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: now,
      authorId,
      targetUserId: authorId === "vlad" ? "liya" : "vlad",
      message: notificationMessage,
      read: false,
      type: isStory ? "story" : "plan",
      category: isStory ? "story" : "entry",
      date: payload.date,
      mode: payload.mode,
      entryId: nextEntry.id
    };

    const nextSnapshot: AppSnapshot = {
      ...state.snapshot,
      entries: [nextEntry, ...state.snapshot.entries],
      notifications: [nextNotification, ...state.snapshot.notifications],
      updatedAt: now
    };

    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);

    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer,
      session: {
        ...state.session,
        openedDate: payload.date
      }
    });
  },

  deleteEntry: async (entryId) => {
    const state = get();
    const nextSnapshot = {
      ...state.snapshot,
      entries: state.snapshot.entries.filter((entry) => entry.id !== entryId),
      updatedAt: new Date().toISOString()
    };
    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  markNotificationsRead: async () => {
    const state = get();
    const nextSnapshot = {
      ...state.snapshot,
      notifications: state.snapshot.notifications.map((item) => ({ ...item, read: true })),
      updatedAt: new Date().toISOString()
    };
    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  markNotificationRead: async (notificationId) => {
    const state = get();
    const hasUnreadTarget = state.snapshot.notifications.some((item) => item.id === notificationId && !item.read);

    if (!hasUnreadTarget) {
      return;
    }

    const nextSnapshot = {
      ...state.snapshot,
      notifications: state.snapshot.notifications.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      updatedAt: new Date().toISOString()
    };
    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  updateMoodBottle: async (userId, bottle) => {
    const state = get();
    const previousBottle = state.snapshot.settings.moodBottles[userId];
    const nextBottle: MoodBottle = {
      label: bottle.label.trim() || "Без слов",
      emoji: bottle.emoji.trim() || "💗",
      tone: bottle.tone,
      level: bottle.level
    };

    if (
      previousBottle.label === nextBottle.label &&
      previousBottle.emoji === nextBottle.emoji &&
      previousBottle.tone === nextBottle.tone &&
      previousBottle.level === nextBottle.level
    ) {
      return;
    }

    const authorId = state.session.currentUserId ?? userId;
    const now = new Date().toISOString();
    const nextNotification: NotificationItem = {
      id: crypto.randomUUID(),
      createdAt: now,
      authorId,
      targetUserId: userId === "vlad" ? "liya" : "vlad",
      message: `${state.snapshot.users[userId].nickname} изменил(а) настроение`,
      read: false,
      type: "mood",
      category: "mood",
      moodBefore: previousBottle,
      moodAfter: nextBottle
    };

    const nextSnapshot = {
      ...state.snapshot,
      settings: {
        ...state.snapshot.settings,
        moodBottles: {
          ...state.snapshot.settings.moodBottles,
          [userId]: nextBottle
        }
      },
      notifications: [nextNotification, ...state.snapshot.notifications],
      updatedAt: now
    };

    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  updateTheme: async (theme) => {
    await get().updateSettings({ theme });
  },

  updateBackground: async (backgroundImage, backgroundImageName) => {
    await get().updateSettings({ backgroundImage, backgroundImageName });
  },

  updateSettings: async (patch) => {
    const state = get();
    const nextSnapshot = {
      ...state.snapshot,
      settings: {
        ...state.snapshot.settings,
        ...patch
      },
      updatedAt: new Date().toISOString()
    };
    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  updateCurrentUser: async (patch) => {
    const state = get();
    const currentUserId = state.session.currentUserId;

    if (!currentUserId) {
      return;
    }

    const nextSnapshot = {
      ...state.snapshot,
      users: updateUserAccount(state.snapshot.users, currentUserId, patch),
      updatedAt: new Date().toISOString()
    };

    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);

    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  uploadAttachment: async (fileName, dataUrl) => {
    if (!isCloudConfigured || !hasNetwork()) {
      return dataUrl;
    }

    return uploadImageToCloudIfPossible(fileName, dataUrl);
  },

  exportSnapshot: () => get().snapshot,

  importSnapshot: async (snapshot) => {
    const state = get();
    const syncResult = await syncSnapshotState(
      {
        ...snapshot,
        version: APP_VERSION,
        updatedAt: new Date().toISOString()
      },
      state.developer
    );
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

  syncPending: async () => {
    const state = get();

    if (!state.developer.isCloudConfigured || !hasNetwork()) {
      return false;
    }

    set({
      developer: {
        ...state.developer,
        isSyncing: true,
        lastCloudMessage: "Пробую отправить локальные изменения в облако..."
      }
    });

    const syncResult = await syncSnapshotState(
      {
        ...state.snapshot,
        updatedAt: new Date().toISOString()
      },
      {
        ...state.developer,
        isSyncing: true
      }
    );

    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });

    return !syncResult.snapshot.settings.pendingCloudSync;
  },

  clearCache: async () => {
    await clearBrowserCacheStorage();

    set((state) => ({
      developer: {
        ...state.developer,
        lastCloudMessage: "Временный кэш очищен. Основные записи не удалены."
      }
    }));
  },

  markOpenedDateViewed: async () => {
    const state = get();
    const currentUserId = state.session.currentUserId;
    const openedDate = state.session.openedDate;

    if (!currentUserId || !openedDate) {
      return;
    }

    const relevantEntries = state.snapshot.entries.filter((entry) => entry.date === openedDate && entry.mode === state.session.mode);

    if (relevantEntries.length === 0) {
      return;
    }

    let changed = false;
    const nextEntries = state.snapshot.entries.map((entry) => {
      if (entry.date !== openedDate || entry.mode !== state.session.mode) {
        return entry;
      }

      const viewedBy = entry.viewedBy ?? [];
      if (viewedBy.includes(currentUserId)) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        viewedBy: [...viewedBy, currentUserId],
        updatedAt: entry.updatedAt
      };
    });

    if (!changed) {
      return;
    }

    const nextSnapshot = {
      ...state.snapshot,
      entries: nextEntries,
      updatedAt: new Date().toISOString()
    };

    const syncResult = await syncSnapshotState(nextSnapshot, state.developer);
    set({
      snapshot: syncResult.snapshot,
      developer: syncResult.developer
    });
  },

}));

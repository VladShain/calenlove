import { applyAppMigrations, createDefaultSnapshot, STORAGE_KEY } from "@/data/defaultState";
import type { AppSnapshot } from "@/types";

const normalizeSnapshot = (snapshot: AppSnapshot): AppSnapshot => applyAppMigrations(snapshot);

export const loadLocalSnapshot = (): AppSnapshot => {
  const raw =
    window.localStorage.getItem(STORAGE_KEY) ||
    window.localStorage.getItem("lovers-calendar-app-0-1");

  if (!raw) {
    const fresh = createDefaultSnapshot();
    saveLocalSnapshot(fresh);
    return fresh;
  }

  try {
    return normalizeSnapshot(JSON.parse(raw) as AppSnapshot);
  } catch {
    const fresh = createDefaultSnapshot();
    saveLocalSnapshot(fresh);
    return fresh;
  }
};

export const saveLocalSnapshot = (snapshot: AppSnapshot) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};

export const clearLocalSnapshot = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};

export const clearBrowserCacheStorage = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignore cache cleanup issues
  }

  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }
};

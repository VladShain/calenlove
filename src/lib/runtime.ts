export interface RuntimeInfo {
  userAgent: string;
  platform: "ios" | "android" | "desktop" | "unknown";
  platformLabel: string;
  runtimeLabel: string;
  storageLabel: string;
  isOnline: boolean;
  isTauri: boolean;
  isStandalone: boolean;
  isAppleMobile: boolean;
}

const canUseWindow = typeof window !== "undefined";
const canUseNavigator = typeof navigator !== "undefined";

export const getRuntimeInfo = (): RuntimeInfo => {
  const userAgent = canUseNavigator ? navigator.userAgent : "server";
  const touchMac = canUseNavigator && /Macintosh/.test(userAgent) && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ? ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1 : false;
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || touchMac;
  const isAndroid = /Android/i.test(userAgent);
  const windowRecord = canUseWindow ? (window as unknown as Record<string, unknown>) : {};
  const isTauri = Boolean(windowRecord.__TAURI_INTERNALS__ || windowRecord.__TAURI__);
  const isStandalone = canUseWindow && canUseNavigator
    ? (window.matchMedia?.('(display-mode: standalone)').matches ?? false) || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    : false;

  return {
    userAgent,
    platform: isIOS ? 'ios' : isAndroid ? 'android' : canUseNavigator ? 'desktop' : 'unknown',
    platformLabel: isIOS ? 'iPhone / iOS' : isAndroid ? 'Android' : canUseNavigator ? 'Desktop / Browser' : 'Unknown runtime',
    runtimeLabel: isTauri ? 'Tauri native shell' : isStandalone ? 'Standalone web app' : 'Browser / WebView',
    storageLabel: canUseWindow ? 'localStorage + browser cache' : 'runtime storage unavailable',
    isOnline: canUseNavigator ? navigator.onLine !== false : true,
    isTauri,
    isStandalone,
    isAppleMobile: isIOS
  };
};

export const applyRuntimeBodyClasses = () => {
  if (!canUseWindow || !canUseNavigator) return;
  const info = getRuntimeInfo();
  document.body.classList.toggle('runtime-ios', info.platform === 'ios');
  document.body.classList.toggle('runtime-android', info.platform === 'android');
  document.body.classList.toggle('runtime-tauri', info.isTauri);
  document.body.classList.toggle('runtime-standalone', info.isStandalone);
};

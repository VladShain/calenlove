import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Cloud,
  Download,
  Eye,
  Gauge,
  HardDrive,
  ImagePlus,
  KeyRound,
  RefreshCcw,
  Shield,
  Trash2,
  UserRoundCog
} from "lucide-react";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { downloadJsonFile, downloadTextFile } from "@/lib/file";
import { compressImageFile } from "@/lib/image";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { APP_VERSION } from "@/data/defaultState";
import { getRuntimeInfo } from "@/lib/runtime";
import { useAppStore } from "@/store/useAppStore";

type SettingsTab = "profile" | "theme" | "optimization" | "privacy" | "analytics" | "memory" | "export" | "developer";

export const SettingsPage = () => {
  const {
    snapshot,
    session,
    developer,
    updateTheme,
    updateCurrentUser,
    updateSettings,
    updateBackground,
    exportSnapshot,
    clearCache,
    syncPending
  } = useAppStore();

  const currentUser = session.currentUserId ? snapshot.users[session.currentUserId] : null;
  const isPink = snapshot.settings.theme === "whitePink";
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nickname: currentUser?.nickname ?? "",
    login: currentUser?.login ?? "",
    password: currentUser?.password ?? ""
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"create" | "confirm">("create");
  const [pinStatus, setPinStatus] = useState("");

  useEffect(() => {
    setProfileForm({
      nickname: currentUser?.nickname ?? "",
      login: currentUser?.login ?? "",
      password: currentUser?.password ?? ""
    });
  }, [currentUser?.nickname, currentUser?.login, currentUser?.password]);

  useEffect(() => {
    setMobilePanelOpen(false);
  }, [session.page]);

  const tabs = useMemo(
    () => [
      { key: "profile" as const, label: "Профиль", icon: UserRoundCog, note: "Ник и вход" },
      { key: "theme" as const, label: "Внешний вид", icon: Eye, note: "Тема и фон" },
      { key: "optimization" as const, label: "Оптимизация", icon: Gauge, note: "Производительность" },
      { key: "privacy" as const, label: "Конфиденциальность", icon: Shield, note: "PIN и доступ" },
      { key: "analytics" as const, label: "Аналитика", icon: BarChart3, note: "Внутренняя статистика" },
      { key: "memory" as const, label: "Память", icon: HardDrive, note: "Кэш и очередь" },
      { key: "export" as const, label: "Экспорт", icon: Download, note: "Файлы и журналы" },
      ...(session.currentUserId === "vlad"
        ? [{ key: "developer" as const, label: "Разработчик", icon: KeyRound, note: "Синк и логи" }]
        : [])
    ],
    [session.currentUserId]
  );

  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];

  const handleBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file, 1800, 0.82);
    await updateBackground(compressed.dataUrl, compressed.originalName);
    event.target.value = "";
  };

  const openTab = (nextTab: SettingsTab) => {
    setTab(nextTab);
    setMobilePanelOpen(true);
  };


  const appendPinDigit = (digit: string) => {
    if (pinStep === "create") {
      setPinDraft((old) => {
        if (old.length >= 4) return old;
        return `${old}${digit}`;
      });
      return;
    }

    setPinConfirm((old) => {
      if (old.length >= 4) return old;
      return `${old}${digit}`;
    });
  };

  const removePinDigit = () => {
    if (pinStep === "create") {
      setPinDraft((old) => old.slice(0, -1));
      return;
    }
    setPinConfirm((old) => old.slice(0, -1));
  };

  const openPinModal = () => {
    setPinModalOpen(true);
    setPinDraft("");
    setPinConfirm("");
    setPinStep("create");
    setPinStatus("");
  };

  const submitPinStep = async () => {
    if (pinStep === "create") {
      if (pinDraft.length < 4) {
        setPinStatus("Введите 4 цифры");
        return;
      }
      setPinStep("confirm");
      setPinStatus("");
      return;
    }

    if (pinConfirm.length < 4) {
      setPinStatus("Подтверди PIN-код");
      return;
    }

    if (pinDraft !== pinConfirm) {
      setPinStatus("PIN-коды не совпали");
      setPinConfirm("");
      return;
    }

    await updateSettings({ pinEnabled: true, pinCode: pinDraft });
    setPinModalOpen(false);
    setPinDraft("");
    setPinConfirm("");
    setPinStep("create");
    setPinStatus("");
  };

  const cardStyle = buildPhotoGlassStyle(snapshot.settings.backgroundImage, snapshot.settings.theme, isPink ? 0.9 : 0.84);

  const runtimeInfo = getRuntimeInfo();
  const storageModeLabel = snapshot.settings.pendingCloudSync
    ? "localStorage + локальная очередь до сети"
    : runtimeInfo.storageLabel;
  const cloudModeLabel = developer.isCloudConfigured ? "Supabase / cloud route" : "Локальный режим без облака";

  const runtimeLogText = [
    `Календарь двоих ${APP_VERSION}`,
    `Платформа: ${runtimeInfo.platformLabel}`,
    `Рантайм: ${runtimeInfo.runtimeLabel}`,
    `Сеть сейчас: ${runtimeInfo.isOnline ? "онлайн" : "оффлайн"}`,
    `Хранилище: ${storageModeLabel}`,
    `Облачный маршрут: ${cloudModeLabel}`,
    `Тема: ${snapshot.settings.theme === "whitePink" ? "бело-розовая" : snapshot.settings.theme === "darkRed" ? "тёмно-красная" : snapshot.settings.theme === "blackout" ? "чёрная" : "тёмно-голубая"}`,
    `Состояние облака: ${snapshot.settings.developerCloudStatus}`,
    `Оптимизация: ${snapshot.settings.optimizationLiteMode ? "лёгкий режим" : [snapshot.settings.optimizationGlass ? "стекло" : "без стекла", snapshot.settings.optimizationAnimations ? "анимации" : "без анимаций", snapshot.settings.optimizationDecor ? "декор" : "без декора"].join(", ")}`,
    `Обновлено: ${snapshot.updatedAt}`,
    `User-Agent: ${runtimeInfo.userAgent}`,
    "",
    "История входов:",
    ...snapshot.loginHistory.map((item) => `${item.loginAt} | ${item.userId} | ${item.platform}`),
    "",
    "Уведомления:",
    ...snapshot.notifications.map((item) => `${item.createdAt} | ${item.type} | ${item.message}`)
  ].join("\n");

  const sectionClass = cn(
    "rounded-[30px] border p-4 backdrop-blur-2xl sm:p-5",
    isPink ? "border-white/[0.80] bg-white/[0.44] text-[#3c2537]" : "border-white/[0.10] bg-white/[0.05] text-white"
  );

  const fieldClass = cn(
    "w-full rounded-[22px] border px-4 py-3 backdrop-blur-xl",
    isPink ? "border-white/[0.80] bg-white/[0.58] text-[#3c2537]" : "border-white/[0.10] bg-white/[0.05] text-white"
  );

  const renderPanelContent = (currentTab: SettingsTab) => {
    if (currentTab === "profile") {
      return (
        <div className="space-y-3">
          <label className="block">
            <div className="mb-2 text-sm font-medium">Никнейм</div>
            <input className={fieldClass} value={profileForm.nickname} onChange={(event) => setProfileForm((old) => ({ ...old, nickname: event.target.value }))} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-medium">Логин</div>
              <input className={fieldClass} value={profileForm.login} onChange={(event) => setProfileForm((old) => ({ ...old, login: event.target.value }))} />
            </label>
            <label className="block">
              <div className="mb-2 text-sm font-medium">Пароль</div>
              <input className={fieldClass} value={profileForm.password} onChange={(event) => setProfileForm((old) => ({ ...old, password: event.target.value }))} />
            </label>
          </div>

          <button onClick={() => void updateCurrentUser(profileForm)} className={cn("w-full rounded-[24px] px-4 py-4 text-sm font-semibold", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}>
            Сохранить профиль
          </button>
        </div>
      );
    }

    if (currentTab === "theme") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => void updateTheme("luxuryBlue")}
              className={cn(
                "overflow-hidden rounded-[26px] border p-4 text-left backdrop-blur-xl",
                snapshot.settings.theme === "luxuryBlue" ? "border-sky-300 bg-gradient-to-br from-sky-300/[0.14] to-indigo-500/[0.18]" : "border-white/[0.10] bg-white/[0.05]"
              )}
            >
              <div className="rounded-[20px] bg-[linear-gradient(135deg,#07172b_0%,#0b223d_45%,#283a77_100%)] px-4 py-6 text-white">
                <div className="text-sm font-semibold">Тёмно-голубая</div>
                <div className="mt-2 text-xs leading-6 text-slate-200">Базовая тема: спокойный синий фон и глубокий контраст.</div>
              </div>
            </button>

            <button
              onClick={() => void updateTheme("whitePink")}
              className={cn(
                "overflow-hidden rounded-[26px] border p-4 text-left backdrop-blur-xl",
                snapshot.settings.theme === "whitePink" ? "border-white/[0.80] bg-white/[0.68] shadow-rose" : "border-white/[0.10] bg-white/[0.05]"
              )}
            >
              <div className="rounded-[20px] bg-[linear-gradient(135deg,#fff6fb_0%,#ffdff0_48%,#f1d9ff_100%)] px-4 py-6 text-[#5b3750]">
                <div className="text-sm font-semibold">Бело-розовая</div>
                <div className="mt-2 text-xs leading-6 opacity-80">Мягкий градиент, светлое стекло и более воздушный интерфейс.</div>
              </div>
            </button>

            <button
              onClick={() => void updateTheme("darkRed")}
              className={cn(
                "overflow-hidden rounded-[26px] border p-4 text-left backdrop-blur-xl",
                snapshot.settings.theme === "darkRed" ? "border-rose-400 bg-rose-500/[0.10]" : "border-white/[0.10] bg-white/[0.05]"
              )}
            >
              <div className="rounded-[20px] bg-[linear-gradient(135deg,#16050a_0%,#3d0d18_45%,#7a1c2b_100%)] px-4 py-6 text-white">
                <div className="text-sm font-semibold">Тёмно-красная</div>
                <div className="mt-2 text-xs leading-6 text-rose-100/86">Тёплый бордовый мрак с мягкими тёмными акцентами.</div>
              </div>
            </button>

            <button
              onClick={() => void updateTheme("blackout")}
              className={cn(
                "overflow-hidden rounded-[26px] border p-4 text-left backdrop-blur-xl",
                snapshot.settings.theme === "blackout" ? "border-white/[0.20] bg-white/[0.04]" : "border-white/[0.10] bg-white/[0.05]"
              )}
            >
              <div className="rounded-[20px] bg-[linear-gradient(135deg,#040405_0%,#0c0c0f_45%,#26262c_100%)] px-4 py-6 text-white">
                <div className="text-sm font-semibold">Чёрная</div>
                <div className="mt-2 text-xs leading-6 text-slate-200">Максимально тёмная строгая тема без лишней яркости.</div>
              </div>
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-[24px] border border-dashed px-4 py-4 text-sm backdrop-blur-xl", isPink ? "border-white/[0.80] bg-white/[0.60]" : "border-white/[0.15] bg-white/[0.05] text-slate-100")}>
              <ImagePlus className="size-4" />
              {snapshot.settings.backgroundImageName ? `Фон: ${snapshot.settings.backgroundImageName}` : "Поставить свой фон"}
              <input type="file" accept="image/*" className="hidden" onChange={handleBackground} />
            </label>
            <button onClick={() => void updateBackground(undefined, undefined)} className={cn("rounded-[24px] px-4 py-4 text-sm font-medium", isPink ? "bg-white/[0.64] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
              Удалить фон
            </button>
          </div>

        </div>
      );
    }

    if (currentTab === "optimization") {
      const liteMode = snapshot.settings.optimizationLiteMode;
      const selectProfile = async (profile: "max" | "balanced" | "lite") => {
        if (profile === "max") {
          await updateSettings({
            optimizationLiteMode: false,
            optimizationGlass: true,
            optimizationAnimations: true,
            optimizationDecor: true
          });
          return;
        }

        if (profile === "balanced") {
          await updateSettings({
            optimizationLiteMode: false,
            optimizationGlass: true,
            optimizationAnimations: true,
            optimizationDecor: false
          });
          return;
        }

        await updateSettings({
          optimizationLiteMode: true,
          optimizationGlass: false,
          optimizationAnimations: false,
          optimizationDecor: false
        });
      };

      const switchClass = (active: boolean) =>
        cn(
          "relative h-7 w-12 rounded-full border transition",
          active
            ? isPink
              ? "border-pink-300 bg-gradient-to-r from-pink-500 to-fuchsia-500"
              : "border-sky-300/70 bg-gradient-to-r from-sky-400 to-indigo-500"
            : isPink
              ? "border-white/[0.9] bg-white/[0.72]"
              : "border-white/[0.14] bg-white/[0.06]"
        );

      const knobClass = (active: boolean) =>
        cn(
          "absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition",
          active ? "right-1 bg-white" : isPink ? "left-1 bg-pink-200" : "left-1 bg-slate-200"
        );

      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "max", label: "Макс", active: !liteMode && snapshot.settings.optimizationGlass && snapshot.settings.optimizationAnimations && snapshot.settings.optimizationDecor },
              { key: "balanced", label: "Баланс", active: !liteMode && snapshot.settings.optimizationGlass && snapshot.settings.optimizationAnimations && !snapshot.settings.optimizationDecor },
              { key: "lite", label: "Лёгкий", active: liteMode }
            ].map((profile) => (
              <button
                key={profile.key}
                type="button"
                onClick={() => void selectProfile(profile.key as "max" | "balanced" | "lite")}
                className={cn(
                  "rounded-[22px] px-3 py-3 text-sm font-semibold backdrop-blur-xl transition active:scale-[0.98]",
                  profile.active
                    ? isPink
                      ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-rose"
                      : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
                    : isPink
                      ? "bg-white/[0.64] text-pink-700"
                      : "bg-white/[0.05] text-slate-100"
                )}
              >
                {profile.label}
              </button>
            ))}
          </div>

          <div className={cn("rounded-[24px] border p-2.5 backdrop-blur-xl", isPink ? "border-white/[0.80] bg-white/[0.58]" : "border-white/[0.10] bg-white/[0.05]")}>
            {[
              {
                label: "Стекло",
                value: !liteMode && snapshot.settings.optimizationGlass,
                action: () => updateSettings({ optimizationLiteMode: false, optimizationGlass: !snapshot.settings.optimizationGlass })
              },
              {
                label: "Анимации",
                value: !liteMode && snapshot.settings.optimizationAnimations,
                action: () => updateSettings({ optimizationLiteMode: false, optimizationAnimations: !snapshot.settings.optimizationAnimations })
              },
              {
                label: "Декор",
                value: !liteMode && snapshot.settings.optimizationDecor,
                action: () => updateSettings({ optimizationLiteMode: false, optimizationDecor: !snapshot.settings.optimizationDecor })
              }
            ].map((item, idx) => (
              <button
                key={item.label}
                type="button"
                onClick={() => void item.action()}
                className={cn(
                  "flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left",
                  idx !== 2 && "mb-1",
                  isPink ? "bg-white/[0.64] text-pink-900" : "bg-white/[0.04] text-slate-100"
                )}
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className={switchClass(item.value)}>
                  <span className={knobClass(item.value)} />
                </span>
              </button>
            ))}
          </div>

          <div className={cn("rounded-[24px] border px-4 py-4 backdrop-blur-xl", isPink ? "border-white/[0.80] bg-white/[0.56]" : "border-white/[0.10] bg-white/[0.05]")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Размытие фона</div>
              <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", isPink ? "bg-white text-pink-700" : "bg-white/[0.08] text-slate-100")}>{snapshot.settings.backgroundDecorBlur}</div>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              value={snapshot.settings.backgroundDecorBlur}
              onChange={(event) => void updateSettings({ backgroundDecorBlur: Number(event.target.value) })}
              className="w-full accent-pink-500"
            />
          </div>
        </div>
      );
    }

    if (currentTab === "privacy") {
      return (
        <div className="space-y-3">
          <div className={cn("rounded-[24px] border px-4 py-4 backdrop-blur-xl", isPink ? "border-white/[0.80] bg-white/[0.56]" : "border-white/[0.10] bg-white/[0.05]")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">PIN на вход</div>
                <div className={cn("mt-1 text-xs", isPink ? "text-pink-700/70" : "text-slate-300/70")}>Поставь код как на телефоне: ввод из цифр, потом подтверждение.</div>
              </div>
              <div className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", snapshot.settings.pinEnabled ? (isPink ? "bg-pink-500 text-white" : "bg-sky-400 text-slate-950") : (isPink ? "bg-white text-pink-700" : "bg-white/[0.08] text-slate-200"))}>{snapshot.settings.pinEnabled ? "включён" : "выключен"}</div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button onClick={openPinModal} className={cn("rounded-[22px] px-4 py-3 text-sm font-semibold", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}>{snapshot.settings.pinEnabled ? "Изменить PIN-код" : "Поставить PIN-код"}</button>
              <button onClick={() => void updateSettings({ pinEnabled: false })} className={cn("rounded-[22px] px-4 py-3 text-sm font-medium", isPink ? "bg-white/[0.76] text-pink-700" : "bg-white/[0.06] text-slate-100")} disabled={!snapshot.settings.pinEnabled}>Отключить PIN</button>
            </div>
          </div>

          <label className="block">
            <div className="mb-2 text-sm font-medium">Дата начала отношений / проекта</div>
            <input type="date" className={fieldClass} value={snapshot.settings.relationStartDate} onChange={(event) => void updateSettings({ relationStartDate: event.target.value })} />
          </label>

          <label className={cn("flex items-center justify-between gap-3 rounded-[24px] border px-4 py-4 backdrop-blur-xl", isPink ? "border-white/[0.80] bg-white/[0.56]" : "border-white/[0.10] bg-white/[0.05]")}>
            <div>
              <div className="text-sm font-semibold">Системные уведомления</div>
              <div className={cn("text-xs", isPink ? "text-pink-700/70" : "text-slate-300/70")}>Уведомления открываются без автопрочтения. Каждое отмечается отдельно.</div>
            </div>
            <input
              type="checkbox"
              checked={snapshot.settings.notificationsEnabled}
              onChange={async (event) => {
                const checked = event.target.checked;
                await updateSettings({ notificationsEnabled: checked });
                if (checked && "Notification" in window && Notification.permission === "default") {
                  void Notification.requestPermission();
                }
              }}
            />
          </label>
        </div>
      );
    }

    if (currentTab === "analytics") {
      return <AnalyticsPanel />;
    }

    if (currentTab === "memory") {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn("rounded-[24px] p-4 backdrop-blur-xl", isPink ? "bg-white/[0.56] text-pink-900" : "bg-white/[0.05] text-slate-200")}>
              <div className="text-sm font-semibold">Служебный кэш</div>
              <div className="mt-2 text-sm leading-6 opacity-80">Очищает временные кэши браузера и приложения. Основные записи, фото, логины и настройки не удаляются.</div>
            </div>
            <div className={cn("rounded-[24px] p-4 backdrop-blur-xl", isPink ? "bg-white/[0.56] text-pink-900" : "bg-white/[0.05] text-slate-200")}>
              <div className="text-sm font-semibold">Оффлайн очередь</div>
              <div className="mt-2 text-sm leading-6 opacity-80">{snapshot.settings.pendingCloudSync ? "Есть локальные изменения, которые ещё не дошли до хоста." : "Локальная очередь сейчас пустая."}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => void clearCache()} className={cn("rounded-[22px] px-4 py-3 text-sm font-medium", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}>
              <span className="inline-flex items-center gap-2"><Trash2 className="size-4" /> Очистить кэш</span>
            </button>
            {snapshot.settings.pendingCloudSync ? (
              <button onClick={() => void syncPending()} className={cn("rounded-[22px] px-4 py-3 text-sm font-medium", isPink ? "bg-white/[0.64] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
                <span className="inline-flex items-center gap-2"><RefreshCcw className="size-4" /> Повторить синхронизацию</span>
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    if (currentTab === "export") {
      return (
        <div className="grid gap-2">
          <button onClick={() => downloadJsonFile("kalendar-dvoih-export.json", exportSnapshot())} className={cn("rounded-[22px] px-4 py-3 text-left backdrop-blur-xl", isPink ? "bg-white/[0.60] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
            Экспортировать весь календарь в JSON
          </button>
          <button onClick={() => downloadTextFile("zhurnal-raboty-kalendarya.txt", runtimeLogText)} className={cn("rounded-[22px] px-4 py-3 text-left backdrop-blur-xl", isPink ? "bg-white/[0.60] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
            Скачать журнал работы
          </button>
        </div>
      );
    }

    return session.currentUserId === "vlad" ? (
      <div className="grid gap-2">
        <div className={cn("rounded-[22px] px-4 py-3 text-sm leading-6 backdrop-blur-xl", isPink ? "bg-white/[0.56] text-pink-900" : "bg-white/[0.05] text-slate-200")}>
          <div className="mb-1 flex items-center gap-2 font-semibold"><Cloud className="size-4" /> Статус подключения</div>
          <div>Платформа: {runtimeInfo.platformLabel}</div>
          <div>Рантайм: {runtimeInfo.runtimeLabel}</div>
          <div>Сеть сейчас: {runtimeInfo.isOnline ? "Онлайн" : "Оффлайн"}</div>
          <div>Хранилище: {storageModeLabel}</div>
          <div>Облачный маршрут: {cloudModeLabel}</div>
          <div>Облако настроено: {developer.isCloudConfigured ? "Да" : "Нет"}</div>
          <div>Сейчас идёт синхронизация: {developer.isSyncing ? "Да" : "Нет"}</div>
          <div>Состояние интерфейса: {snapshot.settings.developerCloudStatus}</div>
          <div>Локальная очередь: {snapshot.settings.pendingCloudSync ? "Есть данные для дозаписи" : "Пусто"}</div>
          <div>Последнее сообщение: {developer.lastCloudMessage || "—"}</div>
          <div>Последняя ошибка: {developer.lastCloudError || "—"}</div>
          <div>Последняя удачная синхронизация: {snapshot.settings.lastCloudSyncAt || "Локальный режим"}</div>
          <div className="mt-2 text-[11px] leading-5 opacity-70">iPhone route: можно запускать Simulator, открывать Xcode и собирать TestFlight / App Store архив прямо из папки IPHONE.</div>
        </div>

        <button onClick={() => downloadJsonFile("istoriya-vhodov-kalendarya.json", snapshot.loginHistory)} className={cn("rounded-[22px] px-4 py-3 text-left backdrop-blur-xl", isPink ? "bg-white/[0.60] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
          Скачать историю входов
        </button>
        <button onClick={() => void syncPending()} className={cn("rounded-[22px] px-4 py-3 text-left backdrop-blur-xl", isPink ? "bg-white/[0.60] text-pink-700" : "bg-white/[0.05] text-slate-100")}>
          <span className="inline-flex items-center gap-2"><RefreshCcw className="size-4" /> Обновить статус и синхронизацию</span>
        </button>
      </div>
    ) : null;
  };

  const DesktopPanel = () => (
    <motion.section
      key={tab}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      className={cn(sectionClass, "hidden min-h-[520px] lg:block lg:p-4")}
      style={cardStyle}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className={cn("text-[11px] uppercase tracking-[0.32em]", isPink ? "text-pink-500/[0.72]" : "text-sky-200/[0.64]")}>Окно настроек</div>
          <div className="mt-2 text-2xl font-semibold">{activeTab.label}</div>
          <div className={cn("mt-2 max-w-[560px] text-sm leading-6", isPink ? "text-pink-700/[0.72]" : "text-slate-300/[0.78]")}>{activeTab.note}</div>
        </div>
      </div>
      {renderPanelContent(tab)}
    </motion.section>
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <motion.aside initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={sectionClass} style={cardStyle}>
          <div className="mb-4">
            <div className={cn("text-[11px] uppercase tracking-[0.32em]", isPink ? "text-pink-500/[0.72]" : "text-sky-200/[0.64]")}>Настройки</div>
            <div className="mt-2 text-xl font-semibold">Настройки</div>
          </div>

          <div className="space-y-2">
            {tabs.map(({ key, label, icon: Icon, note }) => (
              <button
                key={key}
                onClick={() => openTab(key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[24px] px-4 py-3 text-left backdrop-blur-xl transition active:scale-[0.99]",
                  tab === key
                    ? isPink
                      ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-rose"
                      : "bg-gradient-to-r from-sky-400 to-indigo-500 text-white"
                    : isPink
                      ? "bg-white/[0.62] text-pink-700"
                      : "bg-white/[0.05] text-slate-100"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    <span className={cn("block truncate text-[11px]", tab === key ? "text-white/80" : isPink ? "text-pink-700/70" : "text-slate-300/70")}>{note}</span>
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0" />
              </button>
            ))}
          </div>
        </motion.aside>

        <AnimatePresence mode="wait">
          <DesktopPanel key={`desktop-${tab}`} />
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {pinModalOpen ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} className={cn("w-full max-w-[420px] rounded-[32px] border p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl", isPink ? "border-white/[0.84] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,242,248,0.98))] text-[#3c2537]" : "border-white/[0.12] bg-[#07111f]/[0.96] text-white")}>
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.28em] opacity-70">PIN на вход</div>
                <div className="mt-2 text-xl font-semibold">{pinStep === "create" ? "Придумай PIN-код" : "Подтверди PIN-код"}</div>
                <div className="mt-3 flex items-center justify-center gap-3">
                  {Array.from({ length: 4 }).map((_, index) => {
                    const activeLength = pinStep === "create" ? pinDraft.length : pinConfirm.length;
                    return <div key={index} className={cn("size-4 rounded-full border-2", index < activeLength ? (isPink ? "border-pink-500 bg-pink-500" : "border-sky-300 bg-sky-300") : "border-white/24 bg-transparent")} />;
                  })}
                </div>
                {pinStatus ? <div className="mt-3 rounded-[16px] bg-red-500/[0.10] px-3 py-2 text-sm text-red-300">{pinStatus}</div> : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {["1","2","3","4","5","6","7","8","9"].map((digit) => (
                  <button key={digit} type="button" onClick={() => appendPinDigit(digit)} className={cn("flex h-[64px] items-center justify-center rounded-full border text-2xl font-medium transition active:scale-[0.98]", isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white")}>{digit}</button>
                ))}
                <button type="button" onClick={() => { setPinModalOpen(false); setPinStatus(""); }} className={cn("flex h-[64px] items-center justify-center rounded-full border text-sm font-medium transition active:scale-[0.98]", isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white")}>Отмена</button>
                <button type="button" onClick={() => appendPinDigit("0")} className={cn("flex h-[64px] items-center justify-center rounded-full border text-2xl font-medium transition active:scale-[0.98]", isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white")}>0</button>
                <button type="button" onClick={removePinDigit} className={cn("flex h-[64px] items-center justify-center rounded-full border text-sm font-medium transition active:scale-[0.98]", isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white")}>Стереть</button>
              </div>
              <button type="button" onClick={() => void submitPinStep()} className={cn("mt-4 w-full rounded-[22px] px-4 py-3 text-sm font-semibold", isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950")}>{pinStep === "create" ? "Дальше" : "Сохранить PIN"}</button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobilePanelOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[90] lg:hidden",
              isPink ? "bg-[linear-gradient(180deg,rgba(255,248,252,0.98),rgba(255,236,246,0.99))] text-[#3c2537]" : "bg-[linear-gradient(180deg,#04101d,#081422)] text-white"
            )}
          >
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex h-[100dvh] w-full flex-col"
            >
              <div className={cn("sticky top-0 z-10 border-b px-4 pb-3 pt-4", isPink ? "border-pink-200/70 bg-white/[0.84]" : "border-white/10 bg-[#07111d]/94")}>
                <div className="pt-[max(env(safe-area-inset-top),0px)]" />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMobilePanelOpen(false)}
                    className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium", isPink ? "bg-white text-pink-700" : "bg-white/[0.06] text-slate-100")}
                  >
                    <ArrowLeft className="size-4" /> Назад
                  </button>
                  <div className="min-w-0 text-right">
                    <div className={cn("text-[10px] uppercase tracking-[0.28em]", isPink ? "text-pink-500/[0.72]" : "text-sky-200/[0.64]")}>Настройки</div>
                    <div className="mt-1 text-xl font-semibold leading-none">{activeTab.label}</div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-4">
                {renderPanelContent(tab)}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

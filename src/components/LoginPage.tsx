import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Delete, HeartHandshake, LockKeyhole, Palette, Sparkles, UserRound } from "lucide-react";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

const themeCards = [
  {
    key: "luxuryBlue" as const,
    title: "Тёмно-синяя",
    note: "Базовая тема по умолчанию: глубокий синий фон и спокойный контраст.",
    preview: "bg-[linear-gradient(135deg,#061327_0%,#0c223f_45%,#374ea0_100%)] text-white"
  },
  {
    key: "whitePink" as const,
    title: "Розовая",
    note: "Больше розового, мягких теней и воздушного стекла.",
    preview: "bg-[linear-gradient(135deg,#fff6fb_0%,#ffe0ef_48%,#eddfff_100%)] text-[#5b3750]"
  },
  {
    key: "darkRed" as const,
    title: "Тёмно-красная",
    note: "Бордовая атмосфера, спокойная глубина и тёплый мрак.",
    preview: "bg-[linear-gradient(135deg,#17050a_0%,#3a0d18_42%,#7b1d2a_100%)] text-white"
  },
  {
    key: "blackout" as const,
    title: "Чёрная",
    note: "Максимально тёмный строгий фон без лишней яркости.",
    preview: "bg-[linear-gradient(135deg,#050506_0%,#0b0b0d_45%,#232328_100%)] text-white"
  }
];

const pinButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const PIN_LENGTH = 4;

export const LoginPage = () => {
  const { snapshot, login, updateTheme, updateSettings } = useAppStore();
  const theme = snapshot.settings.theme;
  const isPink = theme === "whitePink";
  const [themePickerOpen, setThemePickerOpen] = useState(!snapshot.settings.themeChosen);
  const [form, setForm] = useState({
    login: "Vlad",
    password: "12345678",
    pin: ""
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    setThemePickerOpen(!snapshot.settings.themeChosen);
  }, [snapshot.settings.themeChosen]);

  useEffect(() => {
    setForm((old) => ({ ...old, pin: old.pin.slice(0, PIN_LENGTH) }));
  }, []);

  const hints = useMemo(
    () =>
      Object.values(snapshot.users).map((user) => ({
        id: user.id,
        nickname: user.nickname,
        login: user.login,
        password: user.password
      })),
    [snapshot.users]
  );

  const photoStyle = buildPhotoGlassStyle(snapshot.settings.backgroundImage, theme, isPink ? 0.88 : 0.74);

  const handleChooseTheme = async (nextTheme: "whitePink" | "luxuryBlue" | "darkRed" | "blackout") => {
    await updateTheme(nextTheme);
    await updateSettings({ themeChosen: true });
    setThemePickerOpen(false);
  };

  const appendPin = (digit: string) => {
    setForm((old) => {
      if (old.pin.length >= PIN_LENGTH) {
        return old;
      }
      return { ...old, pin: `${old.pin}${digit}` };
    });
  };

  const removePin = () => {
    setForm((old) => ({ ...old, pin: old.pin.slice(0, -1) }));
  };

  const submitLogin = async () => {
    if (snapshot.settings.pinEnabled && form.pin.length < PIN_LENGTH) {
      setStatus("Введите PIN-код полностью");
      return;
    }

    const result = await login(form.login, form.password, form.pin);
    setStatus(result.message);
    if (result.ok && snapshot.settings.notificationsEnabled && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative min-h-screen px-4 py-8",
        theme === "whitePink" ? "app-bg-whitePink text-[#402b39]" : theme === "darkRed" ? "app-bg-darkRed text-white" : theme === "blackout" ? "app-bg-blackout text-white" : "app-bg-luxuryBlue text-white"
      )}
      style={photoStyle}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1120px] items-center justify-center">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.78fr)]">
          <div
            className={cn(
              "glass-shell relative overflow-hidden rounded-[40px] border p-5 shadow-glow sm:p-7 lg:p-8",
              isPink ? "border-white/[0.82] bg-white/[0.62] shadow-rose" : "border-white/[0.12] bg-white/[0.08]"
            )}
          >
            <div className="pointer-events-none absolute -right-14 top-[-48px] size-44 rounded-full bg-gradient-to-br from-pink-300/[0.35] via-white/[0.30] to-sky-300/[0.22] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 size-40 rounded-full bg-gradient-to-br from-fuchsia-200/[0.18] to-transparent blur-3xl" />

            <div className="relative z-[1]">
              <div className="mb-7 text-center lg:text-left">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] bg-white/75 text-pink-500 backdrop-blur-xl lg:mx-0 dark:text-sky-300">
                  <HeartHandshake className="size-7" />
                </div>
                <div className="text-[11px] uppercase tracking-[0.34em] opacity-70">0.8.2</div>
                <div className="mt-2 text-2xl font-semibold">Календарь двоих</div>
                <div className={cn("mt-3 max-w-[520px] text-sm leading-6", isPink ? "text-[#7d4867]" : "text-slate-300/[0.82]")}>Мягкий вход, компактные тамагочи на телефоне, новые темы и более лёгкий фон без лишних лагов.</div>
              </div>

              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await submitLogin();
                }}
              >
                <label className="block">
                  <div className="mb-2 text-sm font-medium">Логин</div>
                  <div className={cn("glass-field flex items-center gap-2 rounded-[24px] border px-4 py-3", isPink ? "border-white/[0.86] bg-white/[0.86]" : "border-white/[0.12] bg-white/[0.06]") }>
                    <UserRound className="size-4 opacity-70" />
                    <input
                      className={cn("w-full bg-transparent", isPink ? "text-[#402b39]" : "text-white")}
                      value={form.login}
                      onChange={(event) => setForm((old) => ({ ...old, login: event.target.value }))}
                      placeholder="Vlad или Liya"
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium">Пароль</div>
                  <div className={cn("glass-field flex items-center gap-2 rounded-[24px] border px-4 py-3", isPink ? "border-white/[0.86] bg-white/[0.86]" : "border-white/[0.12] bg-white/[0.06]") }>
                    <LockKeyhole className="size-4 opacity-70" />
                    <input
                      type="password"
                      className={cn("w-full bg-transparent", isPink ? "text-[#402b39]" : "text-white")}
                      value={form.password}
                      onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))}
                      placeholder="12345678"
                    />
                  </div>
                </label>

                <motion.button
                  whileTap={{ scale: 0.985 }}
                  type="submit"
                  className={cn(
                    "w-full rounded-[26px] px-5 py-4 text-sm font-semibold transition",
                    isPink
                      ? "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-400 text-white shadow-[0_18px_40px_rgba(226,66,170,0.26)]"
                      : "bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 text-slate-950"
                  )}
                >
                  Войти
                </motion.button>

                {status ? (
                  <div className={cn("rounded-2xl px-4 py-3 text-sm backdrop-blur-xl", status.includes("не") ? "bg-red-500/[0.10] text-red-300" : isPink ? "bg-white/[0.82] text-pink-700" : "bg-emerald-500/[0.10] text-emerald-300")}>{status}</div>
                ) : null}
              </form>

              <div className={cn("mt-5 rounded-[30px] border p-4", isPink ? "border-white/[0.84] bg-white/[0.70]" : "border-white/[0.12] bg-white/[0.06]") }>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className={cn("size-4", isPink ? "text-pink-500" : "text-sky-300")} />
                  Быстрый вход
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {hints.map((hint) => (
                    <button
                      key={hint.id}
                      type="button"
                      onClick={() => setForm((old) => ({ ...old, login: hint.login, password: hint.password }))}
                      className={cn("rounded-[22px] border px-4 py-4 text-left backdrop-blur-xl transition hover:-translate-y-[1px]", isPink ? "border-white/[0.84] bg-white/[0.86]" : "border-white/[0.10] bg-white/[0.05] text-white")}
                    >
                      <div className="text-sm font-semibold">{hint.nickname}</div>
                      <div className="mt-1 text-xs opacity-70">Заполнить логин и пароль автоматически</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {snapshot.settings.pinEnabled ? (
            <div
              className={cn(
                "glass-shell relative overflow-hidden rounded-[40px] border p-5 shadow-glow sm:p-6",
                isPink ? "border-white/[0.82] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,242,248,0.94))] shadow-rose" : "border-white/[0.12] bg-slate-950/[0.42]"
              )}
            >
              <div className="pointer-events-none absolute inset-x-12 top-0 h-24 rounded-b-[36px] bg-white/40 blur-3xl" />
              <div className="relative z-[1] flex min-h-[720px] flex-col items-center justify-between gap-6 px-1 py-3 sm:min-h-[760px] sm:px-4">
                <div className="pt-4 text-center">
                  <div className="text-[48px] font-medium leading-none text-[#4b4b4f] sm:text-[60px]">Введите PIN-код</div>
                  <div className="mt-8 flex items-center justify-center gap-6 sm:gap-8">
                    {Array.from({ length: PIN_LENGTH }).map((_, dotIndex) => (
                      <div
                        key={dotIndex}
                        className={cn(
                          "size-6 rounded-full border-2 transition sm:size-7",
                          dotIndex < form.pin.length ? "border-[#4d4d51] bg-[#4d4d51]" : "border-[#5a5a5f] bg-transparent"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid w-full max-w-[420px] grid-cols-3 gap-x-5 gap-y-6 pb-2 sm:gap-x-7 sm:gap-y-7">
                  {pinButtons.map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => appendPin(digit)}
                      className="flex h-[98px] items-center justify-center rounded-full border-2 border-[#5a5a5f] bg-white/10 text-[42px] font-normal text-[#4a4a4f] transition active:scale-[0.98] sm:h-[112px] sm:text-[46px]"
                    >
                      {digit}
                    </button>
                  ))}
                  <div />
                  <button
                    type="button"
                    onClick={() => appendPin("0")}
                    className="flex h-[98px] items-center justify-center rounded-full border-2 border-[#5a5a5f] bg-white/10 text-[42px] font-normal text-[#4a4a4f] transition active:scale-[0.98] sm:h-[112px] sm:text-[46px]"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={removePin}
                    className="flex h-[98px] items-center justify-center rounded-full border-2 border-transparent bg-white/50 text-[#4a4a4f] transition active:scale-[0.98] sm:h-[112px]"
                    title="Удалить"
                  >
                    <Delete className="size-11" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void submitLogin()}
                  className={cn(
                    "w-full max-w-[420px] rounded-[28px] px-5 py-4 text-base font-semibold transition",
                    isPink
                      ? "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-400 text-white shadow-[0_18px_40px_rgba(226,66,170,0.22)]"
                      : "bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 text-slate-950"
                  )}
                >
                  Подтвердить PIN
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {themePickerOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={cn(
                "w-full max-w-[720px] rounded-[38px] border p-5 shadow-[0_32px_120px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6",
                isPink ? "border-white/[0.84] bg-white/[0.76] text-[#402b39]" : "border-white/[0.12] bg-slate-950/[0.76] text-white"
              )}
            >
              <div className="text-center">
                <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.28em]", isPink ? "bg-white/[0.84] text-pink-600" : "bg-white/[0.08] text-sky-200")}>
                  <Palette className="size-4" />
                  Первый запуск
                </div>
                <div className="mt-4 text-2xl font-semibold">Выбери тему приложения</div>
                <div className={cn("mx-auto mt-3 max-w-[520px] text-sm leading-6", isPink ? "text-[#81596d]" : "text-slate-300/[0.82]")}>Начнём с внешнего вида. Выбор можно будет поменять позже в настройках.</div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {themeCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => void handleChooseTheme(card.key)}
                    className={cn(
                      "overflow-hidden rounded-[30px] border p-3 text-left transition hover:-translate-y-[1px]",
                      card.key === theme ? (card.key === "whitePink" ? "border-pink-300 bg-white/[0.76] shadow-rose" : card.key === "darkRed" ? "border-rose-400 bg-rose-500/[0.10]" : card.key === "blackout" ? "border-white/[0.18] bg-white/[0.04]" : "border-sky-300 bg-sky-300/[0.08]") : isPink ? "border-white/[0.84] bg-white/[0.64]" : "border-white/[0.10] bg-white/[0.05]"
                    )}
                  >
                    <div className={cn("rounded-[24px] px-4 py-6", card.preview)}>
                      <div className="text-base font-semibold">{card.title}</div>
                      <div className="mt-2 max-w-[240px] text-sm leading-6 opacity-80">{card.note}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Delete, Heart, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/components/LoginPage";
import { buildPhotoGlassStyle } from "@/lib/background";
import { cn } from "@/lib/cn";
import { useAppStore } from "@/store/useAppStore";

const PIN_LENGTH = 4;
const pinButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function PinLockScreen({
  isPink,
  pinCode,
  onUnlock
}: {
  isPink: boolean;
  pinCode: string;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPin("");
    setStatus("");
  }, [pinCode]);

  const appendPin = (digit: string) => {
    setPin((old) => {
      if (old.length >= PIN_LENGTH) {
        return old;
      }
      return `${old}${digit}`;
    });
  };

  const removePin = () => {
    setPin((old) => old.slice(0, -1));
  };

  const submit = () => {
    if (pin.length < PIN_LENGTH) {
      setStatus("Введите PIN-код полностью");
      return;
    }

    if (pin !== pinCode) {
      setPin("");
      setStatus("PIN-код неверный");
      return;
    }

    setStatus("");
    onUnlock();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/96 p-4 backdrop-blur-[14px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        className={cn(
          "w-full max-w-[460px] rounded-[34px] border p-5 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-6",
          isPink ? "border-white/[0.86] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,243,248,0.98))] text-[#432b3b]" : "border-white/[0.12] bg-[#07111f]/[0.96] text-white"
        )}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-[20px] bg-white/10">
            <LockKeyhole className="size-7" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] opacity-70">вход в приложение</div>
          <div className="mt-2 text-2xl font-semibold">Введите PIN-код</div>
        </div>

        <div className="mb-6 flex items-center justify-center gap-4">
          {Array.from({ length: PIN_LENGTH }).map((_, dotIndex) => (
            <div
              key={dotIndex}
              className={cn(
                "size-4 rounded-full border-2 transition sm:size-5",
                dotIndex < pin.length ? (isPink ? "border-pink-500 bg-pink-500" : "border-sky-300 bg-sky-300") : "border-white/24 bg-transparent"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {pinButtons.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => appendPin(digit)}
              className={cn(
                "flex h-[72px] items-center justify-center rounded-full border text-2xl font-medium transition active:scale-[0.98]",
                isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white"
              )}
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => appendPin("0")}
            className={cn(
              "flex h-[72px] items-center justify-center rounded-full border text-2xl font-medium transition active:scale-[0.98]",
              isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white"
            )}
          >
            0
          </button>
          <button
            type="button"
            onClick={removePin}
            className={cn(
              "flex h-[72px] items-center justify-center rounded-full border transition active:scale-[0.98]",
              isPink ? "border-white/[0.86] bg-white/[0.86] text-[#432b3b]" : "border-white/[0.14] bg-white/[0.06] text-white"
            )}
            title="Удалить"
          >
            <Delete className="size-7" />
          </button>
        </div>

        {status ? <div className="mt-4 rounded-[18px] bg-red-500/[0.10] px-4 py-3 text-center text-sm text-red-300">{status}</div> : null}

        <button
          type="button"
          onClick={submit}
          className={cn(
            "mt-4 w-full rounded-[24px] px-4 py-4 text-sm font-semibold transition active:scale-[0.99]",
            isPink ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white" : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
          )}
        >
          Открыть приложение
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const { bootstrap, session, snapshot, syncPending } = useAppStore();
  const [pinLocked, setPinLocked] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handleOnline = () => {
      void syncPending();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPending]);

  useEffect(() => {
    if (!session.isBootstrapped) {
      return;
    }

    if (!session.currentUserId || !snapshot.settings.pinEnabled) {
      setPinLocked(false);
      return;
    }

    setPinLocked(true);
  }, [session.currentUserId, session.isBootstrapped, snapshot.settings.pinEnabled]);

  useEffect(() => {
    if (!session.currentUserId || !snapshot.settings.pinEnabled) {
      return;
    }

    let hiddenAt = 0;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (hiddenAt && Date.now() - hiddenAt >= 1500) {
        setPinLocked(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [session.currentUserId, snapshot.settings.pinEnabled]);

  const isPink = snapshot.settings.theme === "whitePink";
  const themeClass = snapshot.settings.theme === "whitePink"
    ? "app-bg-whitePink"
    : snapshot.settings.theme === "darkRed"
      ? "app-bg-darkRed"
      : snapshot.settings.theme === "blackout"
        ? "app-bg-blackout"
        : "app-bg-luxuryBlue";
  const photoStyle = useMemo(() => buildPhotoGlassStyle(snapshot.settings.backgroundImage, snapshot.settings.theme, isPink ? 0.84 : 0.72), [isPink, snapshot.settings.backgroundImage, snapshot.settings.theme]);

  if (!session.isBootstrapped) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-6 ${
          `${themeClass} ${isPink ? "text-[#3f2d3f]" : "text-white"}`
        }`}
        style={photoStyle}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 16 }}
          className={`flex size-24 items-center justify-center rounded-[32px] border shadow-glow ${
            isPink
              ? "border-white/[0.70] bg-white/[0.45] backdrop-blur-2xl"
              : "border-white/[0.15] bg-white/[0.10] backdrop-blur-2xl"
          }`}
        >
          <Heart className={`size-10 ${isPink ? "text-pink-500" : "text-sky-300"}`} fill="currentColor" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">{session.currentUserId ? <AppShell key="shell" /> : <LoginPage key="login" />}</AnimatePresence>
      <AnimatePresence>
        {session.currentUserId && snapshot.settings.pinEnabled && pinLocked ? (
          <PinLockScreen key="pin-lock" isPink={isPink} pinCode={snapshot.settings.pinCode} onUnlock={() => setPinLocked(false)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}

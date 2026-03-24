import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  ArrowLeft,
  Bath,
  Footprints,
  Sparkles,
  Trophy,
  UtensilsCrossed
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getPetArtwork, getPetBaseArtwork, getPetDecorItems } from "@/lib/tamagotchiVisuals";
import {
  applyDoorKnockAction,
  applyFeedAction,
  applyPetAction,
  applyTapAction,
  applyWalkAction,
  applyWashAction,
  canFeedNow,
  canWashNow,
  formatRemaining,
  getAchievements,
  getLevelProgress,
  getMoodEmoji,
  getRandomFoodEmoji,
  getReturnTimeLabel,
  getTamagotchiAgeDays,
  getTamagotchiPhrase,
  getTodaySummary,
  resolveTamagotchi
} from "@/lib/tamagotchi";
import { useAppStore } from "@/store/useAppStore";
import type { TamagotchiState, UserId } from "@/types";

const BAR_META = [
  { key: "hunger", label: "Сыт", emoji: "🍜" },
  { key: "cleanliness", label: "Чист", emoji: "🫧" },
  { key: "joy", label: "Счастлив", emoji: "💗" },
  { key: "energy", label: "Бодрость", emoji: "😴" }
] as const;

interface FloatingEffectItem {
  id: string;
  ownerId: UserId;
  emoji: string;
  x: number;
  y: number;
}

interface FoodSpawnItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

const RoomBar = ({ label, value, isPink }: { label: string; value: number; isPink: boolean }) => (
  <div>
    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
      <span>{label}</span>
      <span className="font-semibold">{Math.round(value)}%</span>
    </div>
    <div className={cn("h-2 overflow-hidden rounded-full", isPink ? "bg-[#f8d9e6]" : "bg-white/[0.10]") }>
      <motion.div
        className={cn(
          "h-full rounded-full",
          isPink ? "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-400" : "bg-gradient-to-r from-sky-400 to-indigo-500"
        )}
        animate={{ width: `${Math.max(6, Math.min(100, value))}%` }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </div>
  </div>
);

const FloatingPetDecor = ({
  items,
  isPink,
  dense = false,
  accent = "soft"
}: {
  items: string[];
  isPink: boolean;
  dense?: boolean;
  accent?: "soft" | "playful";
}) => {
  const visibleItems = useMemo(() => items.slice(0, dense ? 4 : 5), [items, dense]);
  if (!visibleItems.length) return null;

  return (
    <div data-decorative="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {visibleItems.map((emoji, index) => {
        const size = dense ? 16 + ((index * 3) % 10) : 20 + ((index * 4) % 14);
        const delay = index * (dense ? 0.18 : 0.28);
        return (
          <motion.span
            key={`${emoji}-${index}`}
            initial={false}
            animate={{
              opacity: isPink ? [0.28, 0.36, 0.28] : [0.14, 0.22, 0.14],
              x: [0, index % 2 === 0 ? 7 : -8, 0],
              y: [0, -10 - (index % 3) * 4, 0],
              rotate: [0, index % 2 === 0 ? 3 : -3, 0],
              scale: accent === "playful" ? [0.99, 1.015, 1] : [0.99, 1.005, 1]
            }}
            transition={{
              duration: dense ? 9.6 + index * 0.2 : 11.4 + index * 0.36,
              delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut"
            }}
            className="absolute select-none will-change-transform"
            style={{
              left: `${10 + (index * 13) % 76}%`,
              top: `${9 + ((index * 14) % 72)}%`,
              fontSize: `${size}px`,
              filter: isPink
                ? `drop-shadow(0 5px 10px rgba(255,92,177,${dense ? 0.12 : 0.16}))`
                : `drop-shadow(0 5px 10px rgba(95,173,255,${dense ? 0.08 : 0.12}))`
            }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
};

const getHomeMotionProps = (animated: boolean, pet: TamagotchiState, cycle: number, now = new Date()) => {
  const motionCycle = (cycle + (pet.id === "liya" ? 1 : 0)) % 4;
  if (!animated) {
    return {
      image: { y: 0 },
      shadow: { opacity: 0.6 },
      transition: { duration: 0.2, ease: "easeOut" as const }
    };
  }

  const hour = now.getHours();
  const night = hour >= 23 || hour < 7;
  const gentle = night || pet.energy <= 40;
  const playful = pet.joy >= 72 && pet.mood !== "angry" && pet.mood !== "tired";

  if (gentle) {
    return {
      image: { y: [0, -6, 0], rotate: [0, -1.2, 1.2, 0], scaleY: [1, 0.985, 1.01, 1], scaleX: [1, 1.01, 0.99, 1] },
      shadow: { y: [0, -4, 0], opacity: [0.42, 0.68, 0.42], scale: [1, 1.05, 1] },
      transition: { duration: pet.id === "liya" ? 6.2 : 5.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
    };
  }

  if (playful) {
    return {
      image: { y: [0, -12, 0], rotate: [0, -2.1, 2.1, 0], scaleX: [1, 1.04, 0.96, 1], scaleY: [1, 0.96, 1.04, 1], x: [0, 1.6, -1.6, 0] },
      shadow: { y: [0, -10, 0], opacity: [0.48, 0.8, 0.48], scale: [1, 1.12, 1] },
      transition: { duration: pet.id === "liya" ? 4.9 : 4.25, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
    };
  }

  switch (motionCycle) {
    case 1:
      return {
        image: { y: [0, -9, 0], rotate: [0, -2, 2, 0], scaleX: [1, 1.03, 0.97, 1], scaleY: [1, 0.98, 1.02, 1] },
        shadow: { y: [0, -8, 0], opacity: [0.5, 0.82, 0.5], scale: [1, 1.1, 1] },
        transition: { duration: pet.id === "liya" ? 4.45 : 3.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    case 2:
      return {
        image: { y: [0, -10, 0], x: [0, 1.6, -1.6, 0], rotate: [0, 1.2, -1.2, 0], scale: [1, 1.01, 0.99, 1] },
        shadow: { y: [0, -9, 0], opacity: [0.46, 0.76, 0.46], scale: [1, 1.12, 1] },
        transition: { duration: pet.id === "liya" ? 4.9 : 4.25, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    case 3:
      return {
        image: { y: [0, -11, 0], rotate: [0, -0.7, 0.7, 0], scaleX: [1, 1.04, 0.96, 1], scaleY: [1, 0.96, 1.04, 1] },
        shadow: { y: [0, -10, 0], opacity: [0.5, 0.8, 0.5], scale: [1, 1.14, 1] },
        transition: { duration: 4.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    default:
      return {
        image: { y: [0, -10, 0], rotate: [0, -1.5, 1.5, 0], scale: [1, 1.02, 0.98, 1] },
        shadow: { y: [0, -8, 0], opacity: [0.5, 0.8, 0.5], scale: [1, 1.08, 1] },
        transition: { duration: 4.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
  }
};

const getRoomMotionProps = (animated: boolean, pet: TamagotchiState, cycle: number, now = new Date()) => {
  const motionCycle = (cycle + (pet.id === "vlad" ? 2 : 0)) % 4;
  if (!animated) {
    return {
      image: { y: 0 },
      shadow: { opacity: 0.6 },
      transition: { duration: 0.2, ease: "easeOut" as const }
    };
  }

  const hour = now.getHours();
  const night = hour >= 23 || hour < 7;

  if (pet.mood === "angry") {
    return {
      image: { y: [0, -6, 0], x: [0, 2.8, -2.8, 0], rotate: [0, -2.8, 2.8, 0], scale: [1, 1.01, 0.99, 1] },
      shadow: { y: [0, -6, 0], opacity: [0.46, 0.72, 0.46], scale: [1, 1.08, 1] },
      transition: { duration: 2.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
    };
  }

  if (pet.mood === "tired" || pet.energy <= 38 || night) {
    return {
      image: { y: [0, -5, 0], rotate: [0, -0.8, 0.8, 0], scaleY: [1, 0.985, 1.01, 1], scaleX: [1, 1.015, 0.99, 1] },
      shadow: { y: [0, -4, 0], opacity: [0.42, 0.64, 0.42], scale: [1, 1.04, 1] },
      transition: { duration: 5.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
    };
  }

  if (pet.joy >= 75 && pet.affection >= 70) {
    return {
      image: { y: [0, -13, 0], x: [0, 2.2, -2.2, 0], rotate: [0, -2, 2, 0], scaleX: [1, 1.05, 0.95, 1], scaleY: [1, 0.95, 1.05, 1] },
      shadow: { y: [0, -10, 0], opacity: [0.48, 0.8, 0.48], scale: [1, 1.14, 1] },
      transition: { duration: 4.0, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
    };
  }

  switch (motionCycle) {
    case 1:
      return {
        image: { y: [0, -11, 0], rotate: [0, -2.2, 2.2, 0], scaleX: [1, 1.03, 0.97, 1], scaleY: [1, 0.97, 1.03, 1] },
        shadow: { y: [0, -8, 0], opacity: [0.44, 0.72, 0.44], scale: [1, 1.12, 1] },
        transition: { duration: 4.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    case 2:
      return {
        image: { y: [0, -12, 0], x: [0, 1.8, -1.8, 0], rotate: [0, 1.8, -1.8, 0], scale: [1, 1.02, 0.98, 1] },
        shadow: { y: [0, -9, 0], opacity: [0.44, 0.74, 0.44], scale: [1, 1.14, 1] },
        transition: { duration: 4.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    case 3:
      return {
        image: { y: [0, -10, 0], rotate: [0, -0.9, 0.9, 0], scaleX: [1, 1.05, 0.95, 1], scaleY: [1, 0.95, 1.05, 1] },
        shadow: { y: [0, -8, 0], opacity: [0.48, 0.78, 0.48], scale: [1, 1.1, 1] },
        transition: { duration: 4.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
    default:
      return {
        image: { y: [0, -10, 0], rotate: [0, -1.8, 1.8, 0], scale: [1, 1.02, 0.98, 1], x: [0, 1.5, -1.5, 0] },
        shadow: { y: [0, -8, 0], opacity: [0.44, 0.72, 0.44], scale: [1, 1.08, 1] },
        transition: { duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" as const }
      };
  }
};

const MainCard = ({
  pet,
  isPink,
  animated,
  bubble,
  isOwner,
  onOpen,
  motionCycle,
  decorItems,
  nowTick
}: {
  pet: TamagotchiState;
  isPink: boolean;
  animated: boolean;
  bubble?: string | null;
  isOwner: boolean;
  onOpen: () => void;
  motionCycle: number;
  decorItems: string[];
  nowTick: number;
}) => {
  const image = getPetArtwork(pet, new Date(nowTick), "home");
  const homeMotion = getHomeMotionProps(animated, pet, motionCycle, new Date(nowTick));
  const displayName = pet.id === "liya" ? "LIYA" : "VLAD";
  const [homeImage, setHomeImage] = useState(image);

  useEffect(() => {
    setHomeImage(image);
  }, [image]);

  return (
    <button
      type="button"
      onClick={isOwner ? onOpen : undefined}
      disabled={!isOwner}
      className={cn(
        "group relative flex min-h-[166px] flex-col overflow-hidden rounded-[20px] border p-2 text-left shadow-glass backdrop-blur-2xl transition sm:min-h-[260px] sm:rounded-[30px] sm:p-3",
        isOwner ? "active:scale-[0.99]" : "cursor-default",
        isPink
          ? "border-white/[0.68] bg-[linear-gradient(180deg,rgba(67,39,58,0.76),rgba(34,21,33,0.88))] text-white"
          : "border-white/[0.10] bg-[linear-gradient(180deg,rgba(19,30,51,0.90),rgba(7,12,22,0.96))] text-white"
      )}
    >
      <FloatingPetDecor items={decorItems} isPink={false} dense accent="playful" />

      <div className="pointer-events-none absolute inset-0">
        <div className={cn("absolute -right-8 -top-10 size-36 rounded-full blur-3xl", isPink ? "bg-pink-400/18" : "bg-sky-400/12")} />
        <div className={cn("absolute -left-10 -bottom-12 size-40 rounded-full blur-3xl", isPink ? "bg-fuchsia-300/18" : "bg-indigo-400/12")} />
      </div>

      <div className="relative z-[1] flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-semibold tracking-[0.28em] text-white/78">{displayName}</div>
        </div>
        <div className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/78">ур. {pet.level}</div>
      </div>

      <div className="relative z-[1] flex flex-1 items-center justify-center pt-1.5">
        <div className="relative flex w-full flex-col items-center justify-center">
          {bubble ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="pointer-events-none absolute left-[44%] top-1 z-[3] w-[min(78%,10.5rem)] -translate-x-1/2 rounded-[16px] border border-white/[0.12] bg-slate-950/[0.92] px-2.5 py-1.5 text-center text-[10px] leading-4 text-white shadow-[0_20px_40px_rgba(0,0,0,0.22)] sm:left-1/2 sm:top-0 sm:w-[min(72%,14rem)] sm:px-3 sm:py-2 sm:text-xs"
            >
              {bubble}
            </motion.div>
          ) : null}

          <motion.img
            src={homeImage}
            alt={displayName}
            draggable={false}
            onError={() => setHomeImage(getPetBaseArtwork(pet.id))}
            onDragStart={(event) => event.preventDefault()}
            className={cn(
              "pointer-events-none relative z-[1] mt-4 select-none touch-none drop-shadow-[0_20px_26px_rgba(0,0,0,0.24)]",
              pet.id === "liya" ? "w-[116px] sm:w-[210px]" : "w-[126px] sm:w-[220px]"
            )}
            animate={homeMotion.image}
            transition={homeMotion.transition}
          />
          <motion.div
            animate={homeMotion.shadow}
            transition={homeMotion.transition}
            className={cn("-mt-5 h-5 w-32 rounded-full blur-md", isPink ? "bg-pink-300/28" : "bg-sky-300/18")}
          />
        </div>
      </div>
    </button>
  );
};


export const TamagotchiDock = ({ isPink, animated }: { isPink: boolean; animated: boolean }) => {
  const { snapshot, session, updateSettings } = useAppStore();
  const [openedPetId, setOpenedPetId] = useState<UserId | null>(null);
  const [homeBubbles, setHomeBubbles] = useState<Record<UserId, string | null>>({ vlad: null, liya: null });
  const [roomBubble, setRoomBubble] = useState<string>("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<"summary" | "achievements">("summary");
  const [foodItems, setFoodItems] = useState<FoodSpawnItem[]>([]);
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffectItem[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [petSquish, setPetSquish] = useState({ scaleX: 1, scaleY: 1, x: 0, y: 0, rotate: 0 });
  const [petThrowState, setPetThrowState] = useState({ x: 0, y: 0, active: false });
  const roomRef = useRef<HTMLDivElement | null>(null);
  const petStageRef = useRef<HTMLDivElement | null>(null);
  const lastHomeBubbleSlotRef = useRef(-1);
  const lastRoomBubbleSlotRef = useRef(-1);
  const mouthRef = useRef<HTMLDivElement | null>(null);
  const pettingRef = useRef(false);
  const strokeCooldownRef = useRef(0);
  const skipTapRef = useRef(false);
  const holdStartAtRef = useRef<number | null>(null);
  const holdStartPointRef = useRef({ x: 0, y: 0 });
  const longPressTriggeredRef = useRef(false);
  const comboPetRef = useRef({ count: 0, lastAt: 0 });
  const physicsRef = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0, lastTs: 0, frame: 0 });

  const resetPetSquish = () => setPetSquish({ scaleX: 1, scaleY: 1, x: 0, y: 0, rotate: 0 });

  const stopPhysics = () => {
    const physics = physicsRef.current;
    physics.active = false;
    physics.x = 0;
    physics.y = 0;
    physics.vx = 0;
    physics.vy = 0;
    physics.lastTs = 0;
    if (physics.frame) {
      window.cancelAnimationFrame(physics.frame);
      physics.frame = 0;
    }
    setPetThrowState({ x: 0, y: 0, active: false });
  };

  const runPhysicsFrame = (timestamp: number) => {
    const physics = physicsRef.current;
    if (!physics.active || !petStageRef.current) {
      stopPhysics();
      return;
    }

    const dt = physics.lastTs ? Math.min(0.03, (timestamp - physics.lastTs) / 1000) : 0.016;
    physics.lastTs = timestamp;

    physics.vy += 23 * dt;
    physics.x += physics.vx * dt * 42;
    physics.y += physics.vy * dt * 42;

    const rect = petStageRef.current.getBoundingClientRect();
    const petHalfWidth = Math.min(126, Math.max(88, rect.width * 0.19));
    const petHalfHeight = Math.min(116, Math.max(82, rect.height * 0.15));
    const maxX = Math.max(0, rect.width / 2 - petHalfWidth - 14);
    const maxY = Math.max(0, rect.height / 2 - petHalfHeight - 20);

    if (physics.x <= -maxX) {
      physics.x = -maxX;
      physics.vx = Math.abs(physics.vx) * 0.9;
    } else if (physics.x >= maxX) {
      physics.x = maxX;
      physics.vx = -Math.abs(physics.vx) * 0.9;
    }

    if (physics.y <= -maxY) {
      physics.y = -maxY;
      physics.vy = Math.abs(physics.vy) * 0.88;
    } else if (physics.y >= maxY) {
      physics.y = maxY;
      physics.vy = -Math.abs(physics.vy) * 0.87;
      physics.vx *= 0.98;
    }

    physics.vx *= 0.992;
    physics.vy *= 0.997;

    setPetThrowState({ x: physics.x, y: physics.y, active: true });

    if (Math.abs(physics.vx) < 0.18 && Math.abs(physics.vy) < 0.24 && Math.abs(physics.y - maxY) < 2) {
      stopPhysics();
      return;
    }

    physics.frame = window.requestAnimationFrame(runPhysicsFrame);
  };

  const startPhysics = (vx: number, vy: number) => {
    stopPhysics();
    physicsRef.current.active = true;
    physicsRef.current.vx = vx;
    physicsRef.current.vy = vy;
    physicsRef.current.x = 0;
    physicsRef.current.y = 0;
    physicsRef.current.lastTs = 0;
    setPetThrowState({ x: 0, y: 0, active: true });
    physicsRef.current.frame = window.requestAnimationFrame(runPhysicsFrame);
  };

  const currentUserId = session.currentUserId ?? "vlad";
  const pets = useMemo(
    () => ({
      vlad: resolveTamagotchi(snapshot.settings.tamagotchis.vlad, new Date(nowTick)),
      liya: resolveTamagotchi(snapshot.settings.tamagotchis.liya, new Date(nowTick))
    }),
    [nowTick, snapshot.settings.tamagotchis]
  );
  const openedPet = openedPetId ? pets[openedPetId] : null;
  const isOwner = openedPet ? openedPet.ownerId === currentUserId : false;
  const homeDecor = useMemo(
    () => ({
      vlad: getPetDecorItems(pets.vlad, new Date(nowTick)),
      liya: getPetDecorItems(pets.liya, new Date(nowTick))
    }),
    [nowTick, pets.vlad, pets.liya]
  );
  const roomDecor = openedPet ? getPetDecorItems(openedPet, new Date(nowTick)) : [];
  const openedPetArtwork = openedPet ? getPetArtwork(openedPet, new Date(nowTick), "room") : null;
  const [roomImage, setRoomImage] = useState<string | null>(openedPetArtwork);

  const spawnFoodItems = (count = 1) => {
    setFoodItems((current: FoodSpawnItem[]) => {
      const available = Math.max(0, 15 - current.length);
      if (!available) return current;
      const amount = Math.min(count, available);
      const next = Array.from({ length: amount }, (_, index) => ({
        id: `food-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        emoji: getRandomFoodEmoji(Date.now() + index * 17),
        x: 12 + Math.random() * 72,
        y: 10 + Math.random() * 54
      }));
      return [...current, ...next];
    });
  };

  const removeFoodItem = (foodId: string) => {
    setFoodItems((current: FoodSpawnItem[]) => current.filter((item: FoodSpawnItem) => item.id !== foodId));
  };

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 10_000);
    return () => {
      window.clearInterval(interval);
      stopPhysics();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("tamagotchi-room-open", Boolean(openedPetId));
    return () => document.body.classList.remove("tamagotchi-room-open");
  }, [openedPetId]);

  useEffect(() => {
    const bubbleSlot = Math.floor(nowTick / 120_000);
    if (bubbleSlot === lastHomeBubbleSlotRef.current) {
      return;
    }

    lastHomeBubbleSlotRef.current = bubbleSlot;
    setHomeBubbles({
      vlad: getTamagotchiPhrase(pets.vlad, "home", new Date(nowTick)),
      liya: getTamagotchiPhrase(pets.liya, "home", new Date(nowTick))
    });

    const timeout = window.setTimeout(() => {
      setHomeBubbles({ vlad: null, liya: null });
    }, 6800);

    return () => window.clearTimeout(timeout);
  }, [nowTick, pets.vlad, pets.liya, currentUserId]);

  useEffect(() => {
    setRoomImage(openedPetArtwork);
  }, [openedPetArtwork]);

  useEffect(() => {
    if (!openedPetId) {
      lastRoomBubbleSlotRef.current = -1;
      return;
    }

    setRoomBubble(getTamagotchiPhrase(pets[openedPetId], "room", new Date(nowTick)));
    setFoodItems([]);
    setStatsOpen(false);
    setStatsTab("summary");
    resetPetSquish();
    stopPhysics();
    comboPetRef.current = { count: 0, lastAt: 0 };
    lastRoomBubbleSlotRef.current = Math.floor(nowTick / 60_000);
  }, [openedPetId]);

  useEffect(() => {
    if (!openedPetId) return;
    const bubbleSlot = Math.floor(nowTick / 60_000);
    if (bubbleSlot === lastRoomBubbleSlotRef.current) {
      return;
    }

    lastRoomBubbleSlotRef.current = bubbleSlot;
    setRoomBubble(getTamagotchiPhrase(pets[openedPetId], "room", new Date(nowTick)));
  }, [openedPetId, nowTick, pets]);

  const patchPet = async (userId: UserId, nextPet: TamagotchiState, bubble?: string, emoji?: string) => {
    await updateSettings({
      tamagotchis: {
        ...snapshot.settings.tamagotchis,
        [userId]: nextPet
      }
    });

    setNowTick(Date.now());

    if (bubble) {
      setRoomBubble(bubble);
    }

    if (emoji) {
      const id = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const offsetX = Math.round((Math.random() - 0.5) * 50);
      const offsetY = Math.round(Math.random() * 16);
      setFloatingEffects((current: FloatingEffectItem[]) => [...current, { id, ownerId: userId, emoji, x: offsetX, y: offsetY }]);
      window.setTimeout(() => {
        setFloatingEffects((current: FloatingEffectItem[]) => current.filter((item: FloatingEffectItem) => item.id !== id));
      }, 1300);
    }
  };

  const handleTap = async () => {
    if (!openedPetId || !openedPet || !isOwner || openedPet.activity !== "idle") return;
    if (skipTapRef.current) {
      skipTapRef.current = false;
      return;
    }
    const next = applyTapAction(openedPet, new Date());
    await patchPet(openedPetId, next, getMoodEmoji(next) === "💖" ? "Я заметил твой тап 💖" : getTamagotchiPhrase(next, "room"), "💗");
  };

  const handlePet = async (boost = 1) => {
    if (!openedPetId || !openedPet || !isOwner || openedPet.activity !== "idle") return;
    const now = Date.now();
    if (now - strokeCooldownRef.current < 150) return;
    strokeCooldownRef.current = now;
    skipTapRef.current = true;

    const combo = now - comboPetRef.current.lastAt <= 4200 ? comboPetRef.current.count + 1 : 1;
    comboPetRef.current = { count: combo, lastAt: now };
    const intensity = Math.min(4, Math.max(1, boost + Math.floor((combo - 1) / 2)));
    const next = applyPetAction(openedPet, new Date(now), intensity);
    const bubble = openedPetId === "liya"
      ? combo >= 6
        ? "Мне очень нравится, продолжай 💞"
        : combo >= 3
          ? "Ещё чуть-чуть, так приятно 💗"
          : "Мур-мур... ещё чуть-чуть 💗"
      : combo >= 6
        ? "Я официально в восторге. Гладь дальше 😎"
        : combo >= 3
          ? "Ого, у нас уже комбо ласки 💥"
          : "Ого, ласка. Я запомнил 😎";
    const emoji = combo >= 6 ? "💞" : combo >= 3 ? "💖" : "💗";
    await patchPet(openedPetId, next, bubble, emoji);
  };

  const handleFeedDrop = async (foodId: string, info: PanInfo) => {
    if (!openedPetId || !openedPet || !isOwner) {
      removeFoodItem(foodId);
      return;
    }

    const mouthRect = mouthRef.current?.getBoundingClientRect();
    const x = info.point.x;
    const y = info.point.y;
    const padding = 18;
    const hitMouth = mouthRect
      ? x >= mouthRect.left - padding && x <= mouthRect.right + padding && y >= mouthRect.top - padding && y <= mouthRect.bottom + padding
      : false;

    if (!hitMouth) {
      setRoomBubble(openedPet.id === "liya" ? "Попробуй прямо в ротик 🍓" : "Точнее в рот, мой меткий инженер 🍓");
      return;
    }

    if (!canFeedNow(openedPet, new Date())) {
      setRoomBubble("Подожди пару секунд, я ещё дожёвываю.");
      return;
    }

    const next = applyFeedAction(openedPet, new Date());
    removeFoodItem(foodId);
    await patchPet(openedPetId, next, openedPetId === "liya" ? "Спасибо, стало вкусно и спокойно." : "Еда принята. Перехожу в режим легенды.", "🍓");
  };

  const handleFeedButton = () => {
    if (!openedPet || !isOwner) return;
    if (!canFeedNow(openedPet, new Date())) {
      setRoomBubble("Сейчас рано. Дай мне чуть-чуть переварить.");
      return;
    }
    spawnFoodItems(1);
    setRoomBubble(foodItems.length >= 14 ? "На полотне уже почти максимум вкусняшек 🍓" : "Добавил одну вкусняшку. Тащи её мне в рот 🍓");
  };

  const handleWash = async () => {
    if (!openedPetId || !openedPet || !isOwner) return;
    if (!canWashNow(openedPet, new Date())) {
      setRoomBubble("Мыться можно только раз в час. Я ещё слишком свежий.");
      return;
    }
    setFoodItems([]);
    const next = applyWashAction(openedPet, new Date());
    await patchPet(openedPetId, next, "Я ушёл в ванную на 15 минут 🫧");
  };

  const handleWalk = async () => {
    if (!openedPetId || !openedPet || !isOwner) return;
    if (openedPet.activity !== "idle") {
      setRoomBubble("Сейчас у меня уже есть своё важное дело.");
      return;
    }
    setFoodItems([]);
    const next = applyWalkAction(openedPet, new Date());
    await patchPet(openedPetId, next, `Я пошёл гулять. Вернусь примерно к ${getReturnTimeLabel(next)}.`);
  };

  const handleDoorKnock = async () => {
    if (!openedPetId || !openedPet) return;
    const next = applyDoorKnockAction(openedPet, new Date());
    await patchPet(openedPetId, next, next.activity === "idle" ? "Стук услышан. Я уже вернулся!" : `Я услышал. Может, вернусь чуть раньше — ориентир ${getReturnTimeLabel(next)}.`);
  };

  const updateSquishFromPointer = (event: ReactPointerEvent<HTMLDivElement>, strength = 1) => {
    if (!petStageRef.current) return false;
    const rect = petStageRef.current.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (event.clientY - rect.top) / rect.height;
    if (relativeY > 0.62) {
      resetPetSquish();
      return false;
    }

    setPetSquish({
      scaleX: 1.05 + strength * 0.08,
      scaleY: 0.95 - strength * 0.08,
      x: relativeX * (10 + strength * 6),
      y: 6 + strength * 5,
      rotate: relativeX * (5 + strength * 5)
    });
    return true;
  };

  const handlePetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOwner || !openedPet || openedPet.activity !== "idle") return;
    stopPhysics();
    holdStartAtRef.current = Date.now();
    holdStartPointRef.current = { x: event.clientX, y: event.clientY };
    longPressTriggeredRef.current = false;
    pettingRef.current = true;
    updateSquishFromPointer(event, 0.35);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pettingRef.current || !isOwner || !openedPet || openedPet.activity !== "idle") return;
    const holdStart = holdStartAtRef.current ?? Date.now();
    const heldFor = Date.now() - holdStart;

    if (heldFor >= 240) {
      longPressTriggeredRef.current = true;
      const charge = Math.min(1.8, (heldFor - 240) / 1200);
      if (updateSquishFromPointer(event, 0.95 + charge * 1.45)) {
        void handlePet(1 + Math.round(charge * 2));
      }
      return;
    }

    if (updateSquishFromPointer(event, 0.55)) {
      void handlePet();
    }
  };

  const handlePetPointerRelease = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (!pettingRef.current || !openedPet || openedPet.activity !== "idle") {
      pettingRef.current = false;
      resetPetSquish();
      return;
    }

    const heldFor = holdStartAtRef.current ? Date.now() - holdStartAtRef.current : 0;
    pettingRef.current = false;
    holdStartAtRef.current = null;
    resetPetSquish();

    if (!event || !longPressTriggeredRef.current || heldFor < 240) {
      longPressTriggeredRef.current = false;
      return;
    }

    skipTapRef.current = true;
    const rect = petStageRef.current?.getBoundingClientRect();
    if (!rect) {
      longPressTriggeredRef.current = false;
      return;
    }

    const charge = Math.min(3.4, 0.2 + (heldFor - 240) / 680);
    const dx = event.clientX - holdStartPointRef.current.x;
    const dy = event.clientY - holdStartPointRef.current.y;
    const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
    const verticalBias = (event.clientY - rect.top) / rect.height - 0.5;
    const vx = dx * 0.14 + (relativeX >= 0 ? 1 : -1) * (9 + charge * 19);
    const vy = -16 - charge * 24 - dy * 0.05 + verticalBias * 7;

    startPhysics(vx, vy);
    setRoomBubble(openedPet.id === "liya" ? "Ой! Я полетела по комнате 💫" : "Ты меня натянул как мяч. Лечу во славу абсурда 💫");
    longPressTriggeredRef.current = false;
  };

  const entriesForAchievements = snapshot.entries.filter((entry: (typeof snapshot.entries)[number]) => entry.authorId === openedPet?.ownerId || entry.visibility === "shared");
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const achievementList = openedPet
    ? getAchievements(openedPet, {
        totalEntries: entriesForAchievements.length,
        loveEntries: entriesForAchievements.filter((entry: (typeof entriesForAchievements)[number]) => entry.mode === "love").length,
        workEntries: entriesForAchievements.filter((entry: (typeof entriesForAchievements)[number]) => entry.mode === "work").length,
        sharedEntries: entriesForAchievements.filter((entry: (typeof entriesForAchievements)[number]) => entry.visibility === "shared").length,
        imageEntries: entriesForAchievements.filter((entry: (typeof entriesForAchievements)[number]) => Boolean(entry.imageUrl)).length,
        currentMonthEntries: entriesForAchievements.filter((entry: (typeof entriesForAchievements)[number]) => entry.date.startsWith(currentMonthPrefix)).length
      })
    : [];
  const roomProgress = openedPet ? getLevelProgress(openedPet) : 0;
  const feedDisabled = !openedPet || !isOwner || openedPet.activity !== "idle";
  const washDisabled = !openedPet || !isOwner || openedPet.activity !== "idle";
  const walkDisabled = !openedPet || !isOwner || openedPet.activity !== "idle";
  const homeMotionCycle = Math.floor(nowTick / 15_000) % 4;
  const roomMotion = openedPet ? getRoomMotionProps(animated, openedPet, Math.floor(nowTick / 12_000) % 4, new Date(nowTick)) : null;

  return (
    <>
      <section
        className={cn(
          "rounded-[20px] border p-2 shadow-glass backdrop-blur-2xl sm:rounded-[30px] sm:p-3",
          isPink
            ? "border-white/[0.26] bg-[linear-gradient(180deg,rgba(57,34,49,0.82),rgba(25,16,25,0.92))] text-white shadow-[0_24px_56px_rgba(53,20,42,0.28)]"
            : "border-white/[0.10] bg-[linear-gradient(180deg,rgba(17,28,47,0.88),rgba(6,11,20,0.95))] text-white"
        )}
      >
        <div className="mb-2 text-center sm:mb-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/58">Тамагочи пары</div>
        </div>

        <div className="grid grid-cols-2 gap-1 sm:gap-3">
          <MainCard
            pet={pets.vlad}
            isPink={isPink}
            animated={animated}
            bubble={homeBubbles.vlad}
            isOwner={currentUserId === "vlad"}
            onOpen={() => setOpenedPetId("vlad")}
            motionCycle={homeMotionCycle}
            decorItems={homeDecor.vlad}
            nowTick={nowTick}
          />
          <MainCard
            pet={pets.liya}
            isPink={isPink}
            animated={animated}
            bubble={homeBubbles.liya}
            isOwner={currentUserId === "liya"}
            onOpen={() => setOpenedPetId("liya")}
            motionCycle={homeMotionCycle + 1}
            decorItems={homeDecor.liya}
            nowTick={nowTick}
          />
        </div>
      </section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {openedPet ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[999] isolate h-[100dvh] w-screen overflow-hidden bg-slate-950/98 backdrop-blur-[18px]"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    className={cn(
                      "relative flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-[calc(0.65rem+env(safe-area-inset-top))]",
                      isPink ? "text-white" : "text-white"
                    )}
                  >
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className={cn("absolute inset-0", isPink ? "bg-[radial-gradient(circle_at_top,rgba(43,26,37,0.98),rgba(12,10,16,0.98))]" : "bg-[radial-gradient(circle_at_top,rgba(20,39,63,0.92),rgba(8,13,24,0.98))]")} />
                      <div className={cn("absolute left-1/2 top-[14%] size-[17rem] -translate-x-1/2 rounded-full blur-3xl", isPink ? "bg-pink-400/16" : "bg-sky-400/16")} />
                    </div>

                    <div className="relative z-[1] rounded-[24px] border border-white/[0.12] bg-slate-950/[0.42] px-3 py-2.5 backdrop-blur-2xl">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setOpenedPetId(null)}
                          className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 text-sm text-slate-100"
                        >
                          <ArrowLeft className="size-4" />
                          Назад
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStatsOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 text-sm font-semibold text-slate-100"
                          >
                            <Sparkles className="size-4" />
                            {openedPet.id === "liya" ? "LIYA" : "VLAD"}
                          </button>
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-100/54">уровень</div>
                            <div className="text-lg font-semibold">{openedPet.level}</div>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-full bg-white/[0.10]">
                        <motion.div
                          className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                          animate={{ width: `${Math.max(6, roomProgress * 100)}%` }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </div>
                      <div className="mt-1 text-right text-xs text-slate-300/[0.72]">до следующего уровня: {Math.round(roomProgress * 100)}%</div>
                    </div>

                    <div className="relative z-[1] mt-2 flex flex-1 gap-2 overflow-hidden min-h-0">
                      <div ref={roomRef} className="relative flex-1 overflow-hidden rounded-[26px] border border-white/[0.10] bg-slate-950/[0.30] px-1.5 py-1.5 backdrop-blur-xl sm:rounded-[30px] sm:px-2 sm:py-2">
                        <FloatingPetDecor items={roomDecor} isPink={false} accent="playful" />
                        {openedPet.activity === "walking" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <div className="text-6xl">🚪</div>
                            <button
                              type="button"
                              onClick={() => void handleDoorKnock()}
                              className="rounded-[24px] bg-white/[0.10] px-4 py-3 text-sm font-semibold text-slate-100"
                            >
                              Постучать в дверь
                            </button>
                            <div className="max-w-[17rem] text-center text-sm leading-6 text-slate-300/[0.80]">Вернётся примерно к {getReturnTimeLabel(openedPet)} · осталось {formatRemaining(new Date(openedPet.activityUntil ?? new Date().toISOString()).getTime() - nowTick)}</div>
                          </div>
                        ) : openedPet.activity === "washing" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <div className="text-6xl">🛁</div>
                            <div className="max-w-[15rem] text-center text-sm leading-6 text-slate-300/[0.80]">Моется ещё {formatRemaining(new Date(openedPet.activityUntil ?? new Date().toISOString()).getTime() - nowTick)}</div>
                          </div>
                        ) : null}

                        <div
                          ref={petStageRef}
                          className={cn("absolute inset-x-0 bottom-[6.05rem] top-1.5 flex items-center justify-center px-0.5 sm:bottom-[6.9rem] sm:top-2 sm:px-1", openedPet.activity !== "idle" ? "pointer-events-none opacity-0" : "")}
                          onPointerDown={handlePetPointerDown}
                          onPointerUp={handlePetPointerRelease}
                          onPointerCancel={() => handlePetPointerRelease()}
                          onPointerLeave={() => {
                            if (pettingRef.current && !longPressTriggeredRef.current) {
                              pettingRef.current = false;
                              holdStartAtRef.current = null;
                              resetPetSquish();
                            }
                          }}
                          onPointerMove={handlePetPointerMove}
                          onClick={() => void handleTap()}
                        >
                          <div className="relative flex w-[260px] max-w-full flex-col items-center sm:w-[336px]">
                            <motion.div
                              animate={{ x: petThrowState.x, y: petThrowState.y }}
                              transition={petThrowState.active ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                              className="relative"
                            >
                              <AnimatePresence>
                                {roomBubble ? (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    className="pointer-events-none absolute bottom-[calc(100%+0.2rem)] left-[43%] z-[3] w-[min(62vw,12rem)] -translate-x-1/2 whitespace-pre-line rounded-[18px] border border-white/[0.12] bg-slate-950/[0.92] px-3 py-2 text-center text-[11px] leading-5 text-slate-100 shadow-[0_20px_40px_rgba(0,0,0,0.20)] sm:bottom-[calc(100%+0.35rem)] sm:left-1/2 sm:w-[min(58vw,15rem)] sm:px-4 sm:text-[12px]"
                                  >
                                    {roomBubble}
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                              <motion.div animate={petSquish} transition={{ duration: 0.18, ease: "easeOut" }}>
                                <motion.img
                                  src={roomImage ?? openedPetArtwork ?? getPetArtwork(openedPet, new Date(nowTick), "room")}
                                  alt={openedPet.id === "liya" ? "LIYA" : "VLAD"}
                                  draggable={false}
                                  onError={() => setRoomImage(getPetBaseArtwork(openedPet.id))}
                                  onDragStart={(event) => event.preventDefault()}
                                  className={cn("max-w-full select-none touch-none drop-shadow-[0_24px_34px_rgba(0,0,0,0.20)]", openedPet.id === "liya" ? "w-[208px] sm:w-[316px]" : "w-[218px] sm:w-[328px]")}
                                  animate={roomMotion?.image}
                                  transition={roomMotion?.transition}
                                />
                              </motion.div>
                              <motion.div
                                animate={roomMotion?.shadow}
                                transition={roomMotion?.transition}
                                className="-mt-5 mx-auto h-6 w-36 rounded-full bg-sky-300/18 blur-lg"
                              />
                            </motion.div>

                            <div ref={mouthRef} className="absolute bottom-[4.7rem] left-1/2 h-12 w-20 -translate-x-1/2 rounded-full border border-transparent" />

                            {floatingEffects
                              .filter((item) => item.ownerId === openedPet.id)
                              .map((item) => (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                                  animate={{ opacity: [0, 1, 1, 0], y: [-8 - item.y, -48 - item.y], x: [item.x, item.x + (item.x >= 0 ? 14 : -14)], scale: [0.8, 1.14, 1] }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 1.2, ease: "easeOut" }}
                                  className="pointer-events-none absolute left-1/2 top-12 z-[4] text-2xl"
                                >
                                  {item.emoji}
                                </motion.div>
                              ))}
                          </div>
                        </div>

                        {openedPet.activity === "idle"
                          ? foodItems.map((item) => (
                              <motion.button
                                key={item.id}
                                type="button"
                                drag
                                dragMomentum={false}
                                onDragEnd={(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void handleFeedDrop(item.id, info)}
                                initial={{ scale: 0.82, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="absolute z-[5] rounded-full bg-slate-950/[0.84] px-3 py-2 text-3xl shadow-[0_18px_34px_rgba(0,0,0,0.18)]"
                                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                              >
                                {item.emoji}
                              </motion.button>
                            ))
                          : null}

                        <div className="absolute inset-x-0 bottom-0 space-y-1 px-1 pb-1">
                          <div className="grid grid-cols-4 gap-1">
                            {BAR_META.map((item) => (
                              <div key={item.key} className="rounded-[13px] bg-white/[0.06] px-1 py-1.5 text-center text-slate-200">
                                <div className="text-[13px]">{item.emoji}</div>
                                <div className="text-[7px] uppercase tracking-[0.12em]">{item.label}</div>
                                <div className="mt-0.5 text-[12px] font-semibold">{openedPet[item.key]}%</div>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-[15px] bg-white/[0.06] px-2.5 py-2 text-[10px] leading-4.5 text-slate-200">{getTodaySummary(openedPet)}</div>
                        </div>
                      </div>

                      <div className="flex w-[62px] flex-col gap-1.5 sm:w-[92px]">
                        <button
                          type="button"
                          disabled={feedDisabled}
                          onClick={handleFeedButton}
                          className={cn(
                            "flex min-h-[54px] flex-col items-center justify-center rounded-[20px] border px-2 py-2.5 text-center text-[11px] font-semibold backdrop-blur-2xl transition sm:min-h-[72px] sm:rounded-[24px] sm:py-3 sm:text-xs",
                            feedDisabled ? "opacity-60" : "active:scale-95",
                            "border-white/[0.10] bg-white/[0.06] text-slate-100"
                          )}
                        >
                          <UtensilsCrossed className="mb-1 size-5" />
                          Еда
                        </button>
                        <button
                          type="button"
                          disabled={washDisabled}
                          onClick={() => void handleWash()}
                          className={cn(
                            "flex min-h-[54px] flex-col items-center justify-center rounded-[20px] border px-2 py-2.5 text-center text-[11px] font-semibold backdrop-blur-2xl transition sm:min-h-[72px] sm:rounded-[24px] sm:py-3 sm:text-xs",
                            washDisabled ? "opacity-60" : "active:scale-95",
                            "border-white/[0.10] bg-white/[0.06] text-slate-100"
                          )}
                        >
                          <Bath className="mb-1 size-5" />
                          Мыться
                        </button>
                        <button
                          type="button"
                          disabled={walkDisabled}
                          onClick={() => void handleWalk()}
                          className={cn(
                            "flex min-h-[54px] flex-col items-center justify-center rounded-[20px] border px-2 py-2.5 text-center text-[11px] font-semibold backdrop-blur-2xl transition sm:min-h-[72px] sm:rounded-[24px] sm:py-3 sm:text-xs",
                            walkDisabled ? "opacity-60" : "active:scale-95",
                            "border-white/[0.10] bg-white/[0.06] text-slate-100"
                          )}
                        >
                          <Footprints className="mb-1 size-5" />
                          Гулять
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatsOpen(true)}
                          className="flex min-h-[54px] flex-col items-center justify-center rounded-[20px] border border-white/[0.10] bg-white/[0.06] px-2 py-2.5 text-center text-[11px] font-semibold text-slate-100 backdrop-blur-2xl transition active:scale-95 sm:min-h-[72px] sm:rounded-[24px] sm:py-3 sm:text-xs"
                        >
                          <Sparkles className="mb-1 size-5" />
                          Ещё
                        </button>
                        
                      </div>
                    </div>
              <AnimatePresence>
                {statsOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-x-0 bottom-0 top-0 z-[8] rounded-[30px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-4"
                    style={{ background: isPink ? "rgba(255,255,255,0.92)" : "rgba(8,14,26,0.92)", borderColor: isPink ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.12)" }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className={cn("text-[10px] uppercase tracking-[0.28em]", isPink ? "text-pink-500/[0.72]" : "text-sky-200/[0.62]")}>статистика тамагочи</div>
                        <div className="mt-1 text-lg font-semibold">{openedPet.id === "liya" ? "LIYA" : "VLAD"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatsOpen(false)}
                        className={cn("rounded-full px-3 py-2 text-sm", isPink ? "bg-[#fff4fa] text-pink-700" : "bg-white/[0.08] text-slate-100")}
                      >
                        Закрыть
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatsTab("summary")}
                        className={cn(
                          "rounded-[20px] px-3 py-3 text-sm font-semibold",
                          statsTab === "summary"
                            ? isPink
                              ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                              : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
                            : isPink
                              ? "bg-white/[0.76] text-pink-700"
                              : "bg-white/[0.08] text-slate-100"
                        )}
                      >
                        <span className="inline-flex items-center gap-2"><Sparkles className="size-4" /> Статистика</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatsTab("achievements")}
                        className={cn(
                          "rounded-[20px] px-3 py-3 text-sm font-semibold",
                          statsTab === "achievements"
                            ? isPink
                              ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white"
                              : "bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950"
                            : isPink
                              ? "bg-white/[0.76] text-pink-700"
                              : "bg-white/[0.08] text-slate-100"
                        )}
                      >
                        <span className="inline-flex items-center gap-2"><Trophy className="size-4" /> Достижения</span>
                      </button>
                    </div>

                    <div className="max-h-[calc(100%-7rem)] overflow-y-auto pr-1 [scrollbar-width:none]">
                      {statsTab === "summary" ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">дней</div><div className="mt-1 text-xl font-semibold">{getTamagotchiAgeDays(openedPet)}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">стрик</div><div className="mt-1 text-xl font-semibold">{openedPet.streakDays}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">тапы</div><div className="mt-1 text-xl font-semibold">{openedPet.totalTaps}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">уход</div><div className="mt-1 text-xl font-semibold">{openedPet.totalCare}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">еда</div><div className="mt-1 text-xl font-semibold">{openedPet.totalFeeds}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">прогулки</div><div className="mt-1 text-xl font-semibold">{openedPet.totalWalks}</div></div>
                          </div>

                          <div className="rounded-[18px] bg-white/[0.06] px-3 py-3">
                            <div className="mb-2 text-sm font-semibold">Как прошёл день</div>
                            <div className="text-sm leading-6 text-slate-200">{getTodaySummary(openedPet)}</div>
                          </div>

                          <div className="rounded-[18px] bg-white/[0.06] px-3 py-3">
                            <div className="mb-2 text-sm font-semibold">Шкалы</div>
                            <div className="space-y-2.5">
                              <RoomBar label="Сытость" value={openedPet.hunger} isPink={false} />
                              <RoomBar label="Чистота" value={openedPet.cleanliness} isPink={false} />
                              <RoomBar label="Счастье" value={openedPet.joy} isPink={false} />
                              <RoomBar label="Бодрость" value={openedPet.energy} isPink={false} />
                              <RoomBar label="Ласка" value={openedPet.affection} isPink={false} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">ванных</div><div className="mt-1 text-lg font-semibold">{openedPet.totalBaths}</div></div>
                            <div className="rounded-[18px] bg-white/[0.06] px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/70">сейчас</div><div className="mt-1 text-lg font-semibold">{openedPet.activity === "idle" ? "дома" : getReturnTimeLabel(openedPet)}</div></div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {achievementList.map((item) => (
                            <div
                              key={item.key}
                              className={cn(
                                "rounded-[18px] border px-3 py-2.5",
                                item.unlocked ? "border-sky-400/20 bg-sky-400/10" : "border-white/[0.10] bg-white/[0.04]"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold">{item.title}</div>
                                  <div className="mt-1 text-[13px] leading-5 text-slate-300/[0.82]">{item.description}</div>
                                </div>
                                <div className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", item.unlocked ? "bg-emerald-500 text-white" : "bg-white/[0.08] text-slate-200")}>{item.unlocked ? "готово" : "в пути"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body
    )
  : null}
    </>
  );
};

import { daysBetween, todayKey } from "@/lib/date";
import type { TamagotchiMood, TamagotchiState, UserId } from "@/types";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const FOOD_COOLDOWN_MS = 12_000;
const WASH_COOLDOWN_MS = 60 * 60 * 1000;
const WASH_DURATION_MS = 15 * 60 * 1000;
const WALK_SHORT_MS = 30 * 60 * 1000;
const WALK_MID_MS = 2.5 * 60 * 60 * 1000;
const WALK_LONG_MS = 5.5 * 60 * 60 * 1000;

const LIYA_SUPPORT_PHRASES = [
  "Я рядом, можно просто выдохнуть.",
  "Давай спокойно, без спешки.",
  "Можно тихо отдохнуть вместе.",
  "Ты молодец, даже когда устал(а).",
  "Сегодня режим мягкости и заботы.",
  "С тобой очень уютно молчать.",
  "Немного ласки, и мир уже лучше.",
  "Я верю в тебя, даже сонненькая.",
  "Побуду рядом и поддержу тебя тихонько.",
  "Давай жить этот день медленно и бережно.",
  "Я немного сонная, но поддержка включена.",
  "Можно просто быть рядом, этого уже достаточно.",
  "Отдых — тоже важное дело, не забывай.",
  "Я сохранила для тебя маленький кусочек уюта.",
  "Мягкий режим активирован. Спешка отменяется."
];

const VLAD_JOKE_PHRASES = [
  "Я устал, но всё ещё официальная служба поддержки абсурда.",
  "Мой внутренний пельмень верит в тебя и просит воды.",
  "Если день кривой, давай победим его под смешным углом.",
  "Я одобрил твоё существование и добавил к нему бонусный уют.",
  "Погладь меня, и я включу режим космической булочки поддержки.",
  "Сегодня я мягкий эксперт по выживанию и странным идеям.",
  "Мне бы вкусняшку и философию холодильника на десерт.",
  "Я не грущу, я просто экономно мерцаю батарейкой.",
  "Поддержка активирована. Где-то уже хлопают невидимые фанфары.",
  "Я маленький амбассадор отдыха, чая и нелепой надежды.",
  "Я немного уставший, но поддержка уже выехала на табуретке.",
  "Мой запас сил на нуле, зато запас странной веры в нас отличный.",
  "Если станет грустно, я достану аварийную смешную мысль.",
  "Я как чайник поддержки: чуть шумный, но полезный.",
  "Сегодня я в режиме сонного гения с лицензией на обнимашки."
];

const FOOD_EMOJIS = ["🍓", "🍪", "🍜", "🍉", "🧁", "🍕"];

export const getRandomFoodEmoji = (seed = Date.now()) => FOOD_EMOJIS[Math.abs(seed) % FOOD_EMOJIS.length] ?? "🍓";

const experienceForLevel = (level: number) => Math.min(72, 10 + level * 4);
const isoPlusMs = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();
const msUntil = (iso?: string, now = new Date()) => {
  if (!iso) return 0;
  return new Date(iso).getTime() - now.getTime();
};

const markCare = (pet: TamagotchiState, nowIso: string) => {
  const today = todayKey();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (pet.lastCareDate === today) {
    return {
      ...pet,
      caredToday: true,
      updatedAt: nowIso
    };
  }

  const streakDays = pet.lastCareDate === yesterday ? pet.streakDays + 1 : 1;

  return {
    ...pet,
    caredToday: true,
    lastCareDate: today,
    streakDays,
    updatedAt: nowIso
  };
};

const gainXp = (pet: TamagotchiState, amount: number) => {
  let level = pet.level;
  let xp = pet.xp + amount;

  while (xp >= experienceForLevel(level)) {
    xp -= experienceForLevel(level);
    level += 1;
  }

  return {
    ...pet,
    level,
    xp,
    totalXp: pet.totalXp + amount
  };
};

export const createDefaultTamagotchi = (userId: UserId, now = new Date().toISOString()): TamagotchiState => ({
  id: userId,
  ownerId: userId,
  name: userId === "liya" ? "Тамагочи Лии" : "Тамагочи Влада",
  variant: userId,
  level: 1,
  xp: 0,
  totalXp: 0,
  totalTaps: 0,
  totalCare: 0,
  totalFeeds: 0,
  totalBaths: 0,
  totalWalks: 0,
  affection: userId === "liya" ? 68 : 60,
  hunger: 78,
  cleanliness: userId === "liya" ? 82 : 74,
  joy: userId === "liya" ? 84 : 76,
  energy: userId === "liya" ? 78 : 74,
  mood: "happy",
  activity: "idle",
  bornAt: now,
  streakDays: 0,
  caredToday: false,
  doorKnocks: 0,
  updatedAt: now,
  lastTapAt: now
});

export const ensureTamagotchis = (tamagotchis: Partial<Record<UserId, TamagotchiState>> | undefined, now = new Date().toISOString()) => ({
  vlad: normalizeTamagotchi(tamagotchis?.vlad, "vlad", now),
  liya: normalizeTamagotchi(tamagotchis?.liya, "liya", now)
});

export const normalizeTamagotchi = (
  value: TamagotchiState | undefined,
  userId: UserId,
  now = new Date().toISOString()
): TamagotchiState => {
  const base = createDefaultTamagotchi(userId, now);
  const merged: TamagotchiState = {
    ...base,
    ...value,
    id: userId,
    ownerId: userId,
    variant: userId,
    name: value?.name?.trim() || base.name,
    bornAt: value?.bornAt || base.bornAt,
    updatedAt: value?.updatedAt || value?.lastTapAt || now,
    streakDays: value?.streakDays ?? base.streakDays,
    caredToday: value?.caredToday ?? base.caredToday,
    doorKnocks: value?.doorKnocks ?? base.doorKnocks
  };

  return resolveTamagotchi(merged, new Date(now));
};

const computeMood = (pet: TamagotchiState, now: Date): TamagotchiMood => {
  const hour = now.getHours();

  if (pet.activity === "walking") return pet.joy >= 60 ? "happy" : "neutral";
  if (pet.activity === "washing") return pet.energy <= 30 ? "tired" : "neutral";
  if (pet.energy <= 32) return "tired";
  if (hour >= 0 && hour <= 6 && pet.energy <= 72) return "tired";
  if (pet.hunger <= 22 || pet.cleanliness <= 18) return "angry";
  if (pet.joy <= 28) return "sad";
  if (pet.joy >= 72 && pet.hunger >= 48 && pet.cleanliness >= 48) return "happy";
  return "neutral";
};

export const resolveTamagotchi = (pet: TamagotchiState, now = new Date()): TamagotchiState => {
  const previousTime = new Date(pet.updatedAt || now.toISOString()).getTime();
  const elapsedMs = Math.max(0, now.getTime() - previousTime);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const today = todayKey();

  let next: TamagotchiState = { ...pet };

  if (elapsedHours > 0) {
    const hungerDecay = next.activity === "walking" ? 10.5 : next.activity === "washing" ? 6 : 7.5;
    const cleanDecay = next.activity === "walking" ? 7.5 : next.activity === "washing" ? 0.5 : 5.2;
    const joyDecay = next.activity === "walking" ? 2.5 : next.activity === "washing" ? 1.2 : 4.6;
    const energyDelta = next.activity === "walking" ? -8.5 : next.activity === "washing" ? 5.2 : now.getHours() >= 0 && now.getHours() <= 6 ? 8 : -3.4;

    next = {
      ...next,
      hunger: clamp(next.hunger - elapsedHours * hungerDecay),
      cleanliness: clamp(next.cleanliness - elapsedHours * cleanDecay),
      joy: clamp(next.joy - elapsedHours * joyDecay),
      affection: clamp(next.affection - elapsedHours * 1.1),
      energy: clamp(next.energy + elapsedHours * energyDelta)
    };
  }

  if (next.lastCareDate !== today) {
    next.caredToday = false;
  }

  const remainingActivityMs = msUntil(next.activityUntil, now);
  if (next.activity !== "idle" && remainingActivityMs <= 0) {
    if (next.activity === "walking") {
      next.joy = clamp(next.joy + 18);
      next.hunger = clamp(next.hunger - 8);
      next.cleanliness = clamp(next.cleanliness - 4);
      next.energy = clamp(next.energy - 8);
    }

    if (next.activity === "washing") {
      next.cleanliness = clamp(next.cleanliness + 28);
      next.joy = clamp(next.joy + 4);
      next.energy = clamp(next.energy + 8);
    }

    next.activity = "idle";
    next.activityUntil = undefined;
    next.activityStartedAt = undefined;
  }

  next.mood = computeMood(next, now);
  next.updatedAt = now.toISOString();
  return next;
};

export const getLevelProgress = (pet: TamagotchiState) => {
  const need = experienceForLevel(pet.level);
  return Math.max(0, Math.min(1, pet.xp / need));
};

export const getTamagotchiAgeDays = (pet: TamagotchiState) => daysBetween(pet.bornAt.slice(0, 10));

export const getNeedEmoji = (pet: TamagotchiState) => {
  if (pet.activity === "walking") return "🚪";
  if (pet.activity === "washing") return "🫧";
  if (pet.energy <= 35) return "😴";
  if (pet.hunger <= 35) return "🍜";
  if (pet.cleanliness <= 35) return "🫧";
  if (pet.joy <= 35) return "🥺";
  if (pet.mood === "angry") return "💢";
  if (pet.mood === "tired") return "😴";
  return "💗";
};

export const getStatusLabel = (pet: TamagotchiState, now = new Date()) => {
  const left = msUntil(pet.activityUntil, now);

  if (pet.activity === "walking") {
    return `Гуляет • ${formatRemaining(left)}`;
  }

  if (pet.activity === "washing") {
    return `Моется • ${formatRemaining(left)}`;
  }

  switch (pet.mood) {
    case "happy":
      return "В хорошем настроении";
    case "neutral":
      return "Спокойный режим";
    case "sad":
      return "Хочет внимания";
    case "angry":
      return "Капризничает";
    case "tired":
      return "Немного устал";
    default:
      return "Ждёт тебя";
  }
};

export const getMoodEmoji = (pet: TamagotchiState) => {
  switch (pet.mood) {
    case "happy":
      return "💖";
    case "neutral":
      return "✨";
    case "sad":
      return "🥺";
    case "angry":
      return "💢";
    case "tired":
      return "😴";
    default:
      return "💗";
  }
};

const seededIndex = (seed: number, length: number) => {
  if (length <= 0) return 0;
  return Math.abs(Math.floor(seed)) % length;
};

export const getTamagotchiPhrase = (pet: TamagotchiState, context: "home" | "room", now = new Date()) => {
  if (pet.activity === "walking") {
    return pet.variant === "liya" ? "Я гуляю и отдыхаю от суеты." : "Я ушёл гулять по делам вселенской важности.";
  }

  if (pet.activity === "washing") {
    return pet.variant === "liya" ? "Я в ванной и становлюсь ещё уютнее." : "Пена важнее спешки. Это мой банный манифест.";
  }

  if (pet.hunger <= 30) {
    return pet.variant === "liya" ? "Можно мне что-нибудь вкусное?" : "Мне нужна подпитка для великих и немного нелепых идей.";
  }

  if (pet.cleanliness <= 30) {
    return pet.variant === "liya" ? "Хочу немного чистоты и тишины." : "Мне бы банный апдейт космического класса.";
  }

  if (pet.joy <= 30) {
    return pet.variant === "liya" ? "Погладь меня, и станет мягче." : "Я немного притих. Дай ласки, и я снова заискрюсь.";
  }

  const hour = now.getHours();
  const night = hour >= 23 || hour < 7;
  const morning = hour >= 7 && hour < 12;

  if (pet.variant === "liya") {
    if (pet.energy <= 52) return night ? "Я сонная и тихая. Давай просто побудем рядом." : "Я немного устала и хочу спокойствия.";
    if (night) return "Ночь мягкая. Я в спокойном режиме рядом с тобой.";
    if (morning) return "Доброе утро. Начнём день очень бережно.";
    if (pet.mood === "neutral" && context === "home") return "Я отдыхаю и наблюдаю за днём тихонько.";
  } else {
    if (pet.energy <= 64) return night ? "Я устал, но всё ещё твой ночной герой поддержки." : "Я немного устал, но поддержку доставлю без задержек.";
    if (night) return "Ночной режим включён. Я официальный комочек тишины.";
    if (morning) return "Утро пришло. Я уже морально поддержал нас обоих.";
    if (pet.mood === "neutral" && context === "home") return "Я отдыхаю с важным видом и абсурдной пользой.";
  }

  const seed = Math.floor(now.getTime() / (context === "home" ? 600000 : 240000));
  const pool = pet.variant === "liya" ? LIYA_SUPPORT_PHRASES : VLAD_JOKE_PHRASES;
  return pool[seededIndex(seed + (pet.variant === "liya" ? 3 : 11), pool.length)] ?? pool[0] ?? "Привет.";
};

export const applyTapAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);
  next = gainXp(next, 1);
  next.totalTaps += 1;
  next.joy = clamp(next.joy + 2);
  next.affection = clamp(next.affection + 1);
  next.energy = clamp(next.energy - 1);
  next.lastTapAt = now.toISOString();
  next.updatedAt = now.toISOString();
  next.mood = computeMood(next, now);
  return next;
};

export const applyPetAction = (pet: TamagotchiState, now = new Date(), intensity = 1) => {
  const power = Math.max(1, Math.min(4, Math.round(intensity)));
  let next = resolveTamagotchi(pet, now);
  next = gainXp(next, 2 + power);
  next.totalCare += 1;
  next.joy = clamp(next.joy + 4 + power * 2);
  next.affection = clamp(next.affection + 5 + power * 3);
  next.energy = clamp(next.energy + 2 + power);
  next.lastPetAt = now.toISOString();
  next.updatedAt = now.toISOString();
  next = markCare(next, now.toISOString());
  next.mood = computeMood(next, now);
  return next;
};

export const canFeedNow = (pet: TamagotchiState, now = new Date()) => {
  if (pet.activity !== "idle") return false;
  if (!pet.lastFedAt) return true;
  return now.getTime() - new Date(pet.lastFedAt).getTime() >= FOOD_COOLDOWN_MS;
};

export const canWashNow = (pet: TamagotchiState, now = new Date()) => {
  if (pet.activity !== "idle") return false;
  if (!pet.lastWashedAt) return true;
  return now.getTime() - new Date(pet.lastWashedAt).getTime() >= WASH_COOLDOWN_MS;
};

export const applyFeedAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);
  next = gainXp(next, 5);
  next.totalCare += 1;
  next.totalFeeds += 1;
  next.hunger = clamp(next.hunger + 26);
  next.joy = clamp(next.joy + 5);
  next.affection = clamp(next.affection + 2);
  next.energy = clamp(next.energy + 6);
  next.lastFedAt = now.toISOString();
  next.updatedAt = now.toISOString();
  next = markCare(next, now.toISOString());
  next.mood = computeMood(next, now);
  return next;
};

const walkDurationByMood = (pet: TamagotchiState, now: Date) => {
  if (pet.mood === "happy" && pet.joy >= 70) return WALK_SHORT_MS + ((now.getMinutes() + 7) % 30) * 60 * 1000;
  if (pet.mood === "angry" || pet.hunger <= 28 || pet.cleanliness <= 24) return WALK_LONG_MS + (now.getMinutes() % 35) * 60 * 1000;
  return WALK_MID_MS + ((now.getMinutes() + 11) % 75) * 60 * 1000;
};

export const applyWalkAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);
  const duration = walkDurationByMood(next, now);
  next = gainXp(next, 6);
  next.totalCare += 1;
  next.totalWalks += 1;
  next.activity = "walking";
  next.activityStartedAt = now.toISOString();
  next.activityUntil = isoPlusMs(now.toISOString(), duration);
  next.joy = clamp(next.joy + 4);
  next.affection = clamp(next.affection + 2);
  next.energy = clamp(next.energy - 8);
  next.updatedAt = now.toISOString();
  next = markCare(next, now.toISOString());
  next.mood = computeMood(next, now);
  return next;
};

export const applyWashAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);
  next = gainXp(next, 4);
  next.totalCare += 1;
  next.totalBaths += 1;
  next.activity = "washing";
  next.activityStartedAt = now.toISOString();
  next.activityUntil = isoPlusMs(now.toISOString(), WASH_DURATION_MS);
  next.cleanliness = clamp(next.cleanliness + 16);
  next.energy = clamp(next.energy + 4);
  next.lastWashedAt = now.toISOString();
  next.updatedAt = now.toISOString();
  next = markCare(next, now.toISOString());
  next.mood = computeMood(next, now);
  return next;
};

export const applyDoorKnockAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);

  if (next.activity !== "walking" || !next.activityUntil) {
    return next;
  }

  next.doorKnocks += 1;
  const remaining = msUntil(next.activityUntil, now);
  const seed = (now.getMinutes() + 1) * (next.doorKnocks + 2);
  const lucky = seed % 3 === 0;

  if (remaining <= 20 * 60 * 1000 || lucky) {
    next.activityUntil = now.toISOString();
  } else {
    const cutMs = (10 + (seed % 20)) * 60 * 1000;
    next.activityUntil = new Date(new Date(next.activityUntil).getTime() - cutMs).toISOString();
  }

  next.updatedAt = now.toISOString();
  return resolveTamagotchi(next, now);
};

export const applyDeveloperReturnAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);

  if (next.activity === "idle") {
    return next;
  }

  if (next.activity === "walking") {
    next.joy = clamp(next.joy + 10);
    next.affection = clamp(next.affection + 3);
    next.energy = clamp(next.energy + 4);
  }

  if (next.activity === "washing") {
    next.cleanliness = clamp(next.cleanliness + 18);
    next.joy = clamp(next.joy + 4);
    next.energy = clamp(next.energy + 6);
  }

  next.activity = "idle";
  next.activityUntil = undefined;
  next.activityStartedAt = undefined;
  next.updatedAt = now.toISOString();
  next.mood = computeMood(next, now);
  return next;
};

export const applyDeveloperSkipTimeAction = (pet: TamagotchiState, now = new Date()) => {
  let next = resolveTamagotchi(pet, now);

  if (next.activity === "idle") {
    return next;
  }

  next.activityUntil = now.toISOString();
  next.updatedAt = now.toISOString();
  return resolveTamagotchi(next, now);
};

export const formatRemaining = (ms: number) => {
  if (ms <= 0) return "уже скоро";
  const totalMinutes = Math.max(1, Math.ceil(ms / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
};

export const getReturnTimeLabel = (pet: TamagotchiState) => {
  if (!pet.activityUntil) return "Сейчас рядом";
  const date = new Date(pet.activityUntil);
  return `${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
};

export const getTodaySummary = (pet: TamagotchiState) => {
  if (pet.activity === "walking") {
    return `Сейчас на прогулке и ориентировочно вернётся к ${getReturnTimeLabel(pet)}.`;
  }

  if (pet.activity === "washing") {
    return "Сейчас занят ванной и скоро снова появится в комнате.";
  }

  if (pet.energy <= 35) {
    return "Сегодня накопилась усталость — немного отдыха и ласки быстро помогут.";
  }

  if (pet.joy >= 70 && pet.hunger >= 50 && pet.cleanliness >= 50 && pet.energy >= 52) {
    return "День идёт приятно: настроение хорошее, сил хватает, заботы чувствуется много.";
  }

  if (pet.hunger <= 35) {
    return "Сегодня чуть не хватает еды — вкусняшка заметно поднимет настроение.";
  }

  if (pet.cleanliness <= 35) {
    return "Хочется освежиться и вернуться красивым и довольным.";
  }

  if (pet.joy <= 35) {
    return "Сегодня нужен лишний тап и немного ласки, чтобы день снова стал мягче.";
  }

  return "Спокойный день: немного внимания, и всё будет совсем хорошо.";
};

export const getAchievements = (
  pet: TamagotchiState,
  extras?: {
    totalEntries?: number;
    loveEntries?: number;
    workEntries?: number;
    sharedEntries?: number;
    imageEntries?: number;
    currentMonthEntries?: number;
  }
) => {
  const stats = {
    totalEntries: extras?.totalEntries ?? 0,
    loveEntries: extras?.loveEntries ?? 0,
    workEntries: extras?.workEntries ?? 0,
    sharedEntries: extras?.sharedEntries ?? 0,
    imageEntries: extras?.imageEntries ?? 0,
    currentMonthEntries: extras?.currentMonthEntries ?? 0
  };

  return [
    {
      key: "tap-1",
      title: "Первый привет",
      description: "Тапнуть по тамагочи хотя бы один раз.",
      unlocked: pet.totalTaps >= 1
    },
    {
      key: "care-5",
      title: "Забота дня",
      description: "Сделать 5 действий ухода суммарно.",
      unlocked: pet.totalCare >= 5
    },
    {
      key: "feed-3",
      title: "Кормилец",
      description: "Покормить 3 раза.",
      unlocked: pet.totalFeeds >= 3
    },
    {
      key: "wash-1",
      title: "Чистюля",
      description: "Отправить тамагочи мыться.",
      unlocked: pet.totalBaths >= 1
    },
    {
      key: "walk-2",
      title: "Прогульщик",
      description: "Отправить гулять 2 раза.",
      unlocked: pet.totalWalks >= 2
    },
    {
      key: "energy-70",
      title: "Выспался",
      description: "Поднять бодрость до 70 и выше.",
      unlocked: pet.energy >= 70
    },
    {
      key: "affection-80",
      title: "Любимчик",
      description: "Довести ласку до 80.",
      unlocked: pet.affection >= 80
    },
    {
      key: "level-5",
      title: "Растём",
      description: "Достигнуть 5 уровня.",
      unlocked: pet.level >= 5
    },
    {
      key: "streak-3",
      title: "Три дня рядом",
      description: "Ухаживать 3 дня подряд.",
      unlocked: pet.streakDays >= 3
    },
    {
      key: "calendar-1",
      title: "Запись в сердце",
      description: "Иметь хотя бы 1 запись в календаре.",
      unlocked: stats.totalEntries >= 1
    },
    {
      key: "calendar-10",
      title: "История пары",
      description: "Собрать 10 записей в календаре.",
      unlocked: stats.totalEntries >= 10
    },
    {
      key: "love-5",
      title: "Романтичный архив",
      description: "Собрать 5 любовных записей.",
      unlocked: stats.loveEntries >= 5
    },
    {
      key: "work-5",
      title: "Рабочий ритм",
      description: "Собрать 5 рабочих записей.",
      unlocked: stats.workEntries >= 5
    },
    {
      key: "shared-5",
      title: "Вместе записали",
      description: "Накопить 5 общих записей.",
      unlocked: stats.sharedEntries >= 5
    },
    {
      key: "gallery-3",
      title: "Кадры памяти",
      description: "Добавить 3 записи с фото.",
      unlocked: stats.imageEntries >= 3
    },
    {
      key: "month-6",
      title: "Активный месяц",
      description: "Сделать 6 записей за текущий месяц.",
      unlocked: stats.currentMonthEntries >= 6
    },
    {
      key: "calendar-20",
      title: "Большая история",
      description: "Собрать 20 записей в календаре.",
      unlocked: stats.totalEntries >= 20
    },
    {
      key: "shared-12",
      title: "Пара в ритме",
      description: "Накопить 12 общих записей.",
      unlocked: stats.sharedEntries >= 12
    },
    {
      key: "gallery-8",
      title: "Фотоархив пары",
      description: "Добавить 8 записей с фото.",
      unlocked: stats.imageEntries >= 8
    },
    {
      key: "love-12",
      title: "Романтический сезон",
      description: "Собрать 12 любовных записей.",
      unlocked: stats.loveEntries >= 12
    },
    {
      key: "work-12",
      title: "Рабочий массив",
      description: "Собрать 12 рабочих записей.",
      unlocked: stats.workEntries >= 12
    },
    {
      key: "month-15",
      title: "Плотный месяц",
      description: "Сделать 15 записей за текущий месяц.",
      unlocked: stats.currentMonthEntries >= 15
    },
    {
      key: "calendar-40",
      title: "Хроника отношений",
      description: "Собрать 40 записей в календаре.",
      unlocked: stats.totalEntries >= 40
    },
    {
      key: "love-24",
      title: "Любовный архив",
      description: "Собрать 24 любовные записи.",
      unlocked: stats.loveEntries >= 24
    },
    {
      key: "work-24",
      title: "Рабочая вселенная",
      description: "Собрать 24 рабочие записи.",
      unlocked: stats.workEntries >= 24
    },
    {
      key: "shared-24",
      title: "Синхрон пары",
      description: "Накопить 24 общих записи.",
      unlocked: stats.sharedEntries >= 24
    },
    {
      key: "gallery-16",
      title: "Галерея воспоминаний",
      description: "Добавить 16 записей с фото.",
      unlocked: stats.imageEntries >= 16
    },
    {
      key: "month-24",
      title: "Месяц без пропусков",
      description: "Сделать 24 записи за текущий месяц.",
      unlocked: stats.currentMonthEntries >= 24
    },
    {
      key: "streak-14",
      title: "Две недели рядом",
      description: "Ухаживать 14 дней подряд.",
      unlocked: pet.streakDays >= 14
    }
  ];
};

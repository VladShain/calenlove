export type UserId = "vlad" | "liya";
export type CalendarMode = "love" | "work";
export type ThemeMode = "luxuryBlue" | "whitePink" | "darkRed" | "blackout";
export type PageKey = "calendar" | "gallery" | "soon" | "settings";
export type NotificationType = "plan" | "login" | "system" | "story" | "mood";
export type NotificationCategory = "story" | "entry" | "mood" | "other";
export type EntryVisibility = "shared" | "private";
export type BottleTone = "rose" | "mint" | "sky" | "sunset" | "lavender";
export type TamagotchiMood = "happy" | "neutral" | "sad" | "angry" | "tired";
export type TamagotchiActivity = "idle" | "walking" | "washing";

export interface UserAccount {
  id: UserId;
  nickname: string;
  login: string;
  password: string;
}

export interface WorkPreset {
  id: string;
  title: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  paidHours: string;
  bonus: number;
  expenses: number;
  color: string;
  icon: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkEntryMeta {
  presetId?: string;
  color?: string;
  icon?: string;
  scheduleLabel?: string;
  rateLabel?: string;
  note?: string;
}

export interface CalendarEntry {
  id: string;
  date: string;
  mode: CalendarMode;
  title: string;
  text: string;
  previewText: string;
  visibility: EntryVisibility;
  authorId: UserId;
  imageUrl?: string;
  imageName?: string;
  createdAt: string;
  updatedAt: string;
  viewedBy?: UserId[];
  workMeta?: WorkEntryMeta;
}

export interface NotificationItem {
  id: string;
  createdAt: string;
  authorId: UserId;
  targetUserId?: UserId;
  message: string;
  read: boolean;
  type: NotificationType;
  category?: NotificationCategory;
  date?: string;
  mode?: CalendarMode;
  entryId?: string;
  moodBefore?: MoodBottle;
  moodAfter?: MoodBottle;
}

export interface LoginHistoryItem {
  id: string;
  userId: UserId;
  loginAt: string;
  platform: string;
}

export interface MoodBottle {
  label: string;
  emoji: string;
  tone: BottleTone;
  level: number;
}

export interface TamagotchiState {
  id: UserId;
  ownerId: UserId;
  name: string;
  variant: "liya" | "vlad";
  level: number;
  xp: number;
  totalXp: number;
  totalTaps: number;
  totalCare: number;
  totalFeeds: number;
  totalBaths: number;
  totalWalks: number;
  affection: number;
  hunger: number;
  cleanliness: number;
  joy: number;
  energy: number;
  mood: TamagotchiMood;
  activity: TamagotchiActivity;
  activityUntil?: string;
  activityStartedAt?: string;
  lastFedAt?: string;
  lastWashedAt?: string;
  lastPetAt?: string;
  lastTapAt?: string;
  lastCareDate?: string;
  bornAt: string;
  streakDays: number;
  caredToday: boolean;
  doorKnocks: number;
  updatedAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  relationStartDate: string;
  pinEnabled: boolean;
  pinCode: string;
  backgroundImage?: string;
  backgroundImageName?: string;
  privacyMode: "romantic" | "minimal";
  lastCloudSyncAt?: string;
  developerCloudStatus: "local" | "cloud-online" | "cloud-error" | "cloud-pending";
  notificationsEnabled: boolean;
  pendingCloudSync: boolean;
  moodBottles: Record<UserId, MoodBottle>;
  themeChosen: boolean;
  optimizationLiteMode: boolean;
  optimizationGlass: boolean;
  optimizationAnimations: boolean;
  optimizationDecor: boolean;
  backgroundDecorBlur: number;
  workPresets: WorkPreset[];
  tamagotchis: Record<UserId, TamagotchiState>;
}

export interface DeveloperState {
  lastCloudError?: string;
  lastCloudMessage?: string;
  isCloudConfigured: boolean;
  isSyncing: boolean;
}

export interface AppSnapshot {
  version: string;
  users: Record<UserId, UserAccount>;
  entries: CalendarEntry[];
  notifications: NotificationItem[];
  loginHistory: LoginHistoryItem[];
  settings: AppSettings;
  updatedAt: string;
  viewedBy?: UserId[];
}

export interface SessionState {
  currentUserId: UserId | null;
  page: PageKey;
  mode: CalendarMode;
  openedDate: string | null;
  isBootstrapped: boolean;
}

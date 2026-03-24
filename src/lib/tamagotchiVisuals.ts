import LIYA_BASE from "@/assets/tamagotchi-base/liya-base.webp";
import VLAD_BASE from "@/assets/tamagotchi-base/vlad-base.webp";
import LIYA_ANGRY from "@/assets/tamagotchi-emotes/liya-angry.webp";
import LIYA_IN_LOVE from "@/assets/tamagotchi-emotes/liya-in-love.webp";
import LIYA_JOYFUL from "@/assets/tamagotchi-emotes/liya-joyful.webp";
import LIYA_SLEEPY from "@/assets/tamagotchi-emotes/liya-sleepy.webp";
import LIYA_TIRED from "@/assets/tamagotchi-emotes/liya-tired.webp";
import VLAD_ANGRY from "@/assets/tamagotchi-emotes/vlad-angry.webp";
import VLAD_IN_LOVE from "@/assets/tamagotchi-emotes/vlad-in-love.webp";
import VLAD_OFFENDED from "@/assets/tamagotchi-emotes/vlad-offended.webp";
import VLAD_PEEKING from "@/assets/tamagotchi-emotes/vlad-peeking.webp";
import VLAD_SLEEPING from "@/assets/tamagotchi-emotes/vlad-sleeping.webp";
import VLAD_SLEEPY from "@/assets/tamagotchi-emotes/vlad-sleepy.webp";
import VLAD_TIRED from "@/assets/tamagotchi-emotes/vlad-tired.webp";
import VLAD_VIBING from "@/assets/tamagotchi-emotes/vlad-vibing.webp";
import type { TamagotchiState, UserId } from "@/types";

type VisualSlot = "home" | "room";
type EmotionKey =
  | "base"
  | "inLove"
  | "angry"
  | "joyful"
  | "sleepy"
  | "sleeping"
  | "tired"
  | "offended"
  | "peeking"
  | "vibing";

const EMOTION_ASSETS: Record<UserId, Partial<Record<EmotionKey, string>>> = {
  liya: {
    base: LIYA_BASE,
    inLove: LIYA_IN_LOVE,
    angry: LIYA_ANGRY,
    joyful: LIYA_JOYFUL,
    sleepy: LIYA_SLEEPY,
    tired: LIYA_TIRED
  },
  vlad: {
    base: VLAD_BASE,
    inLove: VLAD_IN_LOVE,
    angry: VLAD_ANGRY,
    offended: VLAD_OFFENDED,
    peeking: VLAD_PEEKING,
    sleepy: VLAD_SLEEPY,
    sleeping: VLAD_SLEEPING,
    tired: VLAD_TIRED,
    vibing: VLAD_VIBING
  }
};

const HEART_DECOR = ["💗", "💖", "💕", "💞", "💘", "✨", "🩷", "💓"];
const VLAD_DECOR = ["💫", "✨", "🧠", "🎈", "🪐", "😎", "⭐", "🔋"];
const LIYA_DECOR = ["💗", "🌸", "🫧", "✨", "💖", "🩷", "💞", "☁️"];
const VLAD_TIRED_DECOR = ["😴", "💤", "⭐", "🩵", "🔋", "🫠", "✨", "💫"];
const LIYA_REST_DECOR = ["🌙", "☁️", "🫧", "💤", "🩷", "✨", "💗", "🌸"];
const ANGELIC_DECOR = ["✨", "💖", "💫", "🩷", "🌸", "💞", "⭐", "☁️"];

const isNight = (hour: number) => hour >= 23 || hour < 7;
const seededIndex = (seed: number, length: number) => (length > 0 ? Math.abs(Math.floor(seed)) % length : 0);

export const getPetBaseArtwork = (userId: UserId) => EMOTION_ASSETS[userId].base ?? (userId === "liya" ? LIYA_BASE : VLAD_BASE);

export const getPetEmotionKey = (pet: TamagotchiState, now = new Date(), slot: VisualSlot = "room"): EmotionKey => {
  const hour = now.getHours();
  const night = isNight(hour);
  const seed = Math.floor(now.getTime() / (slot === "home" ? 420_000 : 180_000));
  const affectionHigh = pet.affection >= 80;
  const joyHigh = pet.joy >= 76;
  const exhausted = pet.energy <= 18;
  const tired = pet.energy <= (pet.variant === "vlad" ? 56 : 52);
  const sleepy = pet.energy <= (pet.variant === "vlad" ? 72 : 68) || (night && pet.energy <= 82);

  if (pet.variant === "liya") {
    if (pet.activity === "washing") return joyHigh ? "joyful" : "sleepy";
    if (pet.activity === "walking") return night ? "sleepy" : affectionHigh ? "inLove" : "joyful";
    if (pet.mood === "angry" || pet.hunger <= 22 || pet.cleanliness <= 20) return "angry";
    if (tired) return seededIndex(seed, 5) <= 3 ? "tired" : "sleepy";
    if (sleepy) return night || seededIndex(seed, 3) > 0 ? "sleepy" : "tired";
    if (night) return seededIndex(seed, 4) === 0 ? "base" : "sleepy";
    if (affectionHigh && joyHigh) return seededIndex(seed, 4) === 0 ? "joyful" : "inLove";
    if (joyHigh && seededIndex(seed, 3) === 0) return "joyful";
    return seededIndex(seed, 3) === 0 ? "base" : "tired";
  }

  if (pet.activity === "washing") return joyHigh ? "vibing" : "sleepy";
  if (pet.activity === "walking") return night ? (exhausted ? "sleeping" : "sleepy") : seededIndex(seed, 4) === 0 ? "peeking" : "vibing";
  if (exhausted && night) return "sleeping";
  if (pet.mood === "angry") return seededIndex(seed, 2) === 0 ? "offended" : "angry";
  if (pet.mood === "sad" || pet.joy <= 28) return seededIndex(seed, 3) === 0 ? "angry" : "offended";
  if (tired) return seededIndex(seed, 6) <= 4 ? "tired" : "sleepy";
  if (sleepy) return night ? (seededIndex(seed, 2) === 0 ? "sleeping" : "sleepy") : (seededIndex(seed, 3) === 0 ? "base" : "sleepy");
  if (affectionHigh && joyHigh) return seededIndex(seed, 5) === 0 ? "inLove" : "vibing";
  if (joyHigh) return seededIndex(seed, 6) === 0 ? "peeking" : "vibing";
  if (slot === "home" && seededIndex(seed + pet.totalTaps, 7) === 0) return "peeking";
  return seededIndex(seed, 4) === 0 ? "base" : "tired";
};

export const getPetArtwork = (pet: TamagotchiState, now = new Date(), slot: VisualSlot = "room") => {
  const key = getPetEmotionKey(pet, now, slot);
  return EMOTION_ASSETS[pet.id][key] ?? getPetBaseArtwork(pet.id);
};

export const getPetDecorItems = (pet: TamagotchiState, now = new Date()) => {
  const night = isNight(now.getHours());
  const emotion = getPetEmotionKey(pet, now, "home");

  if (emotion === "inLove") return HEART_DECOR;
  if (emotion === "joyful") return pet.id === "liya" ? ANGELIC_DECOR : VLAD_DECOR;
  if (emotion === "vibing") return VLAD_DECOR;
  if (emotion === "sleepy" || emotion === "sleeping") return pet.id === "liya" ? LIYA_REST_DECOR : VLAD_TIRED_DECOR;
  if (emotion === "tired") return pet.id === "liya" ? LIYA_REST_DECOR : VLAD_TIRED_DECOR;
  if (emotion === "angry" || emotion === "offended") return pet.id === "liya" ? ["💢", "✨", "🩷", "☁️", "💗", "🌪️"] : ["💢", "💥", "✨", "😤", "💫", "⚡"];
  if (night) return pet.id === "liya" ? LIYA_REST_DECOR : VLAD_TIRED_DECOR;
  return pet.id === "liya" ? LIYA_DECOR : VLAD_DECOR;
};

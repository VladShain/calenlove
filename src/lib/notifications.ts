import type { NotificationItem, UserId } from "@/types";

export type NotificationFeedCategory = "story" | "entry" | "mood" | "other";

export const getNotificationFeedCategory = (item: NotificationItem): NotificationFeedCategory => {
  if (item.category) {
    return item.category;
  }

  if (item.type === "story") {
    return "story";
  }

  if (item.type === "plan") {
    return "entry";
  }

  if (item.type === "mood") {
    return "mood";
  }

  return "other";
};

export const isNotificationVisibleForUser = (item: NotificationItem, currentUserId?: UserId | null) => {
  if (!currentUserId) {
    return true;
  }

  if (!item.targetUserId) {
    return item.authorId !== currentUserId || getNotificationFeedCategory(item) !== "other";
  }

  return item.targetUserId === currentUserId || item.authorId === currentUserId;
};

export const isNotificationCenterItem = (item: NotificationItem, currentUserId?: UserId | null) =>
  getNotificationFeedCategory(item) !== "other" && isNotificationVisibleForUser(item, currentUserId);

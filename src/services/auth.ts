import type { AppSnapshot, UserAccount, UserId } from "@/types";

export interface AuthResult {
  success: boolean;
  userId?: UserId;
  message: string;
}

export const authenticate = (
  snapshot: AppSnapshot,
  login: string,
  password: string,
  pin?: string
): AuthResult => {
  const normalized = login.trim().toLowerCase();
  const user = Object.values(snapshot.users).find(
    (candidate) => candidate.login.trim().toLowerCase() === normalized
  );

  if (!user) {
    return {
      success: false,
      message: "Логин не найден"
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      message: "Неверный пароль"
    };
  }

  if (snapshot.settings.pinEnabled && snapshot.settings.pinCode !== (pin || "")) {
    return {
      success: false,
      message: "PIN-код неверный"
    };
  }

  return {
    success: true,
    userId: user.id,
    message: `Вход выполнен: ${user.nickname}`
  };
};

export const updateUserAccount = (
  users: Record<UserId, UserAccount>,
  userId: UserId,
  patch: Partial<UserAccount>
) => ({
  ...users,
  [userId]: {
    ...users[userId],
    ...patch
  }
});

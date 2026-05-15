import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { UserRole } from "@prisma/client";

export const DEFAULT_LOGIN_PASSWORDS = {
  owner: "admin1234",
  manager: "KettalManager2026!",
  staff: "KettalStaff2026!",
} as const satisfies Record<UserRole, string>;

export function getDefaultLoginPassword(role: UserRole) {
  return DEFAULT_LOGIN_PASSWORDS[role];
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");

  if (stored.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(stored, derived);
}

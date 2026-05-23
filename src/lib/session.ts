import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { hashSessionToken } from "@/lib/session-token";
import { isSetupCompleted } from "@/lib/system-config";

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "staff";
};

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await db.session.findFirst({
    where: {
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session || !session.user.isActive) {
    return null;
  }

  void db.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    role: session.user.role,
  } as SessionUser;
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    const setupCompleted = await isSetupCompleted();
    if (!setupCompleted) {
      redirect("/setup");
    }

    redirect("/login");
  }

  return user;
}

export function canManageCustomers(role: SessionUser["role"]) {
  return role === "owner" || role === "manager";
}

export function canEditOrders(role: SessionUser["role"]) {
  return role === "owner" || role === "manager";
}

export function canRegisterPayments(role: SessionUser["role"]) {
  return role === "owner" || role === "manager" || role === "staff";
}

export function canCreateSales(role: SessionUser["role"]) {
  return role === "owner" || role === "manager" || role === "staff";
}

export function canEditSales(role: SessionUser["role"]) {
  return role === "owner";
}

export function canCreateOrders(role: SessionUser["role"]) {
  return role === "owner" || role === "manager" || role === "staff";
}

export function canManageUsers(role: SessionUser["role"]) {
  return role === "owner";
}

export function canViewAuditLogs(role: SessionUser["role"]) {
  return role === "owner" || role === "manager";
}

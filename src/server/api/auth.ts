import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth-constants";
import {
  canCreateOrders,
  canCreateSales,
  canEditOrders,
  canManageCustomers,
  canManageUsers,
  canRegisterPayments,
  getSessionUser,
  type SessionUser,
} from "@/lib/session";
import { createSessionToken, hashSessionToken } from "@/lib/session-token";
import { ApiError } from "@/server/api/errors";

export async function requireApiUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new ApiError(401, "Sesión requerida.");
  }

  return user;
}

export function requireRole(
  user: SessionUser,
  permission:
    | "manageCustomers"
    | "registerPayments"
    | "createOrders"
    | "editOrders"
    | "createSales"
    | "manageUsers",
) {
  const checks: Record<typeof permission, (role: UserRole) => boolean> = {
    manageCustomers: canManageCustomers,
    registerPayments: canRegisterPayments,
    createOrders: canCreateOrders,
    editOrders: canEditOrders,
    createSales: canCreateSales,
    manageUsers: canManageUsers,
  };

  if (!checks[permission](user.role)) {
    throw new ApiError(403, "Tu perfil no tiene permiso para esta acción.");
  }
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.session.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  await db.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  return token;
}

export function shouldUseSecureCookie(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedProto) {
    return forwardedProto.includes("https");
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export function setSessionCookie(response: NextResponse, sessionToken: string, secure: boolean) {
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse, secure: boolean) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return;
  }

  await db.session.deleteMany({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
  });
}

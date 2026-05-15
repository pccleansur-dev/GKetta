import { Prisma, UserRole } from "@prisma/client";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  asOptionalBoolean,
  asRequiredString,
  readJson,
} from "@/server/api/request";
import { created, handleApiError, ok } from "@/server/api/responses";
import { getUsersData } from "@/server/queries";

async function createAuditLog({
  action,
  actorUserId,
  entityId,
  entityName,
  payload,
}: {
  action: string;
  actorUserId: string;
  entityId: string;
  entityName: string;
  payload: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorUserId,
      entityName,
      entityId,
      action,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getUsersData());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageUsers");

    const body = await readJson<Record<string, unknown>>(request);
    const fullName = asRequiredString(body.fullName, "el nombre");
    const email = asRequiredString(body.username ?? body.email, "el usuario");
    const role = asRequiredString(body.role, "el rol") as UserRole;
    const isActive = asOptionalBoolean(body.isActive) ?? true;
    const password = asRequiredString(body.password, "la contraseña");
    const confirmPassword = asRequiredString(body.confirmPassword, "la confirmación de la contraseña");

    if (password !== confirmPassword) {
      throw new ApiError(400, "Las contraseñas no coinciden.");
    }

    if (password.length < 8) {
      throw new ApiError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ApiError(409, "Ya existe un usuario con ese nombre de acceso.");
    }

    const createdUser = await db.user.create({
      data: {
        fullName,
        email,
        role,
        isActive,
        passwordHash: hashPassword(password),
        passwordUpdatedAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: createdUser.id,
      entityName: "user",
      payload: { fullName, email, role, isActive },
    });

    return created({ userId: createdUser.id, message: "Usuario creado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

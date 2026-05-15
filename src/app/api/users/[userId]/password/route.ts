import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asRequiredString, readJson } from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageUsers");

    const { userId } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const password = asRequiredString(body.password, "la contraseña");
    const confirmPassword = asRequiredString(body.confirmPassword, "la confirmación de la contraseña");

    if (password !== confirmPassword) {
      throw new ApiError(400, "Las contraseñas no coinciden.");
    }

    if (password.length < 8) {
      throw new ApiError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    if (!targetUser) {
      throw new ApiError(404, "El usuario seleccionado no existe.");
    }

    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(password),
        passwordUpdatedAt: new Date(),
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "password_update",
      entityId: userId,
      entityName: "user",
      payload: {
        fullName: targetUser.fullName,
        email: targetUser.email,
      },
    });

    return ok({ userId, message: "Contraseña actualizada correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

import { Prisma, UserRole } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalBoolean, asRequiredString, readJson } from "@/server/api/request";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageUsers");

    const { userId } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const fullName = asRequiredString(body.fullName, "el nombre");
    const email = asRequiredString(body.username ?? body.email, "el usuario");
    const role = asRequiredString(body.role, "el rol") as UserRole;
    const isActive = asOptionalBoolean(body.isActive);

    if (isActive == null) {
      throw new ApiError(400, "Debes completar el estado.");
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new ApiError(404, "El usuario seleccionado no existe.");
    }

    const emailOwner = await db.user.findFirst({
      where: {
        email,
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (emailOwner) {
      throw new ApiError(409, "Ya existe otro usuario con ese nombre de acceso.");
    }

    if (targetUser.id === user.id && !isActive) {
      throw new ApiError(400, "No podes desactivar tu propio usuario.");
    }

    await db.user.update({
      where: { id: userId },
      data: {
        fullName,
        email,
        role,
        isActive,
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "update",
      entityId: userId,
      entityName: "user",
      payload: {
        before: {
          fullName: targetUser.fullName,
          email: targetUser.email,
          role: targetUser.role,
          isActive: targetUser.isActive,
        },
        after: {
          fullName,
          email,
          role,
          isActive,
        },
      },
    });

    return ok({ userId, message: "Usuario actualizado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
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
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageUsers");

    const { userId } = await params;
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new ApiError(404, "El usuario seleccionado no existe.");
    }

    if (targetUser.id === user.id && targetUser.isActive) {
      throw new ApiError(400, "No podes desactivar tu propio usuario.");
    }

    const nextIsActive = !targetUser.isActive;

    await db.user.update({
      where: { id: userId },
      data: {
        isActive: nextIsActive,
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "update",
      entityId: userId,
      entityName: "user",
      payload: {
        before: {
          isActive: targetUser.isActive,
        },
        after: {
          isActive: nextIsActive,
        },
      },
    });

    return ok({ userId, isActive: nextIsActive, message: "Estado del usuario actualizado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

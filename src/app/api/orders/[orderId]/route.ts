import { OrderStatus, PaymentConfirmationStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalDate, asOptionalString, asRequiredString, readJson } from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";
import { getOrderEditData } from "@/server/queries";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    await requireApiUser();
    const { orderId } = await params;
    const order = await getOrderEditData(orderId);

    if (!order) {
      throw new ApiError(404, "El pedido seleccionado no existe.");
    }

    return ok(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "editOrders");

    const { orderId } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const productName = asRequiredString(body.productName, "el producto");
    const status = asRequiredString(body.status, "el estado") as OrderStatus;
    const deliveryDate = asOptionalDate(body.deliveryDate);
    const notes = asOptionalString(body.notes);
    const paymentConfirmationStatus = asRequiredString(body.paymentConfirmationStatus, "la confirmación") as PaymentConfirmationStatus;

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, "El pedido seleccionado no existe.");
    }

    await db.order.update({
      where: { id: orderId },
      data: {
        productName,
        status,
        deliveryDate,
        notes,
        paymentConfirmationStatus,
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "update",
      entityId: orderId,
      entityName: "order",
      payload: { orderId, productName, status, deliveryDate, paymentConfirmationStatus },
    });

    return ok({ orderId, message: "Pedido actualizado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

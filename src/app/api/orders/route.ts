import { CashMovementSource, CashMovementType, OrderStatus, PaymentConfirmationStatus, PaymentMethod, Prisma, SaleCategory } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  asOptionalDate,
  asOptionalNumber,
  asOptionalString,
  asRequiredString,
  readJson,
} from "@/server/api/request";
import { created, handleApiError, ok } from "@/server/api/responses";
import { getOrdersData } from "@/server/queries";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

async function ensureTodayCashSession(userId: string) {
  const today = startOfToday();
  const existing = await db.cashSession.findFirst({
    where: {
      sessionDate: {
        gte: today,
        lte: endOfDay(today),
      },
    },
  });

  if (existing) {
    return existing;
  }

  return db.cashSession.create({
    data: {
      sessionDate: today,
      openingAmount: 0,
      expectedAmount: 0,
      differenceAmount: 0,
      notes: "Sesión creada automáticamente por el sistema.",
      openedBy: userId,
    },
  });
}


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
    return ok(await getOrdersData());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "createOrders");

    const body = await readJson<Record<string, unknown>>(request);
    const customerId = asRequiredString(body.customerId, "el cliente");
    const productName = asRequiredString(body.productName, "el producto");
    const totalAmount = asOptionalNumber(body.totalAmount);
    const depositAmount = asOptionalNumber(body.depositAmount) ?? 0;
    const deliveryDate = asOptionalDate(body.deliveryDate);
    const notes = asOptionalString(body.notes);
    const status = asRequiredString(body.status, "el estado") as OrderStatus;
    const paymentConfirmationStatus = asRequiredString(body.paymentConfirmationStatus, "la confirmación de la seña") as PaymentConfirmationStatus;
    const paymentMethod = asRequiredString(body.paymentMethod, "el medio de pago") as PaymentMethod;

    if (totalAmount == null || Number.isNaN(totalAmount) || totalAmount <= 0) {
      throw new ApiError(400, "El total del pedido debe ser mayor a cero.");
    }

    if (Number.isNaN(depositAmount) || depositAmount < 0) {
      throw new ApiError(400, "La seña debe ser un número válido.");
    }

    if (depositAmount > totalAmount) {
      throw new ApiError(400, "La seña no puede superar el total del pedido.");
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      throw new ApiError(404, "El cliente seleccionado ya no existe.");
    }

    const hasConfirmedDeposit =
      paymentConfirmationStatus === PaymentConfirmationStatus.confirmed && depositAmount > 0;
    const session = hasConfirmedDeposit ? await ensureTodayCashSession(user.id) : null;

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId,
          productName,
          totalAmount,
          depositAmount,
          remainingBalance: Math.max(totalAmount - depositAmount, 0),
          status,
          deliveryDate,
          notes,
          paymentConfirmationStatus,
          createdBy: user.id,
        },
      });

      if (hasConfirmedDeposit && session) {
        const sale = await tx.sale.create({
          data: {
            saleDate: startOfToday(),
            description: `Seña pedido - ${productName}`,
            category: SaleCategory.pedido,
            amount: depositAmount,
            paymentMethod,
            relatedCustomerId: customerId,
            relatedOrderId: newOrder.id,
            notes: notes ?? undefined,
            createdBy: user.id,
          },
        });

        await tx.cashMovement.create({
          data: {
            cashSessionId: session.id,
            movementType: CashMovementType.income,
            source: CashMovementSource.sale,
            amount: depositAmount,
            paymentMethod,
            description: `Seña de pedido - ${customer.fullName}`,
            relatedSaleId: sale.id,
            createdBy: user.id,
          },
        });

        await tx.cashSession.update({
          where: { id: session.id },
          data: { expectedAmount: { increment: depositAmount } },
        });
      }

      return newOrder;
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: order.id,
      entityName: "order",
      payload: { customerId, productName, totalAmount, depositAmount },
    });

    return created({ orderId: order.id, message: "Pedido cargado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

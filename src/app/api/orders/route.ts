import {
  AccountStatus,
  CashMovementSource,
  CashMovementType,
  MovementType,
  OrderStatus,
  PaymentConfirmationStatus,
  PaymentMethod,
  Prisma,
  SaleCategory,
} from "@prisma/client";

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

function deriveAccountStatus(balance: number, dueDate: Date | null) {
  if (balance <= 0) {
    return AccountStatus.settled;
  }

  if (dueDate && dueDate < startOfToday()) {
    return AccountStatus.overdue;
  }

  return AccountStatus.active;
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
      notes: "Sesion creada automaticamente por el sistema.",
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
    const paidAmount = asOptionalNumber(body.depositAmount) ?? 0;
    const deliveryDate = asOptionalDate(body.deliveryDate);
    const dueDate = asOptionalDate(body.dueDate);
    const notes = asOptionalString(body.notes);
    const status = asRequiredString(body.status, "el estado") as OrderStatus;
    const saleMode = asRequiredString(body.saleMode, "el tipo de venta");
    const paymentMethod = asRequiredString(body.paymentMethod, "el medio de pago") as PaymentMethod;

    if (totalAmount == null || Number.isNaN(totalAmount) || totalAmount <= 0) {
      throw new ApiError(400, "El total del pedido debe ser mayor a cero.");
    }

    if (Number.isNaN(paidAmount) || paidAmount < 0) {
      throw new ApiError(400, "El importe cobrado debe ser un numero valido.");
    }

    if (paidAmount > totalAmount) {
      throw new ApiError(400, "El importe cobrado no puede superar el total del pedido.");
    }

    if (saleMode !== "paid" && saleMode !== "account") {
      throw new ApiError(400, "El tipo de venta no es valido.");
    }

    const remainingBalance = Math.max(totalAmount - paidAmount, 0);

    if (saleMode === "paid" && remainingBalance > 0) {
      throw new ApiError(400, "Si la venta no es a cuenta, el pedido debe quedar cobrado completo.");
    }

    if (saleMode === "account" && remainingBalance <= 0) {
      throw new ApiError(400, "Una venta a cuenta debe tener saldo pendiente.");
    }

    if (saleMode === "account" && !dueDate) {
      throw new ApiError(400, "La venta a cuenta debe tener fecha de vencimiento.");
    }

    if (paymentMethod === PaymentMethod.mixed) {
      throw new ApiError(400, "Para pedidos usa efectivo, transferencia o tarjeta como medio de cobro.");
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      throw new ApiError(404, "El cliente seleccionado ya no existe.");
    }

    const session = paidAmount > 0 ? await ensureTodayCashSession(user.id) : null;

    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId,
          productName,
          totalAmount,
          depositAmount: paidAmount,
          remainingBalance: saleMode === "account" ? remainingBalance : 0,
          status,
          deliveryDate,
          notes,
          paymentConfirmationStatus: PaymentConfirmationStatus.confirmed,
          createdBy: user.id,
        },
      });

      const sale = await tx.sale.create({
        data: {
          saleDate: startOfToday(),
          description: `Pedido - ${productName}`,
          category: saleMode === "account" ? SaleCategory.cuenta_corriente : SaleCategory.pedido,
          amount: totalAmount,
          paymentMethod,
          relatedCustomerId: customerId,
          relatedOrderId: newOrder.id,
          notes: notes ?? undefined,
          createdBy: user.id,
        },
      });

      if (paidAmount > 0 && session) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: session.id,
            movementType: CashMovementType.income,
            source: CashMovementSource.sale,
            amount: paidAmount,
            paymentMethod,
            description: `Venta de pedido - ${customer.fullName}`,
            relatedSaleId: sale.id,
            createdBy: user.id,
          },
        });

        await tx.cashSession.update({
          where: { id: session.id },
          data: { expectedAmount: { increment: paidAmount } },
        });
      }

      if (saleMode === "account") {
        const account =
          (await tx.customerAccount.findFirst({
            where: { customerId, deletedAt: null },
            orderBy: { createdAt: "desc" },
          })) ??
          (await tx.customerAccount.create({
            data: {
              customerId,
              status: deriveAccountStatus(remainingBalance, dueDate),
              dueDate,
              currentBalance: 0,
            },
          }));

        const nextBalance = Number(account.currentBalance) + remainingBalance;

        await tx.customerAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: nextBalance,
            dueDate,
            status: deriveAccountStatus(nextBalance, dueDate),
          },
        });

        await tx.accountMovement.create({
          data: {
            accountId: account.id,
            customerId,
            movementType: MovementType.charge,
            amount: remainingBalance,
            description: `Venta a cuenta - pedido ${productName}`,
            referenceNote: notes,
            createdBy: user.id,
          },
        });
      }

      return newOrder;
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: order.id,
      entityName: "order",
      payload: { customerId, productName, totalAmount, paidAmount, saleMode, dueDate },
    });

    return created({ orderId: order.id, message: "Pedido cargado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

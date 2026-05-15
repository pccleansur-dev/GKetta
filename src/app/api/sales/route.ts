import { CashMovementSource, CashMovementType, PaymentMethod, Prisma, SaleCategory } from "@prisma/client";

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
import { getSalesData } from "@/server/queries";

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
    return ok(await getSalesData());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "createSales");

    const body = await readJson<Record<string, unknown>>(request);
    const description = asRequiredString(body.description, "la descripción");
    const amount = asOptionalNumber(body.amount);
    const saleDate = asOptionalDate(body.saleDate) ?? startOfToday();
    const category = asRequiredString(body.category, "la categoria") as SaleCategory;
    const paymentMethod = asRequiredString(body.paymentMethod, "el medio de pago") as PaymentMethod;
    const relatedCustomerId = asOptionalString(body.relatedCustomerId);
    const relatedOrderId = asOptionalString(body.relatedOrderId);
    const notes = asOptionalString(body.notes);

    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      throw new ApiError(400, "El importe de la venta debe ser mayor a cero.");
    }

    const session = await ensureTodayCashSession(user.id);

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          saleDate,
          description,
          category,
          amount,
          paymentMethod,
          relatedCustomerId,
          relatedOrderId,
          notes,
          createdBy: user.id,
        },
      });

      await tx.cashMovement.create({
        data: {
          cashSessionId: session.id,
          movementType: CashMovementType.income,
          source: CashMovementSource.sale,
          amount,
          paymentMethod,
          description,
          relatedSaleId: newSale.id,
          createdBy: user.id,
        },
      });

      await tx.cashSession.update({
        where: { id: session.id },
        data: { expectedAmount: { increment: amount } },
      });

      return newSale;
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: sale.id,
      entityName: "sale",
      payload: { description, amount, category, paymentMethod },
    });

    return created({ saleId: sale.id, message: "Venta registrada correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

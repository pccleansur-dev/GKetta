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

const SPLIT_PAYMENT_METHODS = [PaymentMethod.cash, PaymentMethod.transfer, PaymentMethod.card] as const;

type SalePaymentPart = {
  method: (typeof SPLIT_PAYMENT_METHODS)[number];
  amount: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parsePaymentParts(body: Record<string, unknown>, amount: number, paymentMethod: PaymentMethod) {
  if (paymentMethod !== PaymentMethod.mixed) {
    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      throw new ApiError(400, "El medio de pago no es valido.");
    }

    return [{ method: paymentMethod, amount }];
  }

  const rawParts = Array.isArray(body.paymentParts) ? body.paymentParts : [];
  const parts = rawParts
    .map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      const record = part as Record<string, unknown>;
      const method = asOptionalString(record.method) as PaymentMethod | null;
      const partAmount = asOptionalNumber(record.amount);

      if (!method || !SPLIT_PAYMENT_METHODS.includes(method as SalePaymentPart["method"])) {
        return null;
      }

      if (partAmount == null || Number.isNaN(partAmount) || partAmount <= 0) {
        return null;
      }

      return { method: method as SalePaymentPart["method"], amount: roundMoney(partAmount) };
    })
    .filter((part): part is SalePaymentPart => part != null);

  if (parts.length < 2) {
    throw new ApiError(400, "Una venta mixta debe tener al menos dos medios de pago con importe.");
  }

  const methods = new Set(parts.map((part) => part.method));
  if (methods.size !== parts.length) {
    throw new ApiError(400, "No repitas el mismo medio de pago en una venta mixta.");
  }

  const partsTotal = roundMoney(parts.reduce((sum, part) => sum + part.amount, 0));
  if (partsTotal !== roundMoney(amount)) {
    throw new ApiError(400, "La suma de los medios de pago debe coincidir con el importe total.");
  }

  return parts;
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

    const paymentParts = parsePaymentParts(body, roundMoney(amount), paymentMethod);
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

      await tx.cashMovement.createMany({
        data: paymentParts.map((part) => ({
          cashSessionId: session.id,
          movementType: CashMovementType.income,
          source: CashMovementSource.sale,
          amount: part.amount,
          paymentMethod: part.method,
          description,
          relatedSaleId: newSale.id,
          createdBy: user.id,
        })),
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
      payload: { description, amount, category, paymentMethod, paymentParts },
    });

    return created({ saleId: sale.id, message: "Venta registrada correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

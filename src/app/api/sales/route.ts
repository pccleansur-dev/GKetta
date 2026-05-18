import {
  AccountStatus,
  CashMovementSource,
  CashMovementType,
  MovementType,
  PaymentMethod,
  Prisma,
  SaleCategory,
} from "@prisma/client";

import { db } from "@/lib/db";
import { ensureTodayCashSession, startOfToday } from "@/lib/cash-session";
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

const CASH_METHODS = [PaymentMethod.cash, PaymentMethod.transfer, PaymentMethod.card] as const;
type CashMethod = (typeof CASH_METHODS)[number];

type PaymentPart = { method: CashMethod | typeof PaymentMethod.account; amount: number };

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isCashMethod(method: PaymentMethod): method is CashMethod {
  return (CASH_METHODS as readonly PaymentMethod[]).includes(method);
}

function parsePaymentParts(body: Record<string, unknown>, amount: number, paymentMethod: PaymentMethod): PaymentPart[] {
  if (paymentMethod !== PaymentMethod.mixed) {
    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      throw new ApiError(400, "El medio de pago no es válido.");
    }
    return [{ method: paymentMethod as CashMethod | typeof PaymentMethod.account, amount }];
  }

  const rawParts = Array.isArray(body.paymentParts) ? body.paymentParts : [];
  const parts = rawParts
    .map((part) => {
      if (!part || typeof part !== "object") return null;
      const record = part as Record<string, unknown>;
      const method = asOptionalString(record.method) as PaymentMethod | null;
      const partAmount = asOptionalNumber(record.amount);

      const validMethods: PaymentMethod[] = [...CASH_METHODS, PaymentMethod.account];
      if (!method || !validMethods.includes(method)) return null;
      if (partAmount == null || Number.isNaN(partAmount) || partAmount <= 0) return null;

      return { method: method as CashMethod | typeof PaymentMethod.account, amount: roundMoney(partAmount) };
    })
    .filter((part): part is PaymentPart => part != null);

  if (parts.length < 2) {
    throw new ApiError(400, "Una venta mixta debe tener al menos dos medios de pago con importe.");
  }

  const methods = new Set(parts.map((p) => p.method));
  if (methods.size !== parts.length) {
    throw new ApiError(400, "No repitas el mismo medio de pago en una venta mixta.");
  }

  const partsTotal = roundMoney(parts.reduce((sum, p) => sum + p.amount, 0));
  if (partsTotal !== roundMoney(amount)) {
    throw new ApiError(400, "La suma de los medios de pago debe coincidir con el importe total.");
  }

  return parts;
}

async function findOrCreateCustomerAccount(customerId: string) {
  const existing = await db.customerAccount.findFirst({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return db.customerAccount.create({
    data: { customerId, status: AccountStatus.active, currentBalance: 0 },
  });
}

async function createAuditLog({
  action, actorUserId, entityId, entityName, payload,
}: { action: string; actorUserId: string; entityId: string; entityName: string; payload: Record<string, unknown> }) {
  await db.auditLog.create({
    data: { actorUserId, entityName, entityId, action, payload: payload as Prisma.InputJsonValue },
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
    const relatedCustomerId = asOptionalString(body.relatedCustomerId) || undefined;
    const relatedOrderId = asOptionalString(body.relatedOrderId) || undefined;
    const notes = asOptionalString(body.notes);

    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      throw new ApiError(400, "El importe de la venta debe ser mayor a cero.");
    }

    const paymentParts = parsePaymentParts(body, roundMoney(amount), paymentMethod);

    const hasAccountPart = paymentParts.some((p) => p.method === PaymentMethod.account);
    if (hasAccountPart && !relatedCustomerId) {
      throw new ApiError(400, "Seleccioná un cliente para dejar saldo a cuenta.");
    }

    const cashParts = paymentParts.filter((p): p is { method: CashMethod; amount: number } => isCashMethod(p.method));
    const accountParts = paymentParts.filter((p) => p.method === PaymentMethod.account);
    const cashTotal = roundMoney(cashParts.reduce((sum, p) => sum + p.amount, 0));
    const accountTotal = roundMoney(accountParts.reduce((sum, p) => sum + p.amount, 0));

    const session = await ensureTodayCashSession(user.id);
    const customerAccount = hasAccountPart ? await findOrCreateCustomerAccount(relatedCustomerId!) : null;

    const sale = await db.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: { saleDate, description, category, amount, paymentMethod, relatedCustomerId, relatedOrderId, notes, createdBy: user.id },
      });

      if (cashParts.length > 0) {
        await tx.cashMovement.createMany({
          data: cashParts.map((part) => ({
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
          data: { expectedAmount: { increment: cashTotal } },
        });
      }

      if (customerAccount && accountTotal > 0) {
        const movement = await tx.accountMovement.create({
          data: {
            accountId: customerAccount.id,
            customerId: relatedCustomerId!,
            movementType: MovementType.charge,
            amount: accountTotal,
            description,
            createdBy: user.id,
          },
        });

        await tx.customerAccount.update({
          where: { id: customerAccount.id },
          data: {
            currentBalance: { increment: accountTotal },
            status: AccountStatus.active,
          },
        });

        return { sale: newSale, accountMovementId: movement.id };
      }

      return { sale: newSale, accountMovementId: null };
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: sale.sale.id,
      entityName: "sale",
      payload: { description, amount, category, paymentMethod, cashTotal, accountTotal },
    });

    return created({ saleId: sale.sale.id, message: "Venta registrada correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

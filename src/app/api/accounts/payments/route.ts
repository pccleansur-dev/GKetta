import { CashMovementSource, CashMovementType, MovementType, PaymentMethod, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ensureTodayCashSession, startOfToday, endOfDay } from "@/lib/cash-session";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  asOptionalString,
  asRequiredPositiveNumber,
  asRequiredString,
  readJson,
} from "@/server/api/request";
import { created, handleApiError } from "@/server/api/responses";

function deriveAccountStatus(balance: number, dueDate: Date | null) {
  if (balance <= 0) {
    return "settled";
  }

  if (dueDate && dueDate < startOfToday()) {
    return "overdue";
  }

  return "active";
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

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "registerPayments");

    const body = await readJson<Record<string, unknown>>(request);
    const accountId = asRequiredString(body.accountId, "la cuenta");
    const amount = asRequiredPositiveNumber(body.amount, "El importe del pago");
    const description = asOptionalString(body.description) ?? "Pago registrado desde cuentas corrientes";
    const paymentMethod = asRequiredString(body.paymentMethod, "el medio de pago") as PaymentMethod;

    const account = await db.customerAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      include: { customer: true },
    });

    if (!account) {
      throw new ApiError(404, "La cuenta seleccionada ya no existe.");
    }

    const currentBalance = Number(account.currentBalance);
    const nextBalance = Math.max(currentBalance - amount, 0);
    const status = deriveAccountStatus(nextBalance, account.dueDate) as "active" | "settled" | "overdue";
    const session = await ensureTodayCashSession(user.id);

    const movement = await db.$transaction(async (tx) => {
      const accountMovement = await tx.accountMovement.create({
        data: {
          accountId: account.id,
          customerId: account.customerId,
          movementType: MovementType.payment,
          amount,
          paymentMethod,
          description,
          createdBy: user.id,
        },
      });

      await tx.customerAccount.update({
        where: { id: account.id },
        data: { currentBalance: nextBalance, status },
      });

      await tx.cashMovement.create({
        data: {
          cashSessionId: session.id,
          movementType: CashMovementType.income,
          source: CashMovementSource.payment,
          amount,
          paymentMethod,
          description: `Pago de cuenta corriente - ${account.customer.fullName}`,
          relatedAccountMovementId: accountMovement.id,
          createdBy: user.id,
        },
      });

      await tx.cashSession.update({
        where: { id: session.id },
        data: { expectedAmount: { increment: amount } },
      });

      return accountMovement;
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "payment",
      entityId: movement.id,
      entityName: "account_movement",
      payload: { accountId, amount, paymentMethod },
    });

    return created({ movementId: movement.id, message: "Pago registrado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

import { AccountStatus, MovementType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  asOptionalDate,
  asOptionalInteger,
  asOptionalNumber,
  asOptionalString,
  asRequiredString,
  readJson,
} from "@/server/api/request";
import { created, handleApiError, ok } from "@/server/api/responses";
import { getCustomersData } from "@/server/queries";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
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
    return ok(await getCustomersData());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageCustomers");

    const body = await readJson<Record<string, unknown>>(request);
    const fullName = asRequiredString(body.fullName, "el nombre");
    const phone = asOptionalString(body.phone);
    const documentNumber = asOptionalString(body.documentNumber);
    const notes = asOptionalString(body.notes);
    const monthlyDueDay = asOptionalInteger(body.monthlyDueDay);
    const dueDate = asOptionalDate(body.dueDate);
    const openingBalance = asOptionalNumber(body.openingBalance) ?? 0;

    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      throw new ApiError(400, "El saldo inicial debe ser un número válido.");
    }

    if (monthlyDueDay !== null && (Number.isNaN(monthlyDueDay) || monthlyDueDay < 1 || monthlyDueDay > 31)) {
      throw new ApiError(400, "El dia de vencimiento mensual debe estar entre 1 y 31.");
    }

    const customer = await db.customer.create({
      data: {
        fullName,
        phone,
        documentNumber,
        notes,
        monthlyDueDay: monthlyDueDay ?? undefined,
        accounts: {
          create: {
            status: deriveAccountStatus(openingBalance, dueDate),
            dueDate,
            currentBalance: openingBalance,
            notes: notes ?? undefined,
          },
        },
      },
      include: {
        accounts: true,
      },
    });

    const account = customer.accounts[0];

    if (openingBalance > 0) {
      await db.accountMovement.create({
        data: {
          accountId: account.id,
          customerId: customer.id,
          movementType: MovementType.charge,
          amount: openingBalance,
          description: "Saldo inicial cargado al crear el cliente",
          createdBy: user.id,
        },
      });
    }

    await createAuditLog({
      actorUserId: user.id,
      action: "create",
      entityId: customer.id,
      entityName: "customer",
      payload: { fullName, openingBalance },
    });

    return created({
      customerId: customer.id,
      accountId: account.id,
      message: "Cliente creado correctamente.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

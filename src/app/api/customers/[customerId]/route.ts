import { AccountStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import {
  asOptionalBoolean,
  asOptionalDate,
  asOptionalInteger,
  asOptionalString,
  asRequiredString,
  readJson,
} from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";
import { getCustomerEditData } from "@/server/queries";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    await requireApiUser();
    const { customerId } = await params;
    const customer = await getCustomerEditData(customerId);

    if (!customer) {
      throw new ApiError(404, "El cliente seleccionado no existe.");
    }

    return ok(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageCustomers");

    const { customerId } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const fullName = asRequiredString(body.fullName, "el nombre");
    const phone = asOptionalString(body.phone);
    const documentNumber = asOptionalString(body.documentNumber);
    const notes = asOptionalString(body.notes);
    const monthlyDueDay = asOptionalInteger(body.monthlyDueDay);
    const dueDate = asOptionalDate(body.dueDate);
    const trustedValue = asOptionalBoolean(body.isTrusted);
    const isTrusted = trustedValue ?? false;

    if (monthlyDueDay !== null && (Number.isNaN(monthlyDueDay) || monthlyDueDay < 1 || monthlyDueDay > 31)) {
      throw new ApiError(400, "El dia de vencimiento mensual debe estar entre 1 y 31.");
    }

    const account = await db.customerAccount.findFirst({
      where: { customerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!account) {
      throw new ApiError(404, "El cliente no tiene una cuenta activa para editar.");
    }

    await db.$transaction([
      db.customer.update({
        where: { id: customerId },
        data: {
          fullName,
          phone,
          documentNumber,
          notes,
          isTrusted,
          monthlyDueDay: monthlyDueDay ?? undefined,
        },
      }),
      db.customerAccount.update({
        where: { id: account.id },
        data: {
          dueDate,
          notes,
          status: deriveAccountStatus(Number(account.currentBalance), dueDate),
        },
      }),
    ]);

    await createAuditLog({
      actorUserId: user.id,
      action: "update",
      entityId: customerId,
      entityName: "customer",
      payload: { customerId, accountId: account.id, fullName, phone, documentNumber, monthlyDueDay, dueDate, isTrusted },
    });

    return ok({ customerId, message: "Cliente actualizado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageCustomers");

    const { customerId } = await params;

    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.deletedAt) {
      throw new ApiError(404, "El cliente seleccionado no existe.");
    }

    const now = new Date();

    await db.$transaction([
      db.customer.update({
        where: { id: customerId },
        data: { deletedAt: now },
      }),
      db.customerAccount.updateMany({
        where: { customerId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    await createAuditLog({
      actorUserId: user.id,
      action: "delete",
      entityId: customerId,
      entityName: "customer",
      payload: { customerId, fullName: customer.fullName },
    });

    return ok({ customerId, message: "Cliente eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

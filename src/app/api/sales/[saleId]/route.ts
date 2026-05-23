import { AccountStatus, CashMovementSource, CashMovementType, MovementType, PaymentMethod, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalDate, asOptionalString, asRequiredPositiveNumber, readJson } from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return Number(value);
}

function isWithinEditWindow(createdAt: Date) {
  return Date.now() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function deriveAccountStatus(balance: number, dueDate: Date | null) {
  if (balance <= 0) {
    return AccountStatus.settled;
  }

  if (dueDate && dueDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    return AccountStatus.overdue;
  }

  return AccountStatus.active;
}

function scaleAmounts(amounts: number[], targetTotal: number) {
  if (amounts.length === 0) {
    return [];
  }

  const currentTotal = roundMoney(amounts.reduce((sum, value) => sum + value, 0));
  if (currentTotal <= 0) {
    return amounts.map(() => 0);
  }

  const factor = targetTotal / currentTotal;
  const scaled = amounts.map((amount) => roundMoney(amount * factor));
  const diff = roundMoney(targetTotal - roundMoney(scaled.reduce((sum, value) => sum + value, 0)));
  scaled[scaled.length - 1] = roundMoney(scaled[scaled.length - 1] + diff);
  return scaled;
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "editSales");

    const { saleId } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    const nextAmount = roundMoney(asRequiredPositiveNumber(body.amount, "El importe de la venta"));
    const nextDescription = asOptionalString(body.description);
    const nextSaleDate = asOptionalDate(body.saleDate);

    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        cashMovements: {
          where: {
            movementType: CashMovementType.income,
            source: CashMovementSource.sale,
          },
          include: { cashSession: true },
          orderBy: { createdAt: "asc" },
        },
        accountMovements: {
          include: {
            account: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sale) {
      throw new ApiError(404, "La venta seleccionada no existe.");
    }

    if (!isWithinEditWindow(sale.createdAt)) {
      throw new ApiError(409, "La ventana para corregir esta venta ya venció. Solo se permite dentro de los 7 días posteriores a la carga.");
    }

    if (sale.accountMovements.length > 1) {
      throw new ApiError(409, "La venta tiene más de un movimiento de cuenta asociado y no se puede corregir automáticamente.");
    }

    const relatedOrder = sale.relatedOrderId
      ? await db.order.findUnique({
          where: { id: sale.relatedOrderId },
        })
      : null;

    if (sale.relatedOrderId && !relatedOrder) {
      throw new ApiError(404, "El pedido vinculado a esta venta ya no existe.");
    }

    const description = nextDescription ?? sale.description;
    const saleDate = nextSaleDate ?? sale.saleDate;
    const amountDelta = roundMoney(nextAmount - toNumber(sale.amount));
    const descriptionChanged = description !== sale.description;
    const saleDateChanged = saleDate.getTime() !== sale.saleDate.getTime();

    const previousCashMovements = sale.cashMovements;
    const previousCashTotal = roundMoney(previousCashMovements.reduce((sum, movement) => sum + toNumber(movement.amount), 0));
    const previousAccountAmount = roundMoney(toNumber(sale.amount) - previousCashTotal);

    let previousAccountMovement: (typeof sale.accountMovements)[number] | null = sale.accountMovements[0] ?? null;
    if (!previousAccountMovement && sale.relatedCustomerId && previousAccountAmount > 0) {
      previousAccountMovement = await db.accountMovement.findFirst({
        where: {
          customerId: sale.relatedCustomerId,
          movementType: MovementType.charge,
          amount: previousAccountAmount,
          description: sale.description,
          createdBy: sale.createdBy,
          relatedSaleId: null,
          createdAt: {
            gte: new Date(sale.createdAt.getTime() - 5 * 60 * 1000),
            lte: new Date(sale.createdAt.getTime() + 5 * 60 * 1000),
          },
        },
        include: {
          account: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (sale.paymentMethod !== PaymentMethod.cash && previousAccountAmount > 0 && !previousAccountMovement) {
      throw new ApiError(409, "No se pudo ubicar el movimiento de cuenta asociado a esta venta.");
    }

    if (amountDelta === 0 && !descriptionChanged && !saleDateChanged) {
      return ok({ saleId, message: "La venta ya tenía esos valores." });
    }

    await db.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: {
          amount: nextAmount,
          description,
          saleDate,
        },
      });

      if (descriptionChanged && previousCashMovements.length > 0) {
        await tx.cashMovement.updateMany({
          where: { id: { in: previousCashMovements.map((movement) => movement.id) } },
          data: { description },
        });
      }

      if (amountDelta !== 0) {
        if (previousAccountMovement && previousAccountAmount > 0) {
          const nextAccountAmount = roundMoney(nextAmount - previousCashTotal);

          if (nextAccountAmount < 0) {
            throw new ApiError(400, "El nuevo importe no puede ser menor que la porción ya aplicada a cuenta.");
          }

          if (nextAccountAmount === 0) {
            await tx.accountMovement.delete({
              where: { id: previousAccountMovement.id },
            });
          } else {
            await tx.accountMovement.update({
              where: { id: previousAccountMovement.id },
              data: {
                amount: nextAccountAmount,
                ...(descriptionChanged ? { description } : {}),
              },
            });
          }

          const balanceDelta = roundMoney(nextAccountAmount - previousAccountAmount);
          const nextBalance = roundMoney(toNumber(previousAccountMovement.account.currentBalance) + balanceDelta);

          await tx.customerAccount.update({
            where: { id: previousAccountMovement.accountId },
            data: {
              currentBalance: nextBalance,
              status: deriveAccountStatus(nextBalance, previousAccountMovement.account.dueDate),
            },
          });
        } else if (previousCashMovements.length > 0) {
          const nextCashAmounts = scaleAmounts(
            previousCashMovements.map((movement) => toNumber(movement.amount)),
            nextAmount,
          );
          const sessionDeltas = new Map<string, number>();

          for (let index = 0; index < previousCashMovements.length; index += 1) {
            const movement = previousCashMovements[index];
            const nextCashAmount = nextCashAmounts[index] ?? 0;
            const delta = roundMoney(nextCashAmount - toNumber(movement.amount));

            sessionDeltas.set(
              movement.cashSessionId,
              roundMoney((sessionDeltas.get(movement.cashSessionId) ?? 0) + delta),
            );

            await tx.cashMovement.update({
              where: { id: movement.id },
              data: {
                amount: nextCashAmount,
                ...(descriptionChanged ? { description } : {}),
              },
            });
          }

          for (const [cashSessionId, delta] of sessionDeltas) {
            if (delta === 0) {
              continue;
            }

            await tx.cashSession.update({
              where: { id: cashSessionId },
              data: {
                expectedAmount: { increment: delta },
              },
            });
          }
        }

        if (relatedOrder) {
          const nextRemainingBalance = Math.max(nextAmount - toNumber(relatedOrder.depositAmount), 0);

          await tx.order.update({
            where: { id: relatedOrder.id },
            data: {
              totalAmount: nextAmount,
              remainingBalance: nextRemainingBalance,
            },
          });
        }
      } else if (descriptionChanged && previousAccountMovement) {
        await tx.accountMovement.update({
          where: { id: previousAccountMovement.id },
          data: { description },
        });
      }
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "update",
      entityId: saleId,
      entityName: "sale",
      payload: {
        saleId,
        previousAmount: toNumber(sale.amount),
        amount: nextAmount,
        amountDelta,
        previousDescription: sale.description,
        description,
        previousSaleDate: sale.saleDate.toISOString(),
        saleDate: saleDate.toISOString(),
      },
    });

    return ok({
      saleId,
      message: "Venta actualizada correctamente.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  try {
    const user = await requireApiUser();
    requireRole(user, "editSales");

    const { saleId } = await params;

    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        cashMovements: {
          where: {
            movementType: CashMovementType.income,
            source: CashMovementSource.sale,
          },
          include: { cashSession: true },
          orderBy: { createdAt: "asc" },
        },
        accountMovements: {
          include: {
            account: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sale) {
      throw new ApiError(404, "La venta seleccionada no existe.");
    }

    if (!isWithinEditWindow(sale.createdAt)) {
      throw new ApiError(409, "La ventana para anular esta venta ya venció. Solo se permite dentro de los 7 días posteriores a la carga.");
    }

    if (sale.relatedOrderId) {
      throw new ApiError(409, "Las ventas asociadas a pedidos se anulan desde Pedidos.");
    }

    if (sale.accountMovements.length > 1) {
      throw new ApiError(409, "La venta tiene más de un movimiento de cuenta asociado y no se puede anular automáticamente.");
    }

    const previousCashMovements = sale.cashMovements;
    const previousCashTotal = roundMoney(previousCashMovements.reduce((sum, movement) => sum + toNumber(movement.amount), 0));
    const previousAccountAmount = roundMoney(toNumber(sale.amount) - previousCashTotal);

    let previousAccountMovement: (typeof sale.accountMovements)[number] | null = sale.accountMovements[0] ?? null;
    if (!previousAccountMovement && sale.relatedCustomerId && previousAccountAmount > 0) {
      previousAccountMovement = await db.accountMovement.findFirst({
        where: {
          customerId: sale.relatedCustomerId,
          movementType: MovementType.charge,
          amount: previousAccountAmount,
          description: sale.description,
          createdBy: sale.createdBy,
          relatedSaleId: null,
          createdAt: {
            gte: new Date(sale.createdAt.getTime() - 5 * 60 * 1000),
            lte: new Date(sale.createdAt.getTime() + 5 * 60 * 1000),
          },
        },
        include: {
          account: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (sale.paymentMethod !== PaymentMethod.cash && previousAccountAmount > 0 && !previousAccountMovement) {
      throw new ApiError(409, "No se pudo ubicar el movimiento de cuenta asociado a esta venta.");
    }

    const cashSessionDeltas = new Map<string, number>();
    for (const movement of previousCashMovements) {
      cashSessionDeltas.set(
        movement.cashSessionId,
        roundMoney((cashSessionDeltas.get(movement.cashSessionId) ?? 0) - toNumber(movement.amount)),
      );
    }

    await db.$transaction(async (tx) => {
      if (previousCashMovements.length > 0) {
        await tx.cashMovement.deleteMany({
          where: { id: { in: previousCashMovements.map((movement) => movement.id) } },
        });

        for (const [cashSessionId, delta] of cashSessionDeltas) {
          if (delta === 0) {
            continue;
          }

          await tx.cashSession.update({
            where: { id: cashSessionId },
            data: {
              expectedAmount: { increment: delta },
            },
          });
        }
      }

      if (previousAccountMovement && previousAccountAmount > 0) {
        await tx.accountMovement.delete({
          where: { id: previousAccountMovement.id },
        });

        const nextBalance = roundMoney(toNumber(previousAccountMovement.account.currentBalance) - previousAccountAmount);

        await tx.customerAccount.update({
          where: { id: previousAccountMovement.accountId },
          data: {
            currentBalance: nextBalance,
            status: deriveAccountStatus(nextBalance, previousAccountMovement.account.dueDate),
          },
        });
      }

      await tx.sale.delete({
        where: { id: saleId },
      });
    });

    await createAuditLog({
      actorUserId: user.id,
      action: "delete",
      entityId: saleId,
      entityName: "sale",
      payload: {
        saleId,
        previousAmount: toNumber(sale.amount),
        cashTotal: previousCashTotal,
        accountTotal: previousAccountAmount,
        description: sale.description,
        saleDate: sale.saleDate.toISOString(),
      },
    });

    return ok({ saleId, message: "Venta anulada correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

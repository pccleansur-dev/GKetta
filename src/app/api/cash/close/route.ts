import { db } from "@/lib/db";
import { createBackup } from "@/lib/backup";
import { endOfDay, startOfToday } from "@/lib/cash-session";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalNumber, asOptionalString, readJson } from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "createSales");

    const body = await readJson<Record<string, unknown>>(request);
    const cashAmount = asOptionalNumber(body.cashAmount) ?? 0;
    const transferAmount = asOptionalNumber(body.transferAmount) ?? 0;
    const cardAmount = asOptionalNumber(body.cardAmount) ?? 0;
    const notes = asOptionalString(body.notes);

    if (cashAmount < 0 || transferAmount < 0 || cardAmount < 0) {
      throw new ApiError(400, "Los montos no pueden ser negativos.");
    }

    const closingAmount = Math.round((cashAmount + transferAmount + cardAmount) * 100) / 100;

    const today = startOfToday();
    const session = await db.cashSession.findFirst({
      where: { sessionDate: { gte: today, lte: endOfDay(today) } },
    });

    if (!session) {
      throw new ApiError(404, "No hay caja abierta hoy.");
    }

    if (session.closedAt) {
      throw new ApiError(409, "La caja de hoy ya fue cerrada.");
    }

    const expectedAmount = Number(session.expectedAmount);
    const differenceAmount = Math.round((closingAmount - expectedAmount) * 100) / 100;

    await db.cashSession.update({
      where: { id: session.id },
      data: {
        closingAmount,
        closingCash: cashAmount,
        closingTransfer: transferAmount,
        closingCard: cardAmount,
        differenceAmount,
        closedAt: new Date(),
        closedBy: user.id,
        ...(notes ? { notes } : {}),
      },
    });

    const backup = await createBackup();

    return ok({
      message: "Caja cerrada correctamente.",
      backupFile: backup.filename,
      difference: differenceAmount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

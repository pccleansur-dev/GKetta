import { db } from "@/lib/db";
import { createBackup } from "@/lib/backup";
import { endOfDay, startOfToday } from "@/lib/cash-session";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalString, asRequiredPositiveNumber, readJson } from "@/server/api/request";
import { handleApiError, ok } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "createSales");

    const body = await readJson<Record<string, unknown>>(request);
    const closingAmount = asRequiredPositiveNumber(body.closingAmount, "el monto de cierre");
    const notes = asOptionalString(body.notes);

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
    const differenceAmount = closingAmount - expectedAmount;

    await db.cashSession.update({
      where: { id: session.id },
      data: {
        closingAmount,
        differenceAmount,
        closedAt: new Date(),
        closedBy: user.id,
        ...(notes ? { notes } : {}),
      },
    });

    // Backup automático al cerrar caja
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

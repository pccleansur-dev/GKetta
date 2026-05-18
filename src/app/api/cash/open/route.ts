import { db } from "@/lib/db";
import { endOfDay, startOfToday } from "@/lib/cash-session";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { ApiError } from "@/server/api/errors";
import { asOptionalNumber, readJson } from "@/server/api/request";
import { created, handleApiError } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    requireRole(user, "createSales");

    const body = await readJson<Record<string, unknown>>(request);
    const openingAmount = asOptionalNumber(body.openingAmount) ?? 0;

    const today = startOfToday();
    const existing = await db.cashSession.findFirst({
      where: { sessionDate: { gte: today, lte: endOfDay(today) } },
    });

    if (existing) {
      throw new ApiError(409, "Ya existe una caja abierta para hoy.");
    }

    await db.cashSession.create({
      data: {
        sessionDate: today,
        openingAmount,
        expectedAmount: openingAmount,
        differenceAmount: 0,
        openedBy: user.id,
      },
    });

    return created({ message: "Caja abierta correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}

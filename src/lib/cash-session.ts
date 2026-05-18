import { db } from "@/lib/db";

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

export { startOfToday, endOfDay };

export async function ensureTodayCashSession(userId: string) {
  const today = startOfToday();

  const existing = await db.cashSession.findFirst({
    where: { sessionDate: { gte: today, lte: endOfDay(today) } },
  });

  if (existing) return existing;

  // Usar el cierre del día anterior como apertura del día actual
  const lastClosed = await db.cashSession.findFirst({
    where: { closedAt: { not: null } },
    orderBy: { sessionDate: "desc" },
  });

  const openingAmount = lastClosed?.closingAmount ?? 0;

  return db.cashSession.create({
    data: {
      sessionDate: today,
      openingAmount,
      expectedAmount: openingAmount,
      differenceAmount: 0,
      notes: "Sesión creada automáticamente.",
      openedBy: userId,
    },
  });
}

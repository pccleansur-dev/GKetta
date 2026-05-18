import { ReminderType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireApiUser } from "@/server/api/auth";
import { asOptionalString, asRequiredString, readJson } from "@/server/api/request";
import { created, handleApiError, ok } from "@/server/api/responses";
import { getRemindersData } from "@/server/queries";

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getRemindersData());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await readJson<Record<string, unknown>>(request);
    const accountId = asOptionalString(body.accountId) || undefined;
    const customerId = asRequiredString(body.customerId, "el cliente");
    const whatsappLink = asRequiredString(body.whatsappLink, "el enlace");
    const messagePreview = asRequiredString(body.messagePreview, "el mensaje");
    const rawType = String(body.reminderType ?? "manual");
    const reminderType = (Object.values(ReminderType) as string[]).includes(rawType)
      ? (rawType as ReminderType)
      : ReminderType.manual;

    await db.reminderLog.create({
      data: { accountId, customerId, whatsappLink, messagePreview, reminderType, createdBy: user.id },
    });

    return created({ message: "Recordatorio registrado." });
  } catch (error) {
    return handleApiError(error);
  }
}

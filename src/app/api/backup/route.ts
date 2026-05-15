import { createBackup } from "@/lib/backup";
import { requireApiUser, requireRole } from "@/server/api/auth";
import { handleApiError, ok } from "@/server/api/responses";

export async function POST() {
  try {
    const user = await requireApiUser();
    requireRole(user, "manageUsers");

    const result = await createBackup();
    const sizeKb = Math.round(result.sizeBytes / 1024);

    return ok({
      filename: result.filename,
      sizeKb,
      message: `Backup creado correctamente (${sizeKb} KB).`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

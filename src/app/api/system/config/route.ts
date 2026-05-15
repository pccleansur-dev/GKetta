import { db } from "@/lib/db";
import { handleApiError, ok } from "@/server/api/responses";

export async function GET() {
  try {
    const configs = await db.systemConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }
    return ok({
      businessName: map["business_name"] ?? "Sistema Kettal",
      setupCompleted: map["setup_completed"] === "true",
      backupPath: map["backup_path"] ?? "./backups",
      backupRetentionDays: parseInt(map["backup_retention_days"] ?? "60", 10),
      lastBackupAt: map["last_backup_at"] ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

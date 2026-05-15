import { db } from "@/lib/db";

export async function isSetupCompleted() {
  const setupCompleted = await db.systemConfig.findUnique({
    where: { key: "setup_completed" },
    select: { value: true },
  });

  return setupCompleted?.value === "true";
}

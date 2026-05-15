import fs from "fs/promises";
import path from "path";

import { db } from "@/lib/db";

async function getBackupConfig() {
  const configs = await db.systemConfig.findMany({
    where: { key: { in: ["backup_path", "backup_retention_days"] } },
  });
  const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
  return {
    backupPath: map["backup_path"] ?? "./backups",
    retentionDays: parseInt(map["backup_retention_days"] ?? "60", 10),
  };
}

async function upsertConfig(key: string, value: string) {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function createBackup() {
  const { backupPath, retentionDays } = await getBackupConfig();

  await fs.mkdir(backupPath, { recursive: true });

  const [
    customers,
    customerAccounts,
    accountMovements,
    orders,
    sales,
    cashSessions,
    cashMovements,
    users,
    systemConfig,
  ] = await Promise.all([
    db.customer.findMany(),
    db.customerAccount.findMany(),
    db.accountMovement.findMany(),
    db.order.findMany(),
    db.sale.findMany(),
    db.cashSession.findMany(),
    db.cashMovement.findMany(),
    db.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
        passwordUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.systemConfig.findMany(),
  ]);

  const backup = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    data: {
      customers,
      customerAccounts,
      accountMovements,
      orders,
      sales,
      cashSessions,
      cashMovements,
      users,
      systemConfig,
    },
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const filename = `kettal-backup-${ts}.json`;
  const filepath = path.join(backupPath, filename);

  const content = JSON.stringify(backup, null, 2);
  await fs.writeFile(filepath, content, "utf-8");

  await upsertConfig("last_backup_at", new Date().toISOString());

  await cleanupOldBackups(backupPath, retentionDays);

  return { filepath, filename, sizeBytes: Buffer.byteLength(content, "utf-8") };
}

async function cleanupOldBackups(backupPath: string, retentionDays: number) {
  try {
    const files = await fs.readdir(backupPath);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    for (const file of files) {
      if (!file.startsWith("kettal-backup-") || !file.endsWith(".json")) continue;
      const filepath = path.join(backupPath, file);
      const stat = await fs.stat(filepath);
      if (stat.mtime < cutoff) {
        await fs.unlink(filepath);
      }
    }
  } catch {
    // cleanup failure no debe fallar el backup
  }
}

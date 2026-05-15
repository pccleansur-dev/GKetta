import { createBackup } from "@/lib/backup";

let initialized = false;

export function startBackupScheduler() {
  if (initialized) return;
  initialized = true;

  scheduleNext();
}

function scheduleNext() {
  const now = new Date();
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  const delay = next.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const result = await createBackup();
      console.log(`[backup] Backup automático creado: ${result.filename}`);
    } catch (error) {
      console.error("[backup] Error en backup automático:", error);
    }
    scheduleNext();
  }, delay);
}

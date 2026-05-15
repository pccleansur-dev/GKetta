import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BackupButton } from "@/components/backup/backup-button";
import { db } from "@/lib/db";
import { getCashData } from "@/server/queries";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const [{ history, snapshot }, lastBackupConfig] = await Promise.all([
    getCashData(),
    db.systemConfig.findUnique({ where: { key: "last_backup_at" } }),
  ]);

  return (
    <DashboardShell>
      <main className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <p className="section-kicker">Caja general</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Control diario, semanal y mensual
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Lectura rápida del turno actual con base preparada para histórico de cierres.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(snapshot).map(([label, value]) => (
              <article key={label} className="surface-muted rounded-[24px] p-4">
                <p className="text-sm capitalize text-[var(--text-secondary)]">
                  {label.replace(/([A-Z])/g, " $1")}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {formatCurrency(value)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <section className="page-frame rounded-[30px] p-5 sm:p-6">
            <p className="section-kicker">Vista histórica</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
              <div className="surface-muted rounded-[24px] p-4">
                <p className="font-semibold text-[var(--text-primary)]">Semana actual</p>
                <p className="mt-1">{formatCurrency(history.week)} vendidos desde el inicio de semana.</p>
              </div>
              <div className="surface-muted rounded-[24px] p-4">
                <p className="font-semibold text-[var(--text-primary)]">Mes actual</p>
                <p className="mt-1">{formatCurrency(history.month)} acumulados en el mes actual.</p>
              </div>
              <div className="surface-walnut rounded-[24px] p-4">
                <p className="font-semibold text-[var(--text-primary)]">Histórico total</p>
                <p className="mt-1">{formatCurrency(history.allTime)} vendidos desde el arranque de la base.</p>
              </div>
            </div>
          </section>

          <section className="page-frame rounded-[30px] p-5 sm:p-6">
            <p className="section-kicker">Backup de datos</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Respaldo diario automático
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              El sistema hace backup automáticamente a las 00:00. También podés hacerlo manualmente.
            </p>
            <div className="mt-4">
              <BackupButton lastBackupAt={lastBackupConfig?.value ?? null} />
            </div>
          </section>

          <section className="page-frame rounded-[30px] p-5 sm:p-6">
            <p className="section-kicker">Últimos cierres</p>
            <div className="mt-4 space-y-3">
              {history.recentClosings.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Todavía no hay cierres registrados.
                </p>
              ) : (
                history.recentClosings.map((closing) => (
                  <div key={closing.id} className="surface-muted rounded-[24px] p-4">
                    <p className="font-semibold text-[var(--text-primary)]">{closing.date}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Esperado {formatCurrency(closing.expected)} · Diferencia{" "}
                      {formatCurrency(closing.difference)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      </main>
    </DashboardShell>
  );
}

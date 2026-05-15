import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ReminderLink } from "@/components/reminders/reminder-link";
import { getRemindersData } from "@/server/queries";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

function reminderTypeFromStatus(status: string) {
  if (status === "vencida") return "overdue";
  if (status === "por vencer") return "upcoming_due";
  return "manual";
}

export const dynamic = "force-dynamic";

export default async function RecordatoriosPage() {
  const reminders = await getRemindersData();

  return (
    <DashboardShell>
      <main className="flex flex-col gap-6">
        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Recordatorios</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Mensajes listos para clientes deudores
              </h1>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Texto prearmado con acceso directo a WhatsApp para seguimiento comercial.
              </p>
            </div>
            <button className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]">
              Crear mensaje manual
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Mensajes activos</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {reminders.length}
              </p>
            </article>
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Seguimiento urgente</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--danger)]">
                {
                  reminders.filter(
                    (reminder) => reminder.status === "vencida" || reminder.status === "por vencer",
                  ).length
                }
              </p>
            </article>
            <article className="surface-walnut rounded-[22px] p-4">
              <p className="text-sm text-[rgba(237,242,237,0.72)]">Contacto directo</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                Cada registro conserva monto pendiente y enlace listo para enviar.
              </p>
            </article>
          </div>
        </section>

        <section className="space-y-4">
          {reminders.length === 0 ? (
            <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
              No hay clientes con saldo pendiente en este momento.
            </div>
          ) : null}
          {reminders.map((reminder) => (
            <article key={reminder.id} className="page-frame rounded-[24px] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {reminder.customer}
                    </h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(reminder.status)}`}
                    >
                      {statusLabel(reminder.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Saldo pendiente {formatCurrency(reminder.balance)}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                    {reminder.message}
                  </p>
                </div>
                <ReminderLink
                  href={`https://wa.me/${reminder.phone}?text=${encodeURIComponent(reminder.message)}`}
                  accountId={reminder.id}
                  customerId={reminder.customerId}
                  reminderType={reminderTypeFromStatus(reminder.status)}
                  messagePreview={reminder.message}
                />
              </div>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}

import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ManualReminderButton } from "@/components/reminders/manual-reminder-button";
import { ReminderLink } from "@/components/reminders/reminder-link";
import { getRemindersData } from "@/server/queries";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

export const dynamic = "force-dynamic";

const PURCHASE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "week", label: "Compra esta semana" },
  { value: "month", label: "Compra este mes" },
  { value: "old", label: "Sin compra reciente" },
  { value: "3months", label: "Sin compra en 3 meses" },
] as const;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecordatoriosPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lastPurchaseFilter = typeof params?.lastPurchase === "string" ? params.lastPurchase : "all";

  const reminders = await getRemindersData(lastPurchaseFilter);

  const vencidas = reminders.filter((r) => r.status === "vencida").length;
  const porVencer = reminders.filter((r) => r.status === "por vencer").length;

  return (
    <DashboardShell>
      <main className="flex flex-col gap-6">
        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Recordatorios</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Clientes con saldo pendiente
              </h1>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Mensaje prearmado por tipo de deuda con acceso directo a WhatsApp.
              </p>
            </div>
            <ManualReminderButton />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Total deudores</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {reminders.length}
              </p>
            </article>
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Vencidas</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--danger)]">
                {vencidas}
              </p>
            </article>
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Por vencer</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--warning)]">
                {porVencer}
              </p>
            </article>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {PURCHASE_FILTERS.map((filter) => {
              const isActive = lastPurchaseFilter === filter.value;
              return (
                <Link
                  key={filter.value}
                  href={filter.value === "all" ? "/recordatorios" : `/recordatorios?lastPurchase=${filter.value}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          {reminders.length === 0 ? (
            <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
              No hay clientes que coincidan con el filtro seleccionado.
            </div>
          ) : null}

          {reminders.map((reminder) => (
            <article key={reminder.id} className="page-frame rounded-[24px] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {reminder.customer}
                    </h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(reminder.status)}`}>
                      {statusLabel(reminder.status)}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                    <span>Saldo {formatCurrency(reminder.balance)}</span>
                    {reminder.lastContact && (
                      <span className="text-[var(--text-muted)]">Último contacto {reminder.lastContact}</span>
                    )}
                  </div>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                    {reminder.message}
                  </p>
                </div>

                <div className="shrink-0">
                  <ReminderLink
                    href={`https://wa.me/${reminder.phone}?text=${encodeURIComponent(reminder.message)}`}
                    accountId={reminder.id}
                    customerId={reminder.customerId}
                    messagePreview={reminder.message}
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}

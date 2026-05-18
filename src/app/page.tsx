import Link from "next/link";

import { KpiCard, SectionCard } from "@/components/dashboard/cards";
import { CloseCashButton } from "@/components/cash/close-cash-button";
import { OpenCashButton } from "@/components/cash/open-cash-button";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getDashboardData } from "@/server/queries";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { accountsNeedingAttention, cashSnapshot, kpis, orders, recentActivity, reminders, sales } =
    await getDashboardData();

  return (
    <DashboardShell>
      <main className="flex flex-col gap-6 pb-10">
        <section className="grid grid-auto-fit gap-4 md:gap-5">
          {kpis.map((item) => (
            <KpiCard
              key={item.label}
              helper={item.helper}
              label={item.label}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <SectionCard
            title="Cuentas que requieren atención"
            subtitle="Clientes con saldo pendiente, vencimiento visible y acceso directo a cobro."
            action={
              <Link href="/cuentas-corrientes" className="text-sm font-semibold text-[var(--info)]">
                Ver todas
              </Link>
            }
          >
            <div className="space-y-3">
              {accountsNeedingAttention.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Todas las cuentas están al día.
                </p>
              ) : null}
              {accountsNeedingAttention.map((customer) => (
                <article
                  key={customer.id}
                  className="surface-muted flex flex-col gap-4 rounded-[22px] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                        {customer.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(customer.status)}`}
                      >
                        {statusLabel(customer.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {customer.phone} · Vence {customer.nextDueDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Saldo actual
                      </p>
                      <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                        {formatCurrency(customer.balance)}
                      </p>
                    </div>
                    <Link
                      href={`/cuentas-corrientes?panel=payment&accountId=${customer.id}`}
                      className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                    >
                      Registrar pago
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Caja de hoy" subtitle="Lectura rápida del turno actual y del cierre esperado.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-muted rounded-[22px] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Apertura</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  {formatCurrency(cashSnapshot.opening)}
                </p>
              </div>
              <div className="surface-muted rounded-[22px] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Ingresos efectivo</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--success)]">
                  {formatCurrency(cashSnapshot.incomeCash)}
                </p>
              </div>
              <div className="surface-muted rounded-[22px] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Ingresos transferencia</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--info)]">
                  {formatCurrency(cashSnapshot.incomeTransfer)}
                </p>
              </div>
              <div className="surface-muted rounded-[22px] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Ingresos tarjeta</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--info)]">
                  {formatCurrency(cashSnapshot.incomeCard)}
                </p>
              </div>
              <div className="surface-muted rounded-[22px] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Egresos</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--danger)]">
                  {formatCurrency(cashSnapshot.expenses)}
                </p>
              </div>
            </div>
            <div className="surface-walnut mt-4 rounded-[24px] p-5 text-[var(--text-primary)]">
              <p className="text-sm uppercase tracking-[0.18em] text-[rgba(237,242,237,0.72)]">
                Caja esperada
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                {formatCurrency(cashSnapshot.expected)}
              </p>
              {cashSnapshot.sessionStatus === "none" && (
                <OpenCashButton />
              )}
              {cashSnapshot.sessionStatus === "open" && (
                <CloseCashButton
                  expectedAmount={cashSnapshot.expected}
                  expectedCash={cashSnapshot.incomeCash}
                  expectedTransfer={cashSnapshot.incomeTransfer}
                  expectedCard={cashSnapshot.incomeCard}
                />
              )}
              {cashSnapshot.sessionStatus === "closed" && (
                <p className="mt-4 text-sm font-semibold text-[var(--success)]">Caja cerrada hoy ✓</p>
              )}
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr]">
          <SectionCard title="Pedidos activos" subtitle="Pendientes, listos o en proceso con lectura comercial inmediata.">
            <div className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No hay pedidos activos.</p>
              ) : null}
              {orders.map((order) => (
                <article key={order.id} className="surface-muted rounded-[22px] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {order.customer}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    {order.product}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Entrega {order.deliveryDate}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <span>Seña {formatCurrency(order.deposit)}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Saldo {formatCurrency(order.remainingBalance)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Ventas del día" subtitle="Últimos movimientos cargados en el turno.">
            <div className="space-y-3">
              {sales.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Sin ventas cargadas hoy.</p>
              ) : null}
              {sales.map((sale) => (
                <article key={sale.id} className="surface-muted rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{sale.description}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {sale.date} · {sale.method}
                      </p>
                    </div>
                    <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--success)]">
                      {formatCurrency(sale.amount)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recordatorios listos" subtitle="Acceso directo a WhatsApp para deuda vencida o próxima.">
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  No hay clientes con deuda pendiente.
                </p>
              ) : null}
              {reminders.map((reminder) => (
                <article key={reminder.id} className="surface-muted rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{reminder.customer}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Saldo {formatCurrency(reminder.balance)}
                      </p>
                    </div>
                    <a
                      className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                      href={`https://wa.me/${reminder.phone}?text=${encodeURIComponent(reminder.message)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir
                    </a>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    {reminder.message}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>
        </section>

        <SectionCard
          title="Actividad reciente"
          subtitle="Traza operativa de altas, ediciones y registros relevantes."
          action={
            <Link href="/auditoria" className="text-sm font-semibold text-[var(--info)]">
              Ver auditoría
            </Link>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin actividad registrada aún.</p>
            ) : null}
            {recentActivity.map((item) => (
              <article key={item.id} className="surface-muted rounded-[22px] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-[var(--text-primary)]">{item.actor}</p>
                  <span className="rounded-full bg-[rgba(45,76,57,0.16)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                    {item.action}
                  </span>
                  <span className="rounded-full bg-[rgba(154,118,85,0.14)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                    {item.entity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.summary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {item.date}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </main>
    </DashboardShell>
  );
}

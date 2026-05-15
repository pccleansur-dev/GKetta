"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

type AccountSummary = {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  status: string;
  nextDueDate: string;
  balance: number;
};

type AccountsResponse = {
  accounts: AccountSummary[];
  summary: {
    totalBalance: number;
    overdueCount: number;
    activeCount: number;
  };
};

type AccountsPageClientProps = {
  canRegister: boolean;
  initialPanel?: "payment" | null;
  initialAccountId?: string | null;
};

const DEFAULT_DESCRIPTION = "Pago registrado desde cuentas corrientes";

export function AccountsPageClient({
  canRegister,
  initialPanel = null,
  initialAccountId = null,
}: AccountsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [summary, setSummary] = useState<AccountsResponse["summary"]>({
    totalBalance: 0,
    overdueCount: 0,
    activeCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "vencida" | "por vencer">("all");
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"payment" | null>(() => {
    if (initialPanel === "payment" && canRegister) {
      return "payment";
    }

    return null;
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId ?? "");
  const [isPending, startTransition] = useTransition();

  async function fetchAccounts() {
    const response = await fetch("/api/accounts", {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar las cuentas.");
      setAccounts([]);
      setSummary({
        totalBalance: 0,
        overdueCount: 0,
        activeCount: 0,
      });
      setLoading(false);
      return;
    }

    const data = (await response.json()) as AccountsResponse;
    setAccounts(data.accounts);
    setSummary(data.summary);
    setLoading(false);
  }

  function clearPanelUrl() {
    router.replace(pathname, { scroll: false });
  }

  function closePanel() {
    setPanel(null);
    clearPanelUrl();
  }

  function openPaymentPanel(accountId?: string) {
    setError(undefined);
    setSelectedAccountId(accountId ?? "");
    setPanel("payment");
  }

  async function submitPayment(formData: FormData) {
    const payload = {
      accountId: String(formData.get("accountId") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
      description: String(formData.get("description") ?? DEFAULT_DESCRIPTION),
    };

    const response = await fetch("/api/accounts/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo registrar el pago.");
      return;
    }

    setNotice(data?.message ?? "Pago registrado correctamente.");
    closePanel();
    await fetchAccounts();
  }

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      const response = await fetch("/api/accounts", {
        cache: "no-store",
      });

      if (!active) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar las cuentas.");
        setAccounts([]);
        setSummary({
          totalBalance: 0,
          overdueCount: 0,
          activeCount: 0,
        });
        setLoading(false);
        return;
      }

      const data = (await response.json()) as AccountsResponse;

      if (!active) {
        return;
      }

      setAccounts(data.accounts);
      setSummary(data.summary);
      setLoading(false);
    }

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  const fallbackAccount = accounts.find((account) => account.balance > 0) ?? accounts[0] ?? null;
  const effectiveSelectedAccountId = selectedAccountId || fallbackAccount?.id || "";
  const selectedAccount =
    accounts.find((account) => account.id === effectiveSelectedAccountId) ?? fallbackAccount;

  return (
    <main className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="flex flex-col gap-6">
        <FeedbackBanner error={error} notice={notice} />

        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Cuentas corrientes</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Seguimiento de deuda y cobro
              </h1>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Estado actual, saldo pendiente y acceso directo para registrar pagos.
              </p>
            </div>

            {canRegister ? (
              <button
                onClick={() => openPaymentPanel()}
                className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
              >
                Registrar pago
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <article className="surface-walnut rounded-[22px] p-4">
              <p className="text-sm text-[rgba(237,242,237,0.72)]">Saldo total activo</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {formatCurrency(summary.totalBalance)}
              </p>
            </article>
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Cuentas con saldo</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {summary.activeCount}
              </p>
            </article>
            <article className="surface-muted rounded-[22px] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Seguimiento urgente</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--danger)]">
                {summary.overdueCount}
              </p>
            </article>
          </div>
        </section>

        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <div className="border-b border-[var(--border-soft)] pb-5">
            <p className="section-kicker">Cobro sobre cuenta</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Clientes con saldo pendiente
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Cada cobro descuenta saldo, genera movimiento y actualiza caja en el dia.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["all", "vencida", "por vencer"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === s
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
              >
                {s === "all" ? "Todas" : s === "vencida" ? "Vencidas" : "Por vencer"}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-[var(--text-secondary)]">Cargando cuentas...</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)]">
                No hay cuentas corrientes con datos cargados.
              </div>
            ) : (
              accounts
                .filter((account) => statusFilter === "all" || account.status === statusFilter)
                .map((account) => (
                <article
                  key={account.id}
                  className="surface-muted flex flex-col gap-4 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                        {account.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(account.status)}`}
                      >
                        {statusLabel(account.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {account.phone} · Vence {account.nextDueDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {formatCurrency(account.balance)}
                    </p>
                    {canRegister ? (
                      <button
                        onClick={() => openPaymentPanel(account.id)}
                        className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                      >
                        Cobrar
                      </button>
                    ) : (
                      <span className="text-sm text-[var(--text-muted)]">Solo lectura</span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="flex flex-col gap-6">
        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <p className="section-kicker">Criterio operativo</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
            <div className="surface-muted rounded-[22px] p-4">
              Prioriza clientes vencidos antes del cierre del día y deja visible la próxima fecha
              de seguimiento.
            </div>
            <div className="surface-muted rounded-[22px] p-4">
              Cada pago nuevo impacta en cuenta, recordatorios y caja para no duplicar carga
              manual.
            </div>
          </div>
        </section>
      </section>

      {panel ? (
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />

          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">Registrar pago</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  Cobro sobre cuenta corriente
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  Panel compacto para registrar el cobro sin salir de la pantalla.
                </p>
              </div>

              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {!canRegister ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para registrar pagos.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(undefined);
                  startTransition(async () => {
                    const formData = new FormData(event.currentTarget);
                    await submitPayment(formData);
                  });
                }}
                className="overlay-panel-form"
              >
                {selectedAccount ? (
                  <div className="surface-muted rounded-[22px] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {selectedAccount.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Vence {selectedAccount.nextDueDate}
                        </p>
                      </div>
                      <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                        {formatCurrency(selectedAccount.balance)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="compact-form-grid">
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="accountId">
                      Cliente / cuenta
                    </label>
                    <select
                      id="accountId"
                      name="accountId"
                      value={effectiveSelectedAccountId}
                      onChange={(event) => setSelectedAccountId(event.target.value)}
                      required
                      className="field-select"
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {formatCurrency(account.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="amount">
                      Importe
                    </label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="paymentMethod">
                      Medio de pago
                    </label>
                    <select id="paymentMethod" name="paymentMethod" required className="field-select">
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="mixed">Mixto</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="description">
                      Descripción
                    </label>
                    <input
                      id="description"
                      name="description"
                      defaultValue={DEFAULT_DESCRIPTION}
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="overlay-panel-actions">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Registrando..." : "Registrar pago"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

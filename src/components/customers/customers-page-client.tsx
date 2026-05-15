"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

type CustomerSummary = {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  status: string;
  nextDueDate: string;
  balance: number;
};

type CustomerDetail = {
  customerId: string;
  accountId: string;
  fullName: string;
  phone: string;
  documentNumber: string;
  notes: string;
  monthlyDueDay: number | string;
  dueDate: string;
  isTrusted: boolean;
};

type CustomersPageClientProps = {
  canManage: boolean;
  initialPanel?: "new" | null;
};

export function CustomersPageClient({
  canManage,
  initialPanel = null,
}: CustomersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"new" | "edit" | null>(() => {
    if (initialPanel === "new" && canManage) {
      return "new";
    }

    return null;
  });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function fetchCustomers() {
    const response = await fetch("/api/customers", {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar los clientes.");
      setCustomers([]);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as CustomerSummary[];
    setCustomers(data);
    setLoading(false);
  }

  async function fetchCustomerDetail(customerId: string, showPending = true) {
    if (showPending) {
      setLoadingDetail(true);
    }

    const response = await fetch(`/api/customers/${customerId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo cargar el cliente.");
      setPanel(null);
      setSelectedCustomer(null);
      setLoadingDetail(false);
      return;
    }

    const data = (await response.json()) as CustomerDetail;
    setSelectedCustomer(data);
    setPanel("edit");
    setLoadingDetail(false);
  }

  function clearPanelUrl() {
    router.replace(pathname, { scroll: false });
  }

  function closePanel() {
    setPanel(null);
    setSelectedCustomer(null);
    setLoadingDetail(false);
    clearPanelUrl();
  }

  function openCreatePanel() {
    setError(undefined);
    setSelectedCustomer(null);
    setPanel("new");
  }

  function openEditPanel(customerId: string) {
    setError(undefined);
    setPanel("edit");
    void fetchCustomerDetail(customerId);
  }

  async function submitCreate(formData: FormData) {
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      monthlyDueDay: String(formData.get("monthlyDueDay") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      openingBalance: String(formData.get("openingBalance") ?? "0"),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el cliente.");
      return;
    }

    setNotice(data?.message ?? "Cliente creado correctamente.");
    closePanel();
    await fetchCustomers();
  }

  async function submitDelete() {
    if (!selectedCustomer) return;
    const response = await fetch(`/api/customers/${selectedCustomer.customerId}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setError(data?.error ?? "No se pudo eliminar el cliente.");
      return;
    }
    setNotice(data?.message ?? "Cliente eliminado correctamente.");
    closePanel();
    await fetchCustomers();
  }

  async function submitUpdate(formData: FormData) {
    if (!selectedCustomer) {
      return;
    }

    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      monthlyDueDay: String(formData.get("monthlyDueDay") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      isTrusted: String(formData.get("isTrusted") ?? "false"),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch(`/api/customers/${selectedCustomer.customerId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el cliente.");
      return;
    }

    setNotice(data?.message ?? "Cliente actualizado correctamente.");
    closePanel();
    await fetchCustomers();
  }

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      if (!active) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar los clientes.");
        setCustomers([]);
        setLoading(false);
        return;
      }

      const data = (await response.json()) as CustomerSummary[];

      if (!active) {
        return;
      }

      setCustomers(data);
      setLoading(false);
    }

    void loadCustomers();

    return () => {
      active = false;
    };
  }, []);

  const overdueCount = customers.filter((customer) => customer.status === "vencida").length;
  const totalBalance = customers.reduce((sum, customer) => sum + customer.balance, 0);

  return (
    <main className="flex flex-col gap-6">
      <FeedbackBanner error={error} notice={notice} />

      <section className="page-frame rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Gestión de clientes</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Clientes con cuenta personal
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Directorio operativo con saldo, vencimiento y estado comercial por cliente.
            </p>
          </div>

          {canManage ? (
            <button
              onClick={openCreatePanel}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
            >
              Nuevo cliente
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Clientes activos</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {customers.length}
            </p>
          </article>
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Cuentas vencidas</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--danger)]">
              {overdueCount}
            </p>
          </article>
          <article className="surface-walnut rounded-[22px] p-4">
            <p className="text-sm text-[rgba(237,242,237,0.72)]">Saldo administrado</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {formatCurrency(totalBalance)}
            </p>
          </article>
        </div>
      </section>

      <section className="page-frame overflow-hidden rounded-[30px]">
        {loading ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">Cargando clientes...</div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-secondary)]">
            TodavÃ­a no hay clientes cargados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-left text-sm">
              <thead className="text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-4 font-semibold">Cliente</th>
                  <th className="px-4 py-4 font-semibold">TelÃ©fono</th>
                  <th className="px-4 py-4 font-semibold">Estado</th>
                  <th className="px-4 py-4 font-semibold">PrÃ³ximo vencimiento</th>
                  <th className="px-4 py-4 font-semibold text-right">Saldo</th>
                  <th className="px-4 py-4 font-semibold text-right">AcciÃ³n</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-4 font-semibold text-[var(--text-primary)]">
                      {customer.name}
                    </td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">{customer.phone}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(customer.status)}`}
                      >
                        {statusLabel(customer.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[var(--text-secondary)]">
                      {customer.nextDueDate}
                    </td>
                    <td className="px-4 py-4 text-right text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                      {formatCurrency(customer.balance)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {canManage ? (
                        <button
                          onClick={() => openEditPanel(customer.customerId)}
                          className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                        >
                          Editar
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {panel ? (
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />

          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">
                  {panel === "new" ? "Alta de cliente" : "Editar cliente"}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  {panel === "new" ? "Crear cliente y cuenta personal" : "Ajustar datos y vencimiento"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  {panel === "new"
                    ? "CargÃ¡ los datos base y, si hace falta, un saldo inicial para arrancar la cuenta corriente."
                    : "CorregÃ­ datos del cliente y actualizÃ¡ la cuenta personal desde este panel."}
                </p>
              </div>

              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              {!canManage ? (
                <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Tu perfil no tiene permiso para editar clientes.
                </p>
              ) : panel === "edit" && loadingDetail ? (
                <p className="text-sm text-[var(--text-secondary)]">Cargando datos del cliente...</p>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setError(undefined);
                    startTransition(async () => {
                      const formData = new FormData(event.currentTarget);
                      if (panel === "new") {
                        await submitCreate(formData);
                      } else {
                        await submitUpdate(formData);
                      }
                    });
                  }}
                  className="overlay-panel-form"
                >
                  {panel === "edit" && selectedCustomer ? (
                    <div className="surface-muted rounded-[22px] px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-[var(--text-secondary)]">Saldo actual</p>
                          <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                            {formatCurrency(
                              customers.find((customer) => customer.customerId === selectedCustomer.customerId)?.balance ??
                                0,
                            )}
                          </p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Cuenta personal
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="compact-form-grid">
                    <div>
                      <label className="field-label" htmlFor="fullName">
                        Nombre completo
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        defaultValue={selectedCustomer?.fullName ?? ""}
                        required
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="phone">
                        Teléfono
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        defaultValue={selectedCustomer?.phone ?? ""}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="documentNumber">
                        Documento
                      </label>
                      <input
                        id="documentNumber"
                        name="documentNumber"
                        defaultValue={selectedCustomer?.documentNumber ?? ""}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="monthlyDueDay">
                        Día de vencimiento mensual
                      </label>
                      <input
                        id="monthlyDueDay"
                        name="monthlyDueDay"
                        type="number"
                        min="1"
                        max="31"
                        defaultValue={selectedCustomer?.monthlyDueDay ?? ""}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="dueDate">
                        Próximo vencimiento
                      </label>
                      <input
                        id="dueDate"
                        name="dueDate"
                        type="date"
                        defaultValue={selectedCustomer?.dueDate ?? ""}
                        className="field-input"
                      />
                    </div>

                    {panel === "new" ? (
                      <div>
                        <label className="field-label" htmlFor="openingBalance">
                          Saldo inicial
                        </label>
                        <input
                          id="openingBalance"
                          name="openingBalance"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                          className="field-input"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="field-label" htmlFor="isTrusted">
                          Cliente de confianza
                        </label>
                        <select
                          id="isTrusted"
                          name="isTrusted"
                          defaultValue={String(selectedCustomer?.isTrusted ?? false)}
                          className="field-select"
                        >
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <label className="field-label" htmlFor="notes">
                        Notas
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        defaultValue={selectedCustomer?.notes ?? ""}
                        className="field-textarea min-h-[88px] resize-none"
                      />
                    </div>
                  </div>

                  <div className="overlay-panel-actions gap-3">
                    {panel === "edit" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${selectedCustomer?.fullName ?? "este cliente"}? Esta acción no se puede deshacer.`)) {
                            startTransition(async () => { await submitDelete(); });
                          }
                        }}
                        className="rounded-full border border-[rgba(168,106,97,0.28)] bg-[rgba(168,106,97,0.08)] px-4 py-3 text-sm font-semibold text-[var(--danger)] transition hover:bg-[rgba(168,106,97,0.14)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Eliminar
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isPending || loadingDetail}
                      className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isPending
                        ? panel === "new"
                          ? "Guardando..."
                          : "Actualizando..."
                        : panel === "new"
                          ? "Guardar cliente"
                          : "Actualizar cliente"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

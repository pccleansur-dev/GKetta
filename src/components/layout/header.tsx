import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import type { SessionUser } from "@/lib/session";

const roleLabels: Record<SessionUser["role"], string> = {
  owner: "Dueño",
  manager: "Encargada",
  staff: "Empleada",
};

export function Header({ currentUser, businessName = "Sistema Kettal" }: { currentUser: SessionUser; businessName?: string }) {
  const canCreateCustomers = currentUser.role === "owner" || currentUser.role === "manager";

  return (
    <header className="surface executive-card flex flex-col gap-6 rounded-[28px] px-5 py-5 sm:px-6 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Biophilic executive
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">
          Operación comercial, pedidos y finanzas con criterio premium
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
          {businessName} centraliza clientes, cuentas corrientes, pedidos puntuales, ventas y caja con
          una interfaz sobria, cálida y de lectura prolongada pensada para operación
          administrativa diaria.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-[var(--text-primary)]">
            {currentUser.fullName} · {roleLabels[currentUser.role]}
          </div>
          <LogoutButton
            label="Salir"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {canCreateCustomers ? (
            <Link
              href="/clientes?panel=new"
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
            >
              Nuevo cliente
            </Link>
          ) : (
            <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">
              Nuevo cliente
            </div>
          )}
          <Link
            href="/ventas?panel=new"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
          >
            Registrar venta
          </Link>
          <Link
            href="/pedidos?panel=new"
            className="rounded-full bg-[var(--primary)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_35px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)]"
          >
            Cargar pedido
          </Link>
        </div>
      </div>
    </header>
  );
}

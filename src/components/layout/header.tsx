import Link from "next/link";

import type { SessionUser } from "@/lib/session";

export function Header({ currentUser }: { currentUser: SessionUser }) {
  const canCreateCustomers = currentUser.role === "owner" || currentUser.role === "manager";

  return (
    <header className="surface executive-card rounded-[28px] px-5 py-5 sm:px-6">
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
    </header>
  );
}

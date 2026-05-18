import Link from "next/link";

import type { SessionUser } from "@/lib/session";

export function Header({ currentUser, businessName = "Sistema Kettal" }: { currentUser: SessionUser; businessName?: string }) {
  const canCreateCustomers = currentUser.role === "owner" || currentUser.role === "manager";

  return (
    <header className="surface executive-card rounded-[28px] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-kicker">Panel administrativo</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
            {businessName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateCustomers ? (
            <Link
              href="/clientes?panel=new"
              className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
            >
              Nuevo cliente
            </Link>
          ) : (
            <span className="rounded-[18px] border border-[var(--border-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--text-muted)] opacity-50">
              Nuevo cliente
            </span>
          )}

          <Link
            href="/ventas?panel=new"
            className="rounded-[18px] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.35)] transition hover:bg-[var(--primary-dark)]"
          >
            Registrar venta
          </Link>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { navItems } from "@/lib/mock-data";
import type { SessionUser } from "@/lib/session";

const roleLabels: Record<SessionUser["role"], string> = {
  owner: "Administrador",
  manager: "Encargada",
  staff: "Empleada",
};

export function Sidebar({ currentUser }: { currentUser: SessionUser }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="surface executive-card sticky top-6 hidden h-[calc(100vh-3rem)] w-[286px] shrink-0 rounded-[28px] p-5 lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(154,118,85,0.35)] bg-[linear-gradient(180deg,#284334,#1f3428)] text-lg font-semibold text-[#f2f1eb]">
            K
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Sistema Kettal
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Panel administrativo</p>
          </div>
        </div>

        <div className="mb-5 rounded-[24px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
          <p className="section-kicker">Sesion</p>
          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
            {currentUser.fullName}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{roleLabels[currentUser.role]}</p>
          <div className="mt-4">
            <LogoutButton
              label="Cerrar sesion"
              className="w-full rounded-full border border-[rgba(154,118,85,0.34)] bg-[rgba(123,91,62,0.16)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(123,91,62,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(currentUser.role))
            .map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[linear-gradient(180deg,#2d4c39,#243d2e)] text-[#f1f4ef] shadow-[0_16px_35px_rgba(29,53,39,0.35)]"
                      : "text-[var(--text-secondary)] hover:bg-[rgba(123,91,62,0.08)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="surface-walnut rounded-[24px] p-5 text-[#edf2ed]">
            <button className="w-full rounded-full border border-[rgba(154,118,85,0.34)] bg-[rgba(123,91,62,0.16)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(123,91,62,0.24)]">
              Ir a caja
            </button>
          </div>

          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
            <p className="section-kicker">Uso diario</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Prioriza cuentas vencidas, pedidos con entrega proxima y ventas del turno para
              sostener el ritmo operativo del local.
            </p>
          </div>
        </div>
      </aside>

      <nav className="surface fixed inset-x-4 bottom-4 z-40 flex items-center gap-1 overflow-x-auto rounded-[22px] px-2 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems
          .filter((item) => !item.roles || item.roles.includes(currentUser.role))
          .map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-[linear-gradient(180deg,#2d4c39,#243d2e)] text-[#f1f4ef]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="block h-1.5 w-1.5 rounded-full bg-current" />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}

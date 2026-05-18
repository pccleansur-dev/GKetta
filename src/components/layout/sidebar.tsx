"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/lib/mock-data";
import type { SessionUser } from "@/lib/session";

export function Sidebar({ currentUser }: { currentUser: SessionUser }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="surface executive-card sticky top-6 hidden h-[calc(100vh-3rem)] w-[328px] shrink-0 rounded-[28px] p-6 lg:flex lg:flex-col lg:overflow-hidden">
        <div className="mb-9 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(154,118,85,0.35)] bg-[linear-gradient(180deg,#284334,#1f3428)] text-lg font-semibold text-[#f2f1eb]">
            K
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Sistema Kettal
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Panel Admin</p>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1 [scrollbar-color:rgba(128,164,137,0.34)_transparent]">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(currentUser.role))
            .map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-14 items-center justify-between rounded-2xl px-5 py-4 text-base font-semibold transition ${
                    isActive
                      ? "bg-[linear-gradient(180deg,#2d4c39,#243d2e)] text-[#f1f4ef] shadow-[0_16px_35px_rgba(29,53,39,0.35)]"
                      : "text-[var(--text-secondary)] hover:bg-[rgba(123,91,62,0.08)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
                </Link>
              );
            })}
        </nav>
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

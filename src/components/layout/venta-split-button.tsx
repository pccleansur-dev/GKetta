"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function VentaSplitButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex overflow-hidden rounded-[18px] border border-[rgba(154,118,85,0.28)]">
        <Link
          href="/ventas?panel=new"
          className="flex-1 bg-[rgba(123,91,62,0.1)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[rgba(123,91,62,0.18)]"
        >
          Registrar venta
        </Link>
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Más opciones"
          className="border-l border-[rgba(154,118,85,0.28)] bg-[rgba(123,91,62,0.1)] px-3 transition hover:bg-[rgba(123,91,62,0.18)]"
        >
          <span
            className={`block text-xs text-[var(--text-secondary)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-[14px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <Link
            href="/pedidos?panel=new"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
          >
            Con seña · Entrega diferida
          </Link>
        </div>
      )}
    </div>
  );
}

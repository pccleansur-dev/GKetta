import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string;
  helper: string;
  tone: "danger" | "warning" | "success" | "info";
};

const toneMap: Record<KpiCardProps["tone"], string> = {
  danger: "from-[rgba(168,106,97,0.24)] to-[rgba(168,106,97,0.03)] text-[var(--danger)]",
  warning: "from-[rgba(154,118,85,0.24)] to-[rgba(154,118,85,0.03)] text-[var(--warning)]",
  success: "from-[rgba(93,143,108,0.22)] to-[rgba(93,143,108,0.03)] text-[var(--success)]",
  info: "from-[rgba(125,153,134,0.18)] to-[rgba(125,153,134,0.03)] text-[var(--info)]",
};

export function KpiCard({ label, value, helper, tone }: KpiCardProps) {
  return (
    <article className="surface executive-card rounded-[26px] p-5">
      <div
        className={`mb-6 inline-flex rounded-full bg-gradient-to-br px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${toneMap[tone]}`}
      >
        {label}
      </div>
      <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{helper}</p>
    </article>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page-frame executive-card rounded-[30px] p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Vista ejecutiva</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusLabel(status: string) {
  switch (status) {
    case "al dia":
      return "al día";
    default:
      return status;
  }
}

export function statusPill(status: string) {
  switch (status) {
    case "vencida":
      return "bg-[rgba(181,65,60,0.12)] text-[var(--danger)]";
    case "por vencer":
    case "en proceso":
    case "confirmado":
      return "bg-[rgba(200,135,47,0.14)] text-[var(--warning)]";
    case "al dia":
    case "entregado":
    case "listo":
      return "bg-[rgba(63,122,92,0.12)] text-[var(--success)]";
    default:
      return "bg-[rgba(94,122,138,0.12)] text-[var(--info)]";
  }
}


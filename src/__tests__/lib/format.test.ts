import { describe, expect, it } from "vitest";

import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

describe("formatCurrency", () => {
  it("formatea cero como moneda ARS", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
    expect(result).toMatch(/\$|ARS/);
  });

  it("formatea valores positivos", () => {
    const result = formatCurrency(1000);
    expect(result).toContain("1");
    expect(result).toContain("000");
  });

  it("formatea valores negativos", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500");
  });
});

describe("statusLabel", () => {
  it('convierte "al dia" a "al día"', () => {
    expect(statusLabel("al dia")).toBe("al día");
  });

  it("retorna el estado sin cambios si no tiene mapeo", () => {
    expect(statusLabel("vencida")).toBe("vencida");
    expect(statusLabel("confirmado")).toBe("confirmado");
    expect(statusLabel("en proceso")).toBe("en proceso");
  });
});

describe("statusPill", () => {
  it('aplica clase danger para "vencida"', () => {
    expect(statusPill("vencida")).toContain("danger");
  });

  it('aplica clase warning para "por vencer" y "en proceso"', () => {
    expect(statusPill("por vencer")).toContain("warning");
    expect(statusPill("en proceso")).toContain("warning");
    expect(statusPill("confirmado")).toContain("warning");
  });

  it('aplica clase success para "al dia", "listo" y "entregado"', () => {
    expect(statusPill("al dia")).toContain("success");
    expect(statusPill("listo")).toContain("success");
    expect(statusPill("entregado")).toContain("success");
  });

  it("aplica clase info para estados desconocidos", () => {
    expect(statusPill("desconocido")).toContain("info");
  });
});

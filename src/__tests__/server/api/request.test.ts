import { describe, expect, it } from "vitest";

import {
  asOptionalBoolean,
  asOptionalDate,
  asOptionalNumber,
  asOptionalString,
  asRequiredString,
} from "@/server/api/request";

describe("asOptionalString", () => {
  it("retorna null para valores vacíos y nulos", () => {
    expect(asOptionalString(null)).toBeNull();
    expect(asOptionalString(undefined)).toBeNull();
    expect(asOptionalString("")).toBeNull();
    expect(asOptionalString("   ")).toBeNull();
  });

  it("retorna el string trimmeado", () => {
    expect(asOptionalString("  hola  ")).toBe("hola");
    expect(asOptionalString("texto")).toBe("texto");
  });

  it("retorna null para tipos no string", () => {
    expect(asOptionalString(123)).toBeNull();
    expect(asOptionalString(true)).toBeNull();
  });
});

describe("asRequiredString", () => {
  it("retorna el valor cuando está presente", () => {
    expect(asRequiredString("correo@kettal.local", "el correo")).toBe("correo@kettal.local");
  });

  it("lanza error cuando el valor está vacío", () => {
    expect(() => asRequiredString("", "el nombre")).toThrow("el nombre");
    expect(() => asRequiredString(null, "el campo")).toThrow("el campo");
  });
});

describe("asOptionalNumber", () => {
  it("parsea strings numéricos", () => {
    expect(asOptionalNumber("1500")).toBe(1500);
    expect(asOptionalNumber("1.5")).toBe(1.5);
  });

  it("acepta comas como separador decimal", () => {
    expect(asOptionalNumber("1,5")).toBe(1.5);
  });

  it("retorna null para vacío o nulo", () => {
    expect(asOptionalNumber("")).toBeNull();
    expect(asOptionalNumber(null)).toBeNull();
  });

  it("retorna NaN para texto no numérico", () => {
    expect(asOptionalNumber("abc")).toBeNaN();
  });

  it("acepta números directamente", () => {
    expect(asOptionalNumber(42)).toBe(42);
  });
});

describe("asOptionalDate", () => {
  it("parsea fechas en formato YYYY-MM-DD", () => {
    const date = asOptionalDate("2026-05-15");
    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(4); // mayo = 4
    expect(date?.getDate()).toBe(15);
  });

  it("retorna null para valores vacíos", () => {
    expect(asOptionalDate("")).toBeNull();
    expect(asOptionalDate(null)).toBeNull();
  });

  it("retorna null para fechas inválidas", () => {
    expect(asOptionalDate("no-es-fecha")).toBeNull();
  });
});

describe("asOptionalBoolean", () => {
  it("parsea booleanos directos", () => {
    expect(asOptionalBoolean(true)).toBe(true);
    expect(asOptionalBoolean(false)).toBe(false);
  });

  it('parsea strings "true" y "false"', () => {
    expect(asOptionalBoolean("true")).toBe(true);
    expect(asOptionalBoolean("false")).toBe(false);
  });

  it("retorna null para otros valores", () => {
    expect(asOptionalBoolean("si")).toBeNull();
    expect(asOptionalBoolean(null)).toBeNull();
    expect(asOptionalBoolean(1)).toBeNull();
  });
});

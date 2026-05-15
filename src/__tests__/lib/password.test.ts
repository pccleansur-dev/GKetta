import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("produce un hash con formato scrypt:salt:hash", () => {
    const hash = hashPassword("mi-contrasena-123");
    const parts = hash.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toHaveLength(32);
  });

  it("verifica correctamente una contraseña válida", () => {
    const password = "KettalManager2026!";
    const hash = hashPassword(password);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", () => {
    const hash = hashPassword("correcta");
    expect(verifyPassword("incorrecta", hash)).toBe(false);
  });

  it("dos hashes del mismo password son distintos (salt aleatorio)", () => {
    const hash1 = hashPassword("misma");
    const hash2 = hashPassword("misma");
    expect(hash1).not.toBe(hash2);
  });

  it("rechaza un hash con formato inválido", () => {
    expect(verifyPassword("cualquiera", "formato-invalido")).toBe(false);
    expect(verifyPassword("cualquiera", "")).toBe(false);
  });
});

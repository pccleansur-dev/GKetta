import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  canCreateOrders,
  canCreateSales,
  canEditOrders,
  canManageCustomers,
  canManageUsers,
  canRegisterPayments,
  canViewAuditLogs,
} from "@/lib/session";

describe("permisos por rol", () => {
  describe("canManageCustomers", () => {
    it("owner y manager pueden gestionar clientes", () => {
      expect(canManageCustomers("owner")).toBe(true);
      expect(canManageCustomers("manager")).toBe(true);
    });
    it("staff no puede gestionar clientes", () => {
      expect(canManageCustomers("staff")).toBe(false);
    });
  });

  describe("canRegisterPayments", () => {
    it("todos los roles pueden registrar pagos", () => {
      expect(canRegisterPayments("owner")).toBe(true);
      expect(canRegisterPayments("manager")).toBe(true);
      expect(canRegisterPayments("staff")).toBe(true);
    });
  });

  describe("canCreateOrders", () => {
    it("todos los roles pueden crear pedidos", () => {
      expect(canCreateOrders("owner")).toBe(true);
      expect(canCreateOrders("manager")).toBe(true);
      expect(canCreateOrders("staff")).toBe(true);
    });
  });

  describe("canEditOrders", () => {
    it("owner y manager pueden editar pedidos", () => {
      expect(canEditOrders("owner")).toBe(true);
      expect(canEditOrders("manager")).toBe(true);
    });
    it("staff no puede editar pedidos", () => {
      expect(canEditOrders("staff")).toBe(false);
    });
  });

  describe("canCreateSales", () => {
    it("todos los roles pueden registrar ventas", () => {
      expect(canCreateSales("owner")).toBe(true);
      expect(canCreateSales("manager")).toBe(true);
      expect(canCreateSales("staff")).toBe(true);
    });
  });

  describe("canManageUsers", () => {
    it("solo owner puede gestionar usuarios", () => {
      expect(canManageUsers("owner")).toBe(true);
    });
    it("manager y staff no pueden gestionar usuarios", () => {
      expect(canManageUsers("manager")).toBe(false);
      expect(canManageUsers("staff")).toBe(false);
    });
  });

  describe("canViewAuditLogs", () => {
    it("owner y manager pueden ver auditoría", () => {
      expect(canViewAuditLogs("owner")).toBe(true);
      expect(canViewAuditLogs("manager")).toBe(true);
    });
    it("staff no puede ver auditoría", () => {
      expect(canViewAuditLogs("staff")).toBe(false);
    });
  });
});

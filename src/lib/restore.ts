import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type BackupData = {
  version: string;
  createdAt: string;
  data: {
    users: Record<string, unknown>[];
    systemConfig: Record<string, unknown>[];
    customers: Record<string, unknown>[];
    customerAccounts: Record<string, unknown>[];
    accountMovements: Record<string, unknown>[];
    orders: Record<string, unknown>[];
    sales: Record<string, unknown>[];
    cashSessions: Record<string, unknown>[];
    cashMovements: Record<string, unknown>[];
  };
};

export function validateBackup(raw: unknown): BackupData {
  if (!raw || typeof raw !== "object") throw new Error("Archivo inválido.");
  const obj = raw as Record<string, unknown>;
  if (!obj.version || !obj.createdAt || !obj.data) throw new Error("Estructura del backup inválida.");
  const data = obj.data as Record<string, unknown>;
  const required = ["users", "customers", "customerAccounts", "accountMovements", "orders", "sales", "cashSessions", "cashMovements"];
  for (const key of required) {
    if (!Array.isArray(data[key])) throw new Error(`El backup no contiene la tabla "${key}".`);
  }
  return obj as BackupData;
}

export function getBackupPreview(backup: BackupData) {
  const config = backup.data.systemConfig ?? [];
  const businessNameEntry = config.find((c) => (c as Record<string, unknown>).key === "business_name") as Record<string, unknown> | undefined;
  return {
    businessName: (businessNameEntry?.value as string) ?? "Sistema Kettal",
    createdAt: backup.createdAt,
    counts: {
      clientes: backup.data.customers.length,
      cuentas: backup.data.customerAccounts.length,
      pedidos: backup.data.orders.length,
      ventas: backup.data.sales.length,
      movimientos: backup.data.accountMovements.length,
      sesionesDeEaja: backup.data.cashSessions.length,
    },
  };
}

export async function restoreFromBackup(backup: BackupData, newAdminPassword: string) {
  await db.$transaction(
    async (tx) => {
      // Borrar en orden inverso a FK
      await tx.cashMovement.deleteMany();
      await tx.cashSession.deleteMany();
      await tx.sale.deleteMany();
      await tx.order.deleteMany();
      await tx.accountMovement.deleteMany();
      await tx.customerAccount.deleteMany();
      await tx.customer.deleteMany();
      await tx.systemConfig.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.reminderLog.deleteMany();
      await tx.user.deleteMany();

      // Restaurar usuarios
      for (const user of backup.data.users) {
        const u = user as Record<string, unknown>;
        await tx.user.create({
          data: {
            id: u.id as string,
            fullName: u.fullName as string,
            email: u.email as string,
            role: u.role as "owner" | "manager" | "staff",
            isActive: u.isActive as boolean,
            passwordHash: u.passwordHash as string | null ?? null,
            passwordUpdatedAt: u.passwordUpdatedAt ? new Date(u.passwordUpdatedAt as string) : null,
            createdAt: new Date(u.createdAt as string),
            updatedAt: new Date((u.updatedAt as string) ?? u.createdAt as string),
          },
        });
      }

      // Actualizar contraseña del owner
      const owner = await tx.user.findFirst({
        where: { role: "owner", isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (owner) {
        await tx.user.update({
          where: { id: owner.id },
          data: { passwordHash: hashPassword(newAdminPassword), passwordUpdatedAt: new Date() },
        });
      }

      // Restaurar config del sistema (sin el flag setup_completed)
      for (const cfg of backup.data.systemConfig ?? []) {
        const c = cfg as Record<string, unknown>;
        if (c.key === "setup_completed") continue;
        await tx.systemConfig.upsert({
          where: { key: c.key as string },
          update: { value: c.value as string },
          create: { key: c.key as string, value: c.value as string },
        });
      }

      // Restaurar clientes
      for (const row of backup.data.customers) {
        const r = row as Record<string, unknown>;
        await tx.customer.create({
          data: {
            id: r.id as string,
            fullName: r.fullName as string,
            phone: r.phone as string | null ?? null,
            documentNumber: r.documentNumber as string | null ?? null,
            notes: r.notes as string | null ?? null,
            isTrusted: (r.isTrusted as boolean) ?? true,
            monthlyDueDay: r.monthlyDueDay as number | null ?? null,
            createdAt: new Date(r.createdAt as string),
            updatedAt: new Date((r.updatedAt as string) ?? r.createdAt as string),
            deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
          },
        });
      }

      // Restaurar cuentas corrientes
      for (const row of backup.data.customerAccounts) {
        const r = row as Record<string, unknown>;
        await tx.customerAccount.create({
          data: {
            id: r.id as string,
            customerId: r.customerId as string,
            status: r.status as "active" | "settled" | "overdue" | "paused",
            currentBalance: Number(r.currentBalance),
            creditLimit: r.creditLimit != null ? Number(r.creditLimit) : null,
            dueDate: r.dueDate ? new Date(r.dueDate as string) : null,
            notes: r.notes as string | null ?? null,
            openedAt: new Date(r.openedAt as string),
            createdAt: new Date(r.createdAt as string),
            updatedAt: new Date((r.updatedAt as string) ?? r.createdAt as string),
            deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
          },
        });
      }

      // Restaurar pedidos
      for (const row of backup.data.orders) {
        const r = row as Record<string, unknown>;
        await tx.order.create({
          data: {
            id: r.id as string,
            customerId: r.customerId as string,
            productName: r.productName as string,
            totalAmount: Number(r.totalAmount),
            depositAmount: Number(r.depositAmount),
            remainingBalance: Number(r.remainingBalance),
            status: r.status as "pending" | "confirmed" | "in_progress" | "ready" | "delivered" | "cancelled",
            deliveryDate: r.deliveryDate ? new Date(r.deliveryDate as string) : null,
            notes: r.notes as string | null ?? null,
            paymentConfirmationStatus: r.paymentConfirmationStatus as "pending" | "confirmed" | "rejected",
            createdBy: r.createdBy as string,
            createdAt: new Date(r.createdAt as string),
            updatedAt: new Date((r.updatedAt as string) ?? r.createdAt as string),
          },
        });
      }

      // Restaurar ventas
      for (const row of backup.data.sales) {
        const r = row as Record<string, unknown>;
        await tx.sale.create({
          data: {
            id: r.id as string,
            saleDate: new Date(r.saleDate as string),
            description: r.description as string,
            category: r.category as "local" | "pedido" | "cuenta_corriente" | "otros",
            amount: Number(r.amount),
            paymentMethod: r.paymentMethod as "cash" | "transfer" | "card" | "mixed",
            relatedCustomerId: r.relatedCustomerId as string | null ?? null,
            relatedOrderId: r.relatedOrderId as string | null ?? null,
            notes: r.notes as string | null ?? null,
            createdBy: r.createdBy as string,
            createdAt: new Date(r.createdAt as string),
          },
        });
      }

      // Restaurar movimientos de cuenta
      for (const row of backup.data.accountMovements) {
        const r = row as Record<string, unknown>;
        await tx.accountMovement.create({
          data: {
            id: r.id as string,
            accountId: r.accountId as string,
            customerId: r.customerId as string,
            relatedSaleId: r.relatedSaleId as string | null ?? null,
            movementType: r.movementType as "charge" | "payment" | "adjustment" | "forgiven",
            amount: Number(r.amount),
            paymentMethod: r.paymentMethod as "cash" | "transfer" | "card" | "mixed" | null ?? null,
            description: r.description as string,
            referenceNote: r.referenceNote as string | null ?? null,
            createdBy: r.createdBy as string,
            movementDate: new Date(r.movementDate as string),
            createdAt: new Date(r.createdAt as string),
          },
        });
      }

      // Restaurar sesiones de caja
      for (const row of backup.data.cashSessions) {
        const r = row as Record<string, unknown>;
        await tx.cashSession.create({
          data: {
            id: r.id as string,
            sessionDate: new Date(r.sessionDate as string),
            openingAmount: Number(r.openingAmount),
            closingAmount: r.closingAmount != null ? Number(r.closingAmount) : null,
            expectedAmount: Number(r.expectedAmount),
            differenceAmount: Number(r.differenceAmount),
            notes: r.notes as string | null ?? null,
            openedBy: r.openedBy as string,
            closedBy: r.closedBy as string | null ?? null,
            closedAt: r.closedAt ? new Date(r.closedAt as string) : null,
            createdAt: new Date(r.createdAt as string),
          },
        });
      }

      // Restaurar movimientos de caja
      for (const row of backup.data.cashMovements) {
        const r = row as Record<string, unknown>;
        await tx.cashMovement.create({
          data: {
            id: r.id as string,
            cashSessionId: r.cashSessionId as string,
            movementType: r.movementType as "income" | "expense" | "adjustment",
            source: r.source as "sale" | "payment" | "manual" | "withdrawal" | "deposit",
            amount: Number(r.amount),
            paymentMethod: r.paymentMethod as "cash" | "transfer" | "card" | "mixed",
            description: r.description as string,
            relatedSaleId: r.relatedSaleId as string | null ?? null,
            relatedAccountMovementId: r.relatedAccountMovementId as string | null ?? null,
            createdBy: r.createdBy as string,
            createdAt: new Date(r.createdAt as string),
          },
        });
      }

      // Marcar setup como completo
      await tx.systemConfig.upsert({
        where: { key: "setup_completed" },
        update: { value: "true" },
        create: { key: "setup_completed", value: "true" },
      });
    },
    { timeout: 60000 },
  );
}

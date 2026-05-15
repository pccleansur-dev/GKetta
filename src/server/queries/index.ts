import {
  AccountStatus,
  CashMovementType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from "@prisma/client";

import { db } from "@/lib/db";

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  return Number(value);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatShortDate(date: Date | null) {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCompactCurrency(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function mapAccountStatus(status: AccountStatus, dueDate: Date | null, balance: number) {
  if (balance <= 0 || status === AccountStatus.settled) {
    return "al dia" as const;
  }

  if (status === AccountStatus.overdue || (dueDate && dueDate < startOfToday())) {
    return "vencida" as const;
  }

  if (dueDate && dueDate <= addDays(startOfToday(), 7)) {
    return "por vencer" as const;
  }

  return "al dia" as const;
}

function mapOrderStatus(status: OrderStatus) {
  switch (status) {
    case OrderStatus.confirmed:
      return "confirmado" as const;
    case OrderStatus.in_progress:
      return "en proceso" as const;
    case OrderStatus.ready:
      return "listo" as const;
    case OrderStatus.delivered:
      return "entregado" as const;
    default:
      return "confirmado" as const;
  }
}

function mapPaymentMethod(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.cash:
      return "efectivo" as const;
    case PaymentMethod.transfer:
      return "transferencia" as const;
    case PaymentMethod.card:
      return "tarjeta" as const;
    case PaymentMethod.mixed:
      return "mixto" as const;
    default:
      return "efectivo" as const;
  }
}

function normalizePhone(phone: string | null) {
  if (!phone) {
    return "";
  }

  return phone.replace(/\D/g, "");
}

function reminderMessage(customerName: string, balance: number) {
  return `Hola ${customerName}, te escribimos de Kettal para recordarte tu saldo pendiente de ${new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    },
  ).format(balance)}.`;
}

function getAuditEntityLabel(entityName: string) {
  switch (entityName) {
    case "customer":
      return "Cliente";
    case "account_movement":
      return "Pago";
    case "order":
      return "Pedido";
    case "sale":
      return "Venta";
    case "user":
      return "Usuario";
    default:
      return entityName;
  }
}

function getAuditActionLabel(action: string) {
  switch (action) {
    case "create":
      return "Creación";
    case "update":
      return "Actualización";
    case "password_update":
      return "Cambio de clave";
    case "payment":
      return "Pago";
    default:
      return action;
  }
}

function asString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function getAuditSummary(entityName: string, action: string, payload: Prisma.JsonValue) {
  const data = (payload ?? {}) as Record<string, unknown>;

  if (entityName === "user") {
    const after = (data.after ?? data) as Record<string, unknown>;
    const name = asString(after.fullName);
    const email = asString(after.email);
    const role = asString(after.role);
    const prefix = action === "create" ? "Usuario creado" : "Usuario actualizado";
    return `${prefix}: ${name} (${email}) - rol ${role}`;
  }

  if (entityName === "customer") {
    return `${asString(data.fullName)} - saldo ${formatCompactCurrency(data.openingBalance ?? data.balance)}`;
  }

  if (entityName === "order") {
    return `${asString(data.productName)} - seña ${formatCompactCurrency(data.depositAmount)}`;
  }

  if (entityName === "sale") {
    return `${asString(data.description)} - ${formatCompactCurrency(data.amount)}`;
  }

  if (entityName === "account_movement") {
    return `Pago de ${formatCompactCurrency(data.amount)}`;
  }

  return JSON.stringify(payload);
}

export async function getDashboardData() {
  const today = startOfToday();
  const weekEnd = addDays(today, 7);

  const [accounts, orders, recentSales, latestCashSession, salesTodayRows, dueThisWeek, recentAuditLogs] =
    await Promise.all([
      db.customerAccount.findMany({
        where: { deletedAt: null },
        include: { customer: true },
        orderBy: [{ currentBalance: "desc" }],
      }),
      db.order.findMany({
        where: {
          status: {
            in: [OrderStatus.confirmed, OrderStatus.in_progress, OrderStatus.ready],
          },
        },
        include: { customer: true },
        orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
        take: 3,
      }),
      db.sale.findMany({
        orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
      db.cashSession.findFirst({
        orderBy: { sessionDate: "desc" },
        include: { cashMovements: true },
      }),
      db.sale.findMany({
        where: {
          saleDate: {
            gte: today,
            lte: endOfDay(today),
          },
        },
      }),
      db.order.count({
        where: {
          status: {
            in: [OrderStatus.confirmed, OrderStatus.in_progress, OrderStatus.ready],
          },
          deliveryDate: {
            gte: today,
            lte: endOfDay(weekEnd),
          },
        },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

  const activeDebt = accounts.reduce((sum, account) => sum + toNumber(account.currentBalance), 0);
  const overdueAccounts = accounts.filter((account) => {
    const balance = toNumber(account.currentBalance);
    return mapAccountStatus(account.status, account.dueDate, balance) === "vencida";
  });
  const salesTodayTotal = salesTodayRows.reduce((sum, sale) => sum + toNumber(sale.amount), 0);
  const cashIncome =
    latestCashSession?.cashMovements
      .filter((movement) => movement.movementType === CashMovementType.income)
      .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0;

  return {
    kpis: [
      {
        label: "Deuda activa",
        value: new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(activeDebt),
        helper: `${overdueAccounts.length} cuentas vencidas`,
        tone: "danger" as const,
      },
      {
        label: "Pedidos pendientes",
        value: String(orders.length),
        helper: `${dueThisWeek} entregan esta semana`,
        tone: "warning" as const,
      },
      {
        label: "Ventas del día",
        value: new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(salesTodayTotal),
        helper: `${salesTodayRows.length} operaciones`,
        tone: "success" as const,
      },
      {
        label: "Caja esperada",
        value: new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(toNumber(latestCashSession?.expectedAmount)),
        helper: `Ingresos del turno: ${new Intl.NumberFormat("es-AR").format(cashIncome)}`,
        tone: "info" as const,
      },
    ],
    accountsNeedingAttention: accounts.slice(0, 4).map((account) => {
      const balance = toNumber(account.currentBalance);
      return {
        id: account.id,
        name: account.customer.fullName,
        phone: account.customer.phone ?? "Sin teléfono",
        balance,
        status: mapAccountStatus(account.status, account.dueDate, balance),
        nextDueDate: formatShortDate(account.dueDate),
      };
    }),
    orders: orders.map((order) => ({
      id: order.id,
      customer: order.customer.fullName,
      product: order.productName,
      deliveryDate: formatShortDate(order.deliveryDate),
      deposit: toNumber(order.depositAmount),
      remainingBalance: toNumber(order.remainingBalance),
      status: mapOrderStatus(order.status),
    })),
    sales: recentSales.map((sale) => ({
      id: sale.id,
      date: formatShortDate(sale.saleDate),
      description: sale.description,
      amount: toNumber(sale.amount),
      method: mapPaymentMethod(sale.paymentMethod),
    })),
    recentActivity: recentAuditLogs.map((log) => ({
      id: log.id,
      actor: log.user.fullName,
      role: log.user.role,
      entity: getAuditEntityLabel(log.entityName),
      action: getAuditActionLabel(log.action),
      summary: getAuditSummary(log.entityName, log.action, log.payload),
      date: formatShortDate(log.createdAt),
    })),
    reminders: overdueAccounts.slice(0, 3).map((account) => {
      const balance = toNumber(account.currentBalance);
      return {
        id: account.id,
        customer: account.customer.fullName,
        phone: normalizePhone(account.customer.phone),
        message: reminderMessage(account.customer.fullName, balance),
        balance,
      };
    }),
    cashSnapshot: {
      opening: toNumber(latestCashSession?.openingAmount),
      incomeCash:
        latestCashSession?.cashMovements
          .filter(
            (movement) =>
              movement.movementType === CashMovementType.income &&
              movement.paymentMethod === PaymentMethod.cash,
          )
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      incomeTransfer:
        latestCashSession?.cashMovements
          .filter(
            (movement) =>
              movement.movementType === CashMovementType.income &&
              movement.paymentMethod === PaymentMethod.transfer,
          )
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      expenses:
        latestCashSession?.cashMovements
          .filter((movement) => movement.movementType === CashMovementType.expense)
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      expected: toNumber(latestCashSession?.expectedAmount),
    },
  };
}

export async function getCustomersData() {
  const accounts = await db.customerAccount.findMany({
    where: { deletedAt: null },
    include: { customer: true },
    orderBy: [{ currentBalance: "desc" }, { dueDate: "asc" }],
  });

  return accounts.map((account) => {
    const balance = toNumber(account.currentBalance);

    return {
      id: account.id,
      customerId: account.customer.id,
      name: account.customer.fullName,
      phone: account.customer.phone ?? "Sin teléfono",
      status: mapAccountStatus(account.status, account.dueDate, balance),
      nextDueDate: formatShortDate(account.dueDate),
      balance,
    };
  });
}

export async function getCustomerOptions() {
  const customers = await db.customer.findMany({
    where: { deletedAt: null },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
    },
  });

  return customers.map((customer) => ({
    id: customer.id,
    name: customer.fullName,
  }));
}

export async function getCustomerEditData(customerId?: string) {
  const targetId = customerId ?? undefined;

  if (!targetId) {
    return null;
  }

  const customer = await db.customer.findUnique({
    where: { id: targetId },
    include: {
      accounts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!customer || customer.accounts.length === 0) {
    return null;
  }

  const account = customer.accounts[0];

  return {
    customerId: customer.id,
    accountId: account.id,
    fullName: customer.fullName,
    phone: customer.phone ?? "",
    documentNumber: customer.documentNumber ?? "",
    notes: customer.notes ?? "",
    monthlyDueDay: customer.monthlyDueDay ?? "",
    dueDate: account.dueDate ? account.dueDate.toISOString().slice(0, 10) : "",
    isTrusted: customer.isTrusted,
  };
}

export async function getAccountsPageData() {
  const accounts = await getCustomersData();

  return {
    accounts,
    summary: {
      totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
      overdueCount: accounts.filter((account) => account.status === "vencida").length,
      activeCount: accounts.filter((account) => account.balance > 0).length,
    },
  };
}

export async function getAccountPaymentOptions() {
  const accounts = await db.customerAccount.findMany({
    where: {
      deletedAt: null,
      currentBalance: {
        gt: 0,
      },
    },
    include: { customer: true },
    orderBy: [{ dueDate: "asc" }, { currentBalance: "desc" }],
  });

  return accounts.map((account) => ({
    id: account.id,
    customerName: account.customer.fullName,
    balance: toNumber(account.currentBalance),
  }));
}

export async function getOrdersData() {
  const orders = await db.order.findMany({
    where: {
      status: {
        notIn: [OrderStatus.cancelled, OrderStatus.delivered],
      },
    },
    include: { customer: true },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
  });

  return orders.map((order) => ({
    id: order.id,
    customer: order.customer.fullName,
    product: order.productName,
    deliveryDate: formatShortDate(order.deliveryDate),
    deposit: toNumber(order.depositAmount),
    remainingBalance: toNumber(order.remainingBalance),
    status: mapOrderStatus(order.status),
  }));
}

export async function getOrderEditData(orderId?: string) {
  const targetId = orderId ?? undefined;

  if (!targetId) {
    return null;
  }

  const order = await db.order.findUnique({
    where: { id: targetId },
    include: { customer: true },
  });

  if (!order) {
    return null;
  }

  return {
    orderId: order.id,
    customerName: order.customer.fullName,
    productName: order.productName,
    status: order.status,
    paymentConfirmationStatus: order.paymentConfirmationStatus,
    deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().slice(0, 10) : "",
    notes: order.notes ?? "",
  };
}

export async function getOpenOrderOptions() {
  const orders = await db.order.findMany({
    where: {
      status: {
        notIn: [OrderStatus.cancelled, OrderStatus.delivered],
      },
    },
    include: { customer: true },
    orderBy: [{ createdAt: "desc" }],
  });

  return orders.map((order) => ({
    id: order.id,
    label: `${order.customer.fullName} · ${order.productName}`,
  }));
}

export async function getSalesData() {
  const sales = await db.sale.findMany({
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return sales.map((sale) => ({
    id: sale.id,
    date: formatLongDate(sale.saleDate),
    description: sale.description,
    amount: toNumber(sale.amount),
    method: mapPaymentMethod(sale.paymentMethod),
  }));
}

export async function getCashData() {
  const today = startOfToday();
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const [latestSession, sales, cashSessions] = await Promise.all([
    db.cashSession.findFirst({
      orderBy: { sessionDate: "desc" },
      include: { cashMovements: true },
    }),
    db.sale.findMany({
      orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    }),
    db.cashSession.findMany({
      orderBy: { sessionDate: "desc" },
      take: 6,
    }),
  ]);

  const sumSalesBetween = (from: Date) =>
    sales
      .filter((sale) => sale.saleDate >= from)
      .reduce((sum, sale) => sum + toNumber(sale.amount), 0);

  return {
    snapshot: {
      opening: toNumber(latestSession?.openingAmount),
      incomeCash:
        latestSession?.cashMovements
          .filter(
            (movement) =>
              movement.movementType === CashMovementType.income &&
              movement.paymentMethod === PaymentMethod.cash,
          )
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      incomeTransfer:
        latestSession?.cashMovements
          .filter(
            (movement) =>
              movement.movementType === CashMovementType.income &&
              movement.paymentMethod === PaymentMethod.transfer,
          )
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      expenses:
        latestSession?.cashMovements
          .filter((movement) => movement.movementType === CashMovementType.expense)
          .reduce((sum, movement) => sum + toNumber(movement.amount), 0) ?? 0,
      expected: toNumber(latestSession?.expectedAmount),
    },
    history: {
      week: sumSalesBetween(weekStart),
      month: sumSalesBetween(monthStart),
      allTime: sales.reduce((sum, sale) => sum + toNumber(sale.amount), 0),
      recentClosings: cashSessions.map((session) => ({
        id: session.id,
        date: formatLongDate(session.sessionDate),
        expected: toNumber(session.expectedAmount),
        difference: toNumber(session.differenceAmount),
      })),
    },
  };
}

export async function getUsersData() {
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });

  return {
    users: users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      passwordStatus: user.passwordUpdatedAt ? `Actualizada ${formatDateTime(user.passwordUpdatedAt)}` : "Pendiente",
      createdAt: formatDateTime(user.createdAt),
      updatedAt: formatDateTime(user.updatedAt),
    })),
    summary: {
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      owners: users.filter((user) => user.role === UserRole.owner).length,
      managers: users.filter((user) => user.role === UserRole.manager).length,
      staff: users.filter((user) => user.role === UserRole.staff).length,
    },
  };
}

export async function getAuditLogsData(filters?: {
  action?: string;
  actorUserId?: string;
  entityName?: string;
  limit?: number;
}) {
  const logs = await db.auditLog.findMany({
    where: {
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      ...(filters?.entityName ? { entityName: filters.entityName } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const mapped = logs.map((log) => ({
    id: log.id,
    actor: log.user.fullName,
    actorEmail: log.user.email,
    actorRole: log.user.role,
    entity: getAuditEntityLabel(log.entityName),
    entityName: log.entityName,
    action: log.action,
    actionLabel: getAuditActionLabel(log.action),
    entityId: log.entityId,
    summary: getAuditSummary(log.entityName, log.action, log.payload),
    date: formatDateTime(log.createdAt),
    timestamp: log.createdAt.getTime(),
  }));

  const now = Date.now();

  return {
    logs: mapped,
    summary: {
      total: mapped.length,
      creates: mapped.filter((log) => log.action === "create").length,
      updates: mapped.filter((log) => log.action === "update" || log.action === "password_update").length,
      recent: mapped.filter((log) => now - log.timestamp < 24 * 60 * 60 * 1000).length,
    },
  };
}

export async function getRemindersData() {
  const accounts = await db.customerAccount.findMany({
    where: {
      deletedAt: null,
      currentBalance: {
        gt: 0,
      },
    },
    include: { customer: true },
    orderBy: [{ dueDate: "asc" }, { currentBalance: "desc" }],
    take: 12,
  });

  return accounts
    .map((account) => {
      const balance = toNumber(account.currentBalance);
      return {
        id: account.id,
        customerId: account.customerId,
        customer: account.customer.fullName,
        phone: normalizePhone(account.customer.phone),
        message: reminderMessage(account.customer.fullName, balance),
        balance,
        status: mapAccountStatus(account.status, account.dueDate, balance),
      };
    })
    .filter((account) => account.status !== "al dia");
}

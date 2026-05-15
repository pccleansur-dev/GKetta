import type { SessionUser } from "@/lib/session";

export type NavItem = {
  href: string;
  label: string;
  badge?: string;
  roles?: SessionUser["role"][];
};

export const navItems: NavItem[] = [
  { href: "/", label: "Resumen" },
  { href: "/clientes", label: "Clientes" },
  { href: "/cuentas-corrientes", label: "Cuentas" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/ventas", label: "Ventas" },
  { href: "/caja", label: "Caja" },
  { href: "/recordatorios", label: "Recordatorios" },
  { href: "/usuarios", label: "Usuarios", roles: ["owner"] },
  { href: "/auditoria", label: "Auditoría", roles: ["owner", "manager"] },
];

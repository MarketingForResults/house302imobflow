export type AppRole = "admin" | "manager" | "financial" | "broker" | "owner" | "tenant";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  financial: "Financeiro",
  broker: "Corretor",
  owner: "Proprietario",
  tenant: "Inquilino",
};

const OPERATIONAL_ROLES: AppRole[] = ["admin", "manager", "broker"];
const FINANCIAL_ROLES: AppRole[] = ["admin", "manager", "financial"];

export const ROUTE_ROLES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/dashboard", roles: ["admin", "manager", "financial", "broker"] },
  { prefix: "/properties", roles: OPERATIONAL_ROLES },
  { prefix: "/clients", roles: OPERATIONAL_ROLES },
  { prefix: "/brokers", roles: ["admin", "manager"] },
  { prefix: "/partners", roles: ["admin", "manager", "broker"] },
  { prefix: "/inspections", roles: OPERATIONAL_ROLES },
  { prefix: "/documents", roles: OPERATIONAL_ROLES },
  { prefix: "/rentals", roles: ["admin", "manager", "financial", "broker"] },
  { prefix: "/sales", roles: ["admin", "manager", "financial", "broker"] },
  { prefix: "/finance", roles: FINANCIAL_ROLES },
  { prefix: "/integration", roles: ["admin", "manager"] },
  { prefix: "/settings", roles: ["admin"] },
];

export function hasAnyRole(userRoles: string[], allowedRoles: readonly AppRole[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
}

export function canAccessPath(pathname: string, userRoles: string[]) {
  const route = ROUTE_ROLES.find((item) => pathname.startsWith(item.prefix));
  if (!route) return true;
  return hasAnyRole(userRoles, route.roles);
}

export function formatRoles(userRoles: string[]) {
  return userRoles.map((role) => ROLE_LABELS[role as AppRole] ?? role).join(", ") || "sem papel";
}

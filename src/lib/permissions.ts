export type AppRole =
  | "master"
  | "it_support"
  | "admin"
  | "manager"
  | "financial"
  | "broker"
  | "owner"
  | "tenant";

export const ROLE_LABELS: Record<AppRole, string> = {
  master: "Administrador master",
  it_support: "Suporte de TI",
  admin: "Administrador",
  manager: "Gestor",
  financial: "Financeiro",
  broker: "Corretor",
  owner: "Proprietario",
  tenant: "Inquilino",
};

export const ADMIN_ROLES: AppRole[] = ["master", "admin"];
export const SECURITY_ROLES: AppRole[] = ["master", "it_support"];

const OPERATIONAL_ROLES: AppRole[] = ["master", "admin", "manager", "broker"];
const FINANCIAL_ROLES: AppRole[] = ["master", "admin", "manager", "financial"];

export const ROUTE_ROLES: Array<{ prefix: string; roles: AppRole[] }> = [
  { prefix: "/dashboard", roles: ["master", "it_support", "admin", "manager", "financial", "broker"] },
  { prefix: "/properties", roles: OPERATIONAL_ROLES },
  { prefix: "/clients", roles: OPERATIONAL_ROLES },
  { prefix: "/brokers", roles: ["master", "admin", "manager"] },
  { prefix: "/partners", roles: ["master", "admin", "manager", "broker"] },
  { prefix: "/inspections", roles: OPERATIONAL_ROLES },
  { prefix: "/documents", roles: OPERATIONAL_ROLES },
  { prefix: "/rentals", roles: ["master", "admin", "manager", "financial", "broker"] },
  { prefix: "/sales", roles: ["master", "admin", "manager", "financial", "broker"] },
  { prefix: "/finance", roles: FINANCIAL_ROLES },
  { prefix: "/integration", roles: ["master", "admin", "manager"] },
  { prefix: "/settings", roles: ADMIN_ROLES },
  { prefix: "/security", roles: SECURITY_ROLES },
  { prefix: "/backups", roles: ["master"] },
  { prefix: "/users", roles: ADMIN_ROLES },
  { prefix: "/support", roles: ["master", "it_support", "admin", "manager", "financial", "broker", "owner", "tenant"] },
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

import type { PermissionCode } from "@/lib/permissions";

export type SidebarMenuItem = {
  type: "item";
  href: string;
  label: string;
  icon: string;
  permission?: PermissionCode;
  anyPermissions?: PermissionCode[];
};

export type SidebarMenuGroup = {
  type: "group";
  label: string;
  icon: string;
  children: SidebarMenuItem[];
};

export type SidebarMenuEntry = SidebarMenuItem | SidebarMenuGroup;

export type SidebarMenuUser = {
  permissions: readonly string[];
};

export const sidebarMenu: SidebarMenuEntry[] = [
  { type: "item", href: "/dashboard", label: "Dashboard", icon: "home" },
  { type: "item", href: "/dashboard/sales", label: "Painel de Vendas", icon: "trending-up", permission: "RELATORIO_VISUALIZAR" },
  { type: "item", href: "/orders/new", label: "Novo Pedido", icon: "file-text", permission: "PEDIDO_CRIAR" },
  { type: "item", href: "/orders/my", label: "Meus Pedidos", icon: "clipboard-list", permission: "PEDIDO_VISUALIZAR_PROPRIOS" },
  { type: "item", href: "/orders/all", label: "Todos os Pedidos", icon: "clipboard-list", permission: "PEDIDO_VISUALIZAR_TODOS" },
  {
    type: "group",
    label: "Relatório",
    icon: "bar-chart-3",
    children: [
      { type: "item", href: "/reports", label: "Relatório de Vendas", icon: "bar-chart-3", permission: "RELATORIO_VISUALIZAR" },
      { type: "item", href: "/reports/technical-list", label: "Relatório da Lista Técnica", icon: "file-spreadsheet", permission: "RELATORIO_VISUALIZAR" }
    ]
  },
  {
    type: "group",
    label: "Cadastro",
    icon: "building-2",
    children: [
      { type: "item", href: "/customers", label: "Clientes", icon: "building-2", permission: "CLIENTE_VISUALIZAR" },
      { type: "item", href: "/products", label: "Produtos", icon: "package", permission: "PRODUTO_VISUALIZAR" },
      { type: "item", href: "/contract-types", label: "Tipos de Contrato", icon: "file-text", permission: "TIPO_CONTRATO_VISUALIZAR" },
      { type: "item", href: "/raw-material-closings", label: "Tipos de MP", icon: "clipboard-list", permission: "FECHAMENTO_MP_VISUALIZAR" },
      { type: "item", href: "/raw-materials", label: "Matérias-Primas", icon: "package", permission: "MATERIA_PRIMA_VISUALIZAR" },
      { type: "item", href: "/packages", label: "Embalagens", icon: "package", permission: "EMBALAGEM_VISUALIZAR" },
      { type: "item", href: "/currencies", label: "Moedas", icon: "coins", permission: "MOEDA_VISUALIZAR" },
      { type: "item", href: "/importacao-em-massa", label: "Importação em Massa", icon: "file-spreadsheet", anyPermissions: ["CLIENTE_CRIAR", "PRODUTO_CRIAR", "MATERIA_PRIMA_CRIAR"] }
    ]
  },
  {
    type: "group",
    label: "Configuração",
    icon: "shield-check",
    children: [
      { type: "item", href: "/users", label: "Usuários", icon: "users", permission: "USUARIO_VISUALIZAR" },
      { type: "item", href: "/roles", label: "Perfis e Permissões", icon: "shield-check", permission: "PERMISSAO_CONFIGURAR" },
      { type: "item", href: "/profile", label: "Meu Perfil", icon: "user" }
    ]
  }
];

export function canAccessSidebarItem(item: SidebarMenuItem, user: SidebarMenuUser) {
  const hasPermission = !item.permission || user.permissions.includes(item.permission);
  const hasAnyPermission = !item.anyPermissions || item.anyPermissions.some((permission) => user.permissions.includes(permission));
  return hasPermission && hasAnyPermission;
}

export function visibleSidebarMenu(user: SidebarMenuUser): SidebarMenuEntry[] {
  return sidebarMenu.flatMap<SidebarMenuEntry>((entry) => {
    if (entry.type === "item") return canAccessSidebarItem(entry, user) ? [entry] : [];

    const children = entry.children.filter((item) => canAccessSidebarItem(item, user));
    return children.length > 0 ? [{ ...entry, children }] : [];
  });
}

export function isSidebarItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/reports") return pathname === href || pathname === "/reports/sales";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isSidebarGroupActive(pathname: string, group: SidebarMenuGroup) {
  return group.children.some((item) => isSidebarItemActive(pathname, item.href));
}

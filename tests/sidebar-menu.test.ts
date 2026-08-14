import { describe, expect, it } from "vitest";
import { isSidebarGroupActive, isSidebarItemActive, visibleSidebarMenu, type SidebarMenuEntry, type SidebarMenuUser } from "@/lib/sidebar-menu";
import type { PermissionCode } from "@/lib/permissions";

const allPermissions: PermissionCode[] = [
  "RELATORIO_VISUALIZAR",
  "PEDIDO_CRIAR",
  "PEDIDO_VISUALIZAR_PROPRIOS",
  "PEDIDO_VISUALIZAR_TODOS",
  "CLIENTE_VISUALIZAR",
  "PRODUTO_VISUALIZAR",
  "TIPO_CONTRATO_VISUALIZAR",
  "FECHAMENTO_MP_VISUALIZAR",
  "MATERIA_PRIMA_VISUALIZAR",
  "EMBALAGEM_VISUALIZAR",
  "MOEDA_VISUALIZAR",
  "CLIENTE_CRIAR",
  "PRODUTO_CRIAR",
  "MATERIA_PRIMA_CRIAR",
  "USUARIO_VISUALIZAR",
  "PERMISSAO_CONFIGURAR"
];

function menuFor(permissions: PermissionCode[] = allPermissions) {
  return visibleSidebarMenu({ permissions });
}

function group(entries: SidebarMenuEntry[], label: string) {
  const entry = entries.find((item) => item.type === "group" && item.label === label);
  expect(entry?.type).toBe("group");
  return entry as Extract<SidebarMenuEntry, { type: "group" }>;
}

function labels(entries: SidebarMenuEntry[]) {
  return entries.map((entry) => entry.label);
}

function childLabels(entries: SidebarMenuEntry[], label: string) {
  return group(entries, label).children.map((item) => item.label);
}

function flattenLabels(entries: SidebarMenuEntry[]) {
  return entries.flatMap((entry) => entry.type === "item" ? [entry.label] : [entry.label, ...entry.children.map((item) => item.label)]);
}

function flattenHrefs(entries: SidebarMenuEntry[]) {
  return entries.flatMap((entry) => entry.type === "item" ? [entry.href] : entry.children.map((item) => item.href));
}

describe("menu lateral", () => {
  it("mantém a ordem principal solicitada", () => {
    expect(labels(menuFor())).toEqual([
      "Dashboard",
      "Painel de Vendas",
      "Novo Pedido",
      "Meus Pedidos",
      "Todos os Pedidos",
      "Relatório",
      "Cadastro",
      "Configuração"
    ]);
  });

  it("mantém os acessos principais visíveis diretamente nas primeiras posições", () => {
    const entries = menuFor();
    expect(entries.slice(0, 5).every((entry) => entry.type === "item")).toBe(true);
    expect(labels(entries.slice(0, 5))).toEqual(["Dashboard", "Painel de Vendas", "Novo Pedido", "Meus Pedidos", "Todos os Pedidos"]);
  });

  it("agrupa os relatórios existentes dentro de Relatório", () => {
    expect(childLabels(menuFor(), "Relatório")).toEqual(["Relatório de Vendas", "Relatório da Lista Técnica"]);
    expect(flattenHrefs(menuFor())).toEqual(expect.arrayContaining(["/reports", "/reports/technical-list"]));
  });

  it("agrupa os cadastros na ordem solicitada", () => {
    expect(childLabels(menuFor(), "Cadastro")).toEqual([
      "Clientes",
      "Produtos",
      "Tipos de Contrato",
      "Tipos de MP",
      "Matérias-Primas",
      "Embalagens",
      "Moedas",
      "Importação em Massa"
    ]);
  });

  it("agrupa as opções de configuração na ordem solicitada", () => {
    expect(childLabels(menuFor(), "Configuração")).toEqual(["Usuários", "Perfis e Permissões", "Meu Perfil"]);
  });

  it("marca itens ativos e mantém o grupo da página atual aberto", () => {
    const entries = menuFor();
    expect(isSidebarItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isSidebarGroupActive("/customers", group(entries, "Cadastro"))).toBe(true);
    expect(isSidebarGroupActive("/reports/technical-list", group(entries, "Relatório"))).toBe(true);
    expect(isSidebarGroupActive("/users", group(entries, "Configuração"))).toBe(true);
    expect(isSidebarItemActive("/reports/sales", "/reports")).toBe(true);
  });

  it("preserva permissões dos itens movidos", () => {
    const representative = menuFor(["PEDIDO_CRIAR", "PEDIDO_VISUALIZAR_PROPRIOS"]);
    expect(labels(representative)).toEqual(["Dashboard", "Novo Pedido", "Meus Pedidos", "Configuração"]);
    expect(childLabels(representative, "Configuração")).toEqual(["Meu Perfil"]);
    expect(flattenLabels(representative)).not.toContain("Usuários");
    expect(flattenLabels(representative)).not.toContain("Perfis e Permissões");
    expect(flattenLabels(representative)).not.toContain("Matérias-Primas");
  });

  it("não exibe grupos vazios", () => {
    const user: SidebarMenuUser = { permissions: [] };
    expect(labels(visibleSidebarMenu(user))).toEqual(["Dashboard", "Configuração"]);
    expect(childLabels(visibleSidebarMenu(user), "Configuração")).toEqual(["Meu Perfil"]);
  });

  it("não duplica itens nem rotas", () => {
    const entries = menuFor();
    const itemLabels = flattenLabels(entries).filter((label) => !["Relatório", "Cadastro", "Configuração"].includes(label));
    const hrefs = flattenHrefs(entries);
    expect(new Set(itemLabels).size).toBe(itemLabels.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("não mantém cadastros, relatórios ou configuração duplicados na raiz", () => {
    const rootLabels = labels(menuFor());
    expect(rootLabels).not.toContain("Clientes");
    expect(rootLabels).not.toContain("Produtos");
    expect(rootLabels).not.toContain("Usuários");
    expect(rootLabels).not.toContain("Perfis e Permissões");
    expect(rootLabels).not.toContain("Relatório de Vendas");
    expect(rootLabels).not.toContain("Relatório da Lista Técnica");
  });
});

export const appTimezone = process.env.APP_TIMEZONE || "America/Sao_Paulo";

export const orderStatusLabels = {
  RECEBIDO: "Recebido",
  APROVADO: "Aprovado",
  EM_CRIACAO: "Em Criação",
  PEDIDO_CRIADO: "Pedido Criado",
  ENVIADO_PARA_ASSINATURA: "Enviado para Assinatura",
  CANCELADO: "Cancelado",
  RECUSADO: "Recusado"
} as const;

export const activeOrderStatusOptions = [
  "RECEBIDO",
  "APROVADO",
  "EM_CRIACAO",
  "PEDIDO_CRIADO",
  "ENVIADO_PARA_ASSINATURA",
  "CANCELADO"
] as const;

export const orderStatusClasses = {
  RECEBIDO: "bg-amber-100 text-amber-800 border-amber-200",
  APROVADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EM_CRIACAO: "bg-blue-100 text-blue-800 border-blue-200",
  PEDIDO_CRIADO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ENVIADO_PARA_ASSINATURA: "bg-orange-100 text-orange-800 border-orange-200",
  CANCELADO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  RECUSADO: "bg-red-100 text-red-800 border-red-200"
} as const;

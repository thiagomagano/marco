import Decimal from "decimal.js";
import {
  parseSaoPauloDateStart,
  parseSaoPauloDateEnd,
} from "./date-utils.ts";

export interface PedidoResumoCalculado {
  totalVendasConfirmadas: number;
  totalPesoKgConfirmado: number;
  qtdTotal: number;
  qtdConfirmados: number;
  qtdRascunhos: number;
  qtdCancelados: number;
}

export interface PedidoParaResumo {
  status: string;
  totalEstimado: number;
  pesoInformadoKg: number | null;
}

export interface PedidoParaOrdenacao {
  status: string;
  dataCriacao: Date | string;
  dataConfirmacao: Date | string | null;
}

/**
 * Constrói a cláusula de período para o Prisma considerando:
 * - Pedidos CONFIRMADO: filtrados por dataConfirmacao
 * - Pedidos RASCUNHO / CANCELADO: filtrados por dataCriacao
 * - Status TODOS: OR combinando os dois critérios
 */
export function buildPedidoDateFilter(params: {
  status?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
}): Record<string, unknown> {
  const gte = parseSaoPauloDateStart(params.dataInicio);
  const lte = parseSaoPauloDateEnd(params.dataFim);

  if (!gte && !lte) {
    return {};
  }

  const range: { gte?: Date; lte?: Date } = {};
  if (gte) range.gte = gte;
  if (lte) range.lte = lte;

  const status = params.status?.trim();

  if (status === "CONFIRMADO") {
    return { dataConfirmacao: range };
  }

  if (status === "RASCUNHO" || status === "CANCELADO") {
    return { dataCriacao: range };
  }

  return {
    OR: [
      { status: "CONFIRMADO", dataConfirmacao: range },
      { status: { not: "CONFIRMADO" }, dataCriacao: range },
    ],
  };
}

/**
 * Calcula o resumo financeiro, peso vendido em kg e contagem por status dos pedidos filtrados.
 */
export function calcularResumoPedidos(
  pedidos: PedidoParaResumo[]
): PedidoResumoCalculado {
  let totalVendas = new Decimal(0);
  let totalPesoKg = new Decimal(0);
  let qtdConfirmados = 0;
  let qtdRascunhos = 0;
  let qtdCancelados = 0;

  for (const p of pedidos) {
    if (p.status === "CONFIRMADO") {
      qtdConfirmados += 1;
      totalVendas = totalVendas.plus(p.totalEstimado || 0);
      if (p.pesoInformadoKg) {
        totalPesoKg = totalPesoKg.plus(p.pesoInformadoKg);
      }
    } else if (p.status === "RASCUNHO") {
      qtdRascunhos += 1;
    } else if (p.status === "CANCELADO") {
      qtdCancelados += 1;
    }
  }

  return {
    totalVendasConfirmadas: totalVendas.toDecimalPlaces(2).toNumber(),
    totalPesoKgConfirmado: totalPesoKg.toDecimalPlaces(3).toNumber(),
    qtdTotal: pedidos.length,
    qtdConfirmados,
    qtdRascunhos,
    qtdCancelados,
  };
}

/**
 * Retorna o timestamp de referência de um pedido:
 * dataConfirmacao para confirmados (quando preenchida) e dataCriacao para os demais.
 */
export function getPedidoDataReferenciaMs(pedido: PedidoParaOrdenacao): number {
  const ref =
    pedido.status === "CONFIRMADO" && pedido.dataConfirmacao
      ? pedido.dataConfirmacao
      : pedido.dataCriacao;
  const ms = new Date(ref).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

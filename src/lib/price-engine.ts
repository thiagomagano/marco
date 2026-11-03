import { prisma } from "./db.ts";

export type PriceSuggestionSource = "HISTORICO" | "REFERENCIA" | "MANUAL";

export interface PriceSuggestionResult {
  precoSugerido: number | null;
  origem: PriceSuggestionSource;
  detalhe?: string;
  pedidoNumero?: string;
  dataPedido?: Date;
}

/**
 * Motor de sugestão de preços conforme Seção 6 da Especificação Funcional:
 * 1. Procura o pedido CONFIRMADO mais recente (não cancelado) para a combinação Cliente + Frigorífico + Produto.
 * 2. Se não houver histórico, utiliza o preço de referência do produto.
 * 3. Se não houver preço de referência, retorna nulo para preenchimento manual obrigatório.
 */
export async function getPriceSuggestion(params: {
  clienteId: string;
  frigorificoId: string;
  produtoId: string;
}): Promise<PriceSuggestionResult> {
  const { clienteId, frigorificoId, produtoId } = params;

  if (!clienteId || !frigorificoId || !produtoId) {
    return { precoSugerido: null, origem: "MANUAL" };
  }

  // 1. Busca no histórico de pedidos confirmados e válidos
  const ultimoItem = await prisma.pedidoItem.findFirst({
    where: {
      produtoId: produtoId,
      pedido: {
        clienteId: clienteId,
        frigorificoId: frigorificoId,
        status: "CONFIRMADO", // Apenas confirmados (ignora rascunhos e cancelados)
      },
    },
    orderBy: [
      {
        pedido: {
          dataConfirmacao: "desc",
        },
      },
      {
        pedido: {
          dataCriacao: "desc",
        },
      },
    ],
    include: {
      pedido: {
        select: {
          numero: true,
          dataConfirmacao: true,
          dataCriacao: true,
        },
      },
    },
  });

  if (ultimoItem && ultimoItem.precoUnitario > 0) {
    const dataRef = ultimoItem.pedido.dataConfirmacao || ultimoItem.pedido.dataCriacao;
    return {
      precoSugerido: ultimoItem.precoUnitario,
      origem: "HISTORICO",
      detalhe: `Último negociado no pedido ${ultimoItem.pedido.numero}`,
      pedidoNumero: ultimoItem.pedido.numero,
      dataPedido: dataRef,
    };
  }

  // 2. Busca o preço de referência cadastrado no produto
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { precoReferencia: true },
  });

  if (produto?.precoReferencia && produto.precoReferencia > 0) {
    return {
      precoSugerido: produto.precoReferencia,
      origem: "REFERENCIA",
      detalhe: "Preço de referência do cadastro do produto",
    };
  }

  // 3. Nenhuma referência encontrada -> campo manual
  return {
    precoSugerido: null,
    origem: "MANUAL",
    detalhe: "Sem histórico ou preço de referência. Digite o valor.",
  };
}

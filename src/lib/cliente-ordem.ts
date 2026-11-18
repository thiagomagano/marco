export type ClienteOrdenacao =
  | "mais_pedidos"
  | "maior_valor"
  | "maior_qtd"
  | "ativos_primeiro"
  | "alfabetica";

export interface ClienteMetricaCompra {
  totalValorComprado: number;
  totalPesoKg: number;
  qtdConfirmados: number;
}

export interface ClienteParaOrdenacao {
  id: string;
  ativo: boolean;
  razaoSocialOuNome: string;
  totalPedidos: number;
  totalValorComprado: number;
  totalPesoKg: number;
}

const ORDENACOES_VALIDAS = new Set<ClienteOrdenacao>([
  "mais_pedidos",
  "maior_valor",
  "maior_qtd",
  "ativos_primeiro",
  "alfabetica",
]);

export function parseClienteOrdenacao(
  value: string | null | undefined
): ClienteOrdenacao {
  const normalized = value?.trim().toLowerCase() as ClienteOrdenacao | undefined;
  if (normalized && ORDENACOES_VALIDAS.has(normalized)) {
    return normalized;
  }
  return "mais_pedidos";
}

function compareBoolDesc(a: boolean, b: boolean): number {
  if (a === b) return 0;
  return a ? -1 : 1;
}

function compareNumberDesc(a: number, b: number): number {
  if (a === b) return 0;
  return b - a;
}

function compareNomeAsc(a: ClienteParaOrdenacao, b: ClienteParaOrdenacao): number {
  const byName = a.razaoSocialOuNome.localeCompare(
    b.razaoSocialOuNome,
    "pt-BR"
  );
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

/**
 * Ordena clientes conforme o critério selecionado.
 * Padrão ("mais_pedidos"):
 *   1) Mais pedidos (DESC)
 *   2) Ativos primeiro (DESC)
 *   3) Maior valor comprado em pedidos confirmados (DESC)
 *   4) Maior volume em kg em pedidos confirmados (DESC)
 *   5) Ordem alfabética (ASC)
 */
export function ordenarClientes<T extends ClienteParaOrdenacao>(
  clientes: T[],
  ordenacao: ClienteOrdenacao = "mais_pedidos"
): T[] {
  return [...clientes].sort((a, b) => {
    if (ordenacao === "maior_valor") {
      return (
        compareNumberDesc(a.totalValorComprado, b.totalValorComprado) ||
        compareBoolDesc(a.ativo, b.ativo) ||
        compareNumberDesc(a.totalPedidos, b.totalPedidos) ||
        compareNumberDesc(a.totalPesoKg, b.totalPesoKg) ||
        compareNomeAsc(a, b)
      );
    }

    if (ordenacao === "maior_qtd") {
      return (
        compareNumberDesc(a.totalPesoKg, b.totalPesoKg) ||
        compareBoolDesc(a.ativo, b.ativo) ||
        compareNumberDesc(a.totalValorComprado, b.totalValorComprado) ||
        compareNumberDesc(a.totalPedidos, b.totalPedidos) ||
        compareNomeAsc(a, b)
      );
    }

    if (ordenacao === "ativos_primeiro") {
      return (
        compareBoolDesc(a.ativo, b.ativo) ||
        compareNumberDesc(a.totalPedidos, b.totalPedidos) ||
        compareNumberDesc(a.totalValorComprado, b.totalValorComprado) ||
        compareNumberDesc(a.totalPesoKg, b.totalPesoKg) ||
        compareNomeAsc(a, b)
      );
    }

    if (ordenacao === "alfabetica") {
      return compareNomeAsc(a, b);
    }

    // Padrão: "mais_pedidos"
    return (
      compareNumberDesc(a.totalPedidos, b.totalPedidos) ||
      compareBoolDesc(a.ativo, b.ativo) ||
      compareNumberDesc(a.totalValorComprado, b.totalValorComprado) ||
      compareNumberDesc(a.totalPesoKg, b.totalPesoKg) ||
      compareNomeAsc(a, b)
    );
  });
}

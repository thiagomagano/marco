import Decimal from "decimal.js";

// Configura o Decimal para cálculos financeiros bancários padrão
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface OrderItemCalculationInput {
  quantidade: number | string;
  precoUnitario: number | string;
  unidade: string;
}

/**
 * Calcula o subtotal de um item com precisão decimal:
 * Subtotal = quantidade * precoUnitario (arredondado para 2 casas)
 */
export function calculateSubtotal(
  quantidade: number | string,
  precoUnitario: number | string
): number {
  try {
    const q = new Decimal(quantidade || 0);
    const p = new Decimal(precoUnitario || 0);
    return q.times(p).toDecimalPlaces(2).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Calcula o total estimado de um pedido somando os subtotais dos itens.
 */
export function calculateOrderTotal(
  items: Array<{ quantidade: number | string; precoUnitario: number | string }>
): number {
  try {
    let total = new Decimal(0);
    for (const item of items) {
      const q = new Decimal(item.quantidade || 0);
      const p = new Decimal(item.precoUnitario || 0);
      const subtotal = q.times(p).toDecimalPlaces(2);
      total = total.plus(subtotal);
    }
    return total.toDecimalPlaces(2).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Calcula a soma do peso informado em kg.
 * ITENS VENDIDOS EM PEÇA OU CAIXA NÃO SÃO CONVERTIDOS NEM SOMADOS.
 */
export function calculateReportedWeightKg(
  items: Array<{ quantidade: number | string; unidade: string }>
): number {
  try {
    let totalKg = new Decimal(0);
    for (const item of items) {
      if (item.unidade?.toLowerCase() === "kg") {
        const q = new Decimal(item.quantidade || 0);
        totalKg = totalKg.plus(q);
      }
    }
    return totalKg.toDecimalPlaces(3).toNumber();
  } catch {
    return 0;
  }
}

/**
 * Formata um valor numérico para Moeda Brasileira (R$ 0,00).
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata a quantidade de acordo com a unidade comercial:
 * - kg: até 3 casas decimais (ex: 125,500 kg)
 * - peça / caixa: número inteiro
 */
export function formatQuantity(value: number, unidade: string): string {
  const u = unidade?.toLowerCase() || "";
  if (u === "kg") {
    return (
      new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }).format(value) + " kg"
    );
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(value)) + ` ${unidade}`;
}

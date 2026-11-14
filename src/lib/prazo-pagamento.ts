/**
 * Utilitários e padrões para o campo opcional "Prazo de Pagamento no Boleto".
 */

export const PRAZO_PAGAMENTO_DEFAULT = "14 dias";

export const PRAZOS_PAGAMENTO_SUGESTOES = [
  "À vista",
  "7 dias",
  "14 dias",
  "21 dias",
  "28 dias",
  "7/14/21 dias",
  "14/28 dias",
] as const;

/**
 * Normaliza e valida o prazo de pagamento no boleto.
 * Aceita vazio (`null`), número inteiro de dias (ex: `14` -> `"14 dias"`),
 * prazos múltiplos separados por barra (ex: `"7/14/21"` -> `"7/14/21 dias"`),
 * ou texto descritivo curto (ex: `"28 DDL"`, `"À vista"`).
 */
export function normalizePrazoPagamentoBoleto(prazo: unknown): {
  valid: boolean;
  value: string | null;
  error?: string;
} {
  if (prazo === null || prazo === undefined) {
    return { valid: true, value: null };
  }

  if (typeof prazo === "number") {
    if (!Number.isFinite(prazo) || !Number.isInteger(prazo) || prazo < 0) {
      return {
        valid: false,
        value: null,
        error:
          "Prazo de pagamento no boleto em dias deve ser um número inteiro não negativo.",
      };
    }
    return {
      valid: true,
      value:
        prazo === 0 ? "À vista" : `${prazo} ${prazo === 1 ? "dia" : "dias"}`,
    };
  }

  const raw = String(prazo).trim().replace(/\s+/g, " ");
  if (!raw) {
    return { valid: true, value: null };
  }

  if (raw.length > 60) {
    return {
      valid: false,
      value: null,
      error: "Prazo de pagamento no boleto deve ter no máximo 60 caracteres.",
    };
  }

  if (/^\d+$/.test(raw)) {
    const dias = parseInt(raw, 10);
    return {
      valid: true,
      value: dias === 0 ? "À vista" : `${dias} ${dias === 1 ? "dia" : "dias"}`,
    };
  }

  if (/^\d+(?:\s*\/\s*\d+)+$/.test(raw)) {
    const normalizedSlashes = raw.replace(/\s*\/\s*/g, "/");
    return {
      valid: true,
      value: `${normalizedSlashes} dias`,
    };
  }

  return { valid: true, value: raw };
}

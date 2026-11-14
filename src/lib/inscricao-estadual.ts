/**
 * Utilitários de normalização, formatação e validação de Inscrição Estadual (IE),
 * com foco no padrão do Rio Grande do Sul (10 dígitos: XXX/XXXXXXX, Módulo 11).
 */

/**
 * Normaliza a Inscrição Estadual para armazenamento limpo no banco.
 * Retorna `null` quando vazia, `"ISENTO"` quando informada como isento,
 * ou apenas os dígitos numéricos.
 */
export function normalizeInscricaoEstadual(
  ie: string | null | undefined
): string | null {
  if (!ie) return null;
  const trimmed = ie.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === "ISENTO") return "ISENTO";

  const cleaned = trimmed.replace(/\D/g, "");
  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Formata uma Inscrição Estadual para exibição.
 * No padrão do Rio Grande do Sul (10 dígitos), aplica a máscara XXX/XXXXXXX.
 */
export function formatInscricaoEstadual(
  ie: string | null | undefined
): string {
  if (!ie) return "";
  const trimmed = ie.trim();
  if (!trimmed) return "";
  if (trimmed.toUpperCase() === "ISENTO") return "ISENTO";

  const cleaned = trimmed.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{3})(\d{7})$/, "$1/$2");
  }
  return cleaned || trimmed;
}

/**
 * Valida uma Inscrição Estadual do Rio Grande do Sul (10 dígitos, Módulo 11).
 * Pesos: [2, 9, 8, 7, 6, 5, 4, 3, 2].
 */
export function isValidInscricaoEstadualRS(
  ie: string | null | undefined
): boolean {
  if (!ie) return false;
  const cleaned = ie.replace(/\D/g, "");

  if (cleaned.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(cleaned)) return false;

  const pesos = [2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cleaned.charAt(i), 10) * pesos[i];
  }

  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;

  return dvCalculado === parseInt(cleaned.charAt(9), 10);
}

/**
 * Valida e normaliza a entrada de Inscrição Estadual (campo opcional).
 * Aceita vazio (`null`), `"ISENTO"`, 10 dígitos válidos no RS (Módulo 11),
 * ou de 8 a 14 dígitos numéricos para eventuais clientes de outros estados.
 */
export function parseInscricaoEstadualInput(ie: unknown): {
  valid: boolean;
  normalized: string | null;
  formatted: string | null;
  error?: string;
} {
  if (ie === null || ie === undefined) {
    return { valid: true, normalized: null, formatted: null };
  }

  const raw = String(ie).trim();
  if (!raw) {
    return { valid: true, normalized: null, formatted: null };
  }

  if (raw.toUpperCase() === "ISENTO") {
    return { valid: true, normalized: "ISENTO", formatted: "ISENTO" };
  }

  if (/[a-zA-Z]/.test(raw)) {
    return {
      valid: false,
      normalized: null,
      formatted: null,
      error: "Inscrição Estadual deve conter apenas números (ou 'ISENTO').",
    };
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) {
    return {
      valid: false,
      normalized: null,
      formatted: null,
      error:
        "Inscrição Estadual deve ter entre 8 e 14 dígitos (no RS são 10 dígitos).",
    };
  }

  if (digits.length === 10 && !isValidInscricaoEstadualRS(digits)) {
    return {
      valid: false,
      normalized: null,
      formatted: null,
      error:
        "Inscrição Estadual (RS) inválida. Verifique os 10 dígitos informados.",
    };
  }

  return {
    valid: true,
    normalized: digits,
    formatted: formatInscricaoEstadual(digits),
  };
}

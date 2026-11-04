import XLSX from "xlsx";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "./cnpj.ts";

/**
 * Normaliza o cabeçalho/chave de uma coluna para identificação sem sensibilidade
 * a maiúsculas, minúsculas, acentos ou pontuação.
 */
export function normalizeKey(key: string): string {
  if (!key) return "";
  return key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // Remove parênteses e seus conteúdos, como (R$), (kg), (opcional)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, "");     // Remove espaços, pontuações e sublinhados
}

/**
 * Lê uma planilha Excel (.xlsx, .xls) ou CSV a partir do caminho do arquivo
 * e retorna um array de objetos onde as chaves estão normalizadas.
 */
export function readSpreadsheet(filePath: string): Array<Record<string, unknown>> {
  const workbook = XLSX.readFile(filePath, { raw: false, dateNF: "yyyy-mm-dd" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  // Converte a primeira aba em objetos com as linhas
  const rawRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });

  // Normaliza os nomes das colunas de cada linha
  return rawRows.map((row) => {
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const cleanKey = normalizeKey(key);
      if (cleanKey) {
        normalizedRow[cleanKey] = typeof val === "string" ? val.trim() : val;
      }
    }
    return normalizedRow;
  });
}

/**
 * Normaliza e recupera CNPJs vindos de planilhas.
 * O Excel muitas vezes remove o zero inicial de números de CNPJ (ex: 4252011000110 -> 04252011000110).
 */
export function cleanSpreadsheetCnpj(rawCnpj: unknown): {
  normalized: string | null;
  formatted: string | null;
  valid: boolean;
} {
  if (rawCnpj === null || rawCnpj === undefined || rawCnpj === "") {
    return { normalized: null, formatted: null, valid: true }; // Opcional
  }

  let cleaned = String(rawCnpj).replace(/\D/g, "");
  if (!cleaned) {
    return { normalized: null, formatted: null, valid: true };
  }

  // Se o Excel removeu o zero à esquerda e ficou com 13 dígitos, preenche com zero
  if (cleaned.length === 13) {
    cleaned = cleaned.padStart(14, "0");
  }

  const valid = isValidCnpj(cleaned);
  return {
    normalized: cleaned,
    formatted: formatCnpj(cleaned),
    valid,
  };
}

/**
 * Normaliza unidades comerciais aceitas pelo sistema: "kg", "peça" ou "caixa".
 */
export function cleanSpreadsheetUnidade(rawUnit: unknown): string | null {
  if (!rawUnit) return null;
  const u = normalizeKey(String(rawUnit));

  if (["kg", "kilo", "quilo", "quilograma", "kgs", "quilos", "kilos"].includes(u)) {
    return "kg";
  }
  if (["cx", "caixa", "cxs", "caixas"].includes(u)) {
    return "caixa";
  }
  if (["pc", "peca", "peça", "pcs", "pecas", "peças", "un", "und", "unidade"].includes(u)) {
    return "peça";
  }

  return null;
}

/**
 * Normaliza valores monetários vindos de planilhas Excel (ex: "R$ 68,90", "68.90", 68.9).
 */
export function cleanSpreadsheetPrice(rawPrice: unknown): number | null {
  if (rawPrice === null || rawPrice === undefined || rawPrice === "") {
    return null;
  }

  if (typeof rawPrice === "number") {
    return isNaN(rawPrice) || rawPrice < 0 ? null : Math.round(rawPrice * 100) / 100;
  }

  const str = String(rawPrice)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")      // Remove separador de milhar brasileiro
    .replace(/,/g, ".");     // Converte vírgula decimal para ponto

  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

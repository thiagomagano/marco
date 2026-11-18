export const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const saoPauloYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const saoPauloDateBrFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const saoPauloMonthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIMEZONE,
  month: "long",
  year: "numeric",
});

export type PeriodoPreset = "HOJE" | "ONTEM" | "AMANHA" | "SEMANA" | "MES";

export interface PeriodoRange {
  inicioStr: string;
  fimStr: string;
  inicio: Date;
  fim: Date;
}

/**
 * Valida se uma string está no formato YYYY-MM-DD e representa uma data calendário válida.
 */
export function isValidYmd(ymd: string | null | undefined): ymd is string {
  if (!ymd || !YMD_REGEX.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

/**
 * Retorna a data no formato YYYY-MM-DD no fuso horário de Brasília (America/Sao_Paulo).
 */
export function getSaoPauloDateString(date: Date = new Date()): string {
  return saoPauloYmdFormatter.format(date);
}

/**
 * Desloca uma data YYYY-MM-DD por uma quantidade inteira de dias no calendário.
 */
export function shiftDateString(ymd: string, deltaDays: number): string {
  if (!isValidYmd(ymd)) {
    throw new Error(`Data inválida para deslocamento: ${ymd}`);
  }
  const [y, m, d] = ymd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const year = anchor.getUTCFullYear();
  const month = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const day = String(anchor.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Retorna o início do dia (00:00:00.000) em Brasília (-03:00) para uma data YYYY-MM-DD.
 */
export function parseSaoPauloDateStart(ymd: string | null | undefined): Date | null {
  if (!isValidYmd(ymd)) return null;
  const parsed = new Date(`${ymd}T00:00:00.000-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Retorna o fim do dia (23:59:59.999) em Brasília (-03:00) para uma data YYYY-MM-DD.
 */
export function parseSaoPauloDateEnd(ymd: string | null | undefined): Date | null {
  if (!isValidYmd(ymd)) return null;
  const parsed = new Date(`${ymd}T23:59:59.999-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calcula o intervalo (em strings YYYY-MM-DD e objetos Date UTC correspondentes a BRT)
 * para os presets comerciais:
 * - HOJE: dia atual
 * - ONTEM: dia anterior
 * - SEMANA: segunda-feira da semana atual até hoje
 * - MES: dia 1º do mês atual até hoje
 */
export function getPeriodoPresetDates(
  preset: PeriodoPreset,
  now: Date = new Date()
): PeriodoRange {
  const hojeStr = getSaoPauloDateString(now);

  let inicioStr = hojeStr;
  let fimStr = hojeStr;

  if (preset === "ONTEM") {
    const ontemStr = shiftDateString(hojeStr, -1);
    inicioStr = ontemStr;
    fimStr = ontemStr;
  } else if (preset === "AMANHA") {
    const amanhaStr = shiftDateString(hojeStr, 1);
    inicioStr = amanhaStr;
    fimStr = amanhaStr;
  } else if (preset === "SEMANA") {
    const [y, m, d] = hojeStr.split("-").map(Number);
    const utcDay = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
    // Segunda-feira = 1 -> 0 dias atrás; Domingo = 0 -> 6 dias atrás
    const diasDesdeSegunda = (utcDay + 6) % 7;
    inicioStr = shiftDateString(hojeStr, -diasDesdeSegunda);
    fimStr = hojeStr;
  } else if (preset === "MES") {
    inicioStr = `${hojeStr.slice(0, 8)}01`;
    fimStr = hojeStr;
  }

  const inicio = parseSaoPauloDateStart(inicioStr)!;
  const fim = parseSaoPauloDateEnd(fimStr)!;

  return { inicioStr, fimStr, inicio, fim };
}

/**
 * Formata uma data YYYY-MM-DD no padrão curto DD/MM.
 */
export function formatYmdShortBr(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

/**
 * Formata uma data YYYY-MM-DD no padrão completo DD/MM/AAAA.
 */
export function formatYmdBr(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formata um Date ou string ISO no padrão DD/MM/AAAA usando o fuso America/Sao_Paulo.
 */
export function formatDateSaoPauloBr(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return saoPauloDateBrFormatter.format(date);
}

/**
 * Formata o nome do mês e ano no fuso America/Sao_Paulo (ex.: "novembro de 2026").
 */
export function formatMonthYearSaoPaulo(now: Date = new Date()): string {
  return saoPauloMonthYearFormatter.format(now);
}

/**
 * Extrai YYYY-MM-DD no fuso America/Sao_Paulo a partir de uma string (YYYY-MM-DD ou ISO) ou Date.
 * Retorna "" se vazio ou inválido.
 */
export function toYmdString(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (isValidYmd(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return "";
    return getSaoPauloDateString(parsed);
  }
  if (Number.isNaN(value.getTime())) return "";
  return getSaoPauloDateString(value);
}

/**
 * Converte uma data de calendário (YYYY-MM-DD ou Date/ISO) para Date ancorado ao meio-dia (-03:00),
 * evitando desvios de dia por fuso horário ao persistir no banco.
 */
export function parseCalendarDateToSaoPauloNoon(
  value: Date | string | null | undefined
): Date | null {
  const ymd = toYmdString(value);
  if (!ymd) return null;
  const parsed = new Date(`${ymd}T12:00:00.000-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calcula a data de entrega prevista padrão (D+1) a partir da data de embarque YYYY-MM-DD.
 */
export function calcularDataEntregaPadrao(dataEmbarqueYmd: string): string {
  if (!isValidYmd(dataEmbarqueYmd)) return "";
  return shiftDateString(dataEmbarqueYmd, 1);
}

/**
 * Retorna as datas padrão de um novo pedido: embarque hoje e entrega prevista amanhã (D+1).
 */
export function getDefaultDatasPedido(now: Date = new Date()): {
  dataEmbarque: string;
  dataEntregaPrevista: string;
} {
  const dataEmbarque = getSaoPauloDateString(now);
  return {
    dataEmbarque,
    dataEntregaPrevista: shiftDateString(dataEmbarque, 1),
  };
}

/**
 * Formata uma data de calendário (YYYY-MM-DD, ISO ou Date) como DD/MM/AAAA em America/Sao_Paulo.
 */
export function formatCalendarDateBr(
  value: Date | string | null | undefined
): string {
  const ymd = toYmdString(value);
  return ymd ? formatYmdBr(ymd) : "-";
}

/**
 * Formata uma data de calendário (YYYY-MM-DD, ISO ou Date) como DD/MM em America/Sao_Paulo.
 */
export function formatCalendarDateShortBr(
  value: Date | string | null | undefined
): string {
  const ymd = toYmdString(value);
  return ymd ? formatYmdShortBr(ymd) : "-";
}

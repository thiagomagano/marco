import { formatCnpj, isValidCnpj, normalizeCnpj } from "./cnpj.ts";

export const BRASIL_API_CNPJ_BASE_URL = "https://brasilapi.com.br/api/cnpj/v1";
export const BRASIL_API_TIMEOUT_MS = 10_000;
export const BRASIL_API_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const MAX_CACHE_ENTRIES = 500;

export interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string | null;
  data_situacao_cadastral?: string | null;
  data_inicio_atividade?: string | null;
  cnae_fiscal_descricao?: string | null;
  porte?: string | null;
  descricao_tipo_de_logradouro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  uf?: string | null;
  municipio?: string | null;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  email?: string | null;
}

export interface ClienteCamposBrasilApi {
  razaoSocialOuNome: string | null;
  nomeFantasia: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
}

export interface ConsultaCnpjMetadados {
  cnpj: string;
  cnpjFormatado: string;
  situacaoCadastral: string | null;
  dataSituacaoCadastral: string | null;
  dataInicioAtividade: string | null;
  cnaePrincipal: string | null;
  porte: string | null;
}

export interface ConsultaCnpjResult {
  campos: ClienteCamposBrasilApi;
  metadados: ConsultaCnpjMetadados;
  cached: boolean;
}

export class BrasilApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BrasilApiError";
    this.status = status;
  }
}

const PORTUGUESE_LOWERCASE_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
]);

function capitalizeSegment(
  segment: string,
  isFirstWord: boolean,
  isLastWord: boolean
): string {
  if (!segment) return "";

  const lower = segment.toLocaleLowerCase("pt-BR");
  if (lower === "s/n") {
    return "S/N";
  }

  // Letra isolada no fim (ex.: "Galpão A", "Bloco O") é identificador, não artigo/conjunção
  if (isLastWord && lower.length === 1) {
    return lower.toLocaleUpperCase("pt-BR");
  }

  if (!isFirstWord && PORTUGUESE_LOWERCASE_WORDS.has(lower)) {
    return lower;
  }

  // Trata prefixos com apóstrofo como "D'Água"
  const apostropheIdx = lower.indexOf("'");
  if (apostropheIdx > 0 && apostropheIdx < lower.length - 1) {
    const prefix = lower.slice(0, apostropheIdx);
    const rest = lower.slice(apostropheIdx + 1);
    return `${prefix}'${rest.charAt(0).toLocaleUpperCase("pt-BR")}${rest.slice(1)}`;
  }

  return `${lower.charAt(0).toLocaleUpperCase("pt-BR")}${lower.slice(1)}`;
}

/**
 * Converte textos em caixa alta (padrão da Receita Federal) para Title Case em PT-BR,
 * mantendo preposições comuns em minúsculas quando não estão no início da frase.
 */
export function toTitleCasePtBr(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const tokens = cleaned.split(" ");
  const lastIdx = tokens.length - 1;
  return tokens
    .map((token, idx) => {
      if (token.includes("-")) {
        const parts = token.split("-");
        const lastPartIdx = parts.length - 1;
        return parts
          .map((part, partIdx) =>
            capitalizeSegment(
              part,
              idx === 0 && partIdx === 0,
              idx === lastIdx && partIdx === lastPartIdx
            )
          )
          .join("-");
      }
      return capitalizeSegment(token, idx === 0, idx === lastIdx);
    })
    .join(" ");
}

/**
 * Formata um CEP de 8 dígitos para XXXXX-XXX.
 */
export function formatCepBrasilApi(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const digits = cep.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep.trim();
}

/**
 * Formata o telefone retornado pela BrasilAPI (DDD + número) para padrão brasileiro.
 */
export function formatTelefoneBrasilApi(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Algumas bases trazem 0 na frente do DDD (ex.: 06232001234 ou 062999991234)
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  return raw.trim();
}

/**
 * Monta o campo de endereço combinando tipo, logradouro, número e complemento em Title Case.
 */
export function buildEnderecoFromBrasilApi(
  data: Pick<
    BrasilApiCnpjResponse,
    "descricao_tipo_de_logradouro" | "logradouro" | "numero" | "complemento"
  >
): string | null {
  const tipo = (data.descricao_tipo_de_logradouro || "").replace(/\s+/g, " ").trim();
  const logradouro = (data.logradouro || "").replace(/\s+/g, " ").trim();
  const numero = (data.numero || "").replace(/\s+/g, " ").trim();
  const complemento = (data.complemento || "").replace(/\s+/g, " ").trim();

  let baseLogradouro = logradouro;
  if (tipo && logradouro) {
    const logUpper = logradouro.toLocaleUpperCase("pt-BR");
    const tipoUpper = tipo.toLocaleUpperCase("pt-BR");
    if (!logUpper.startsWith(`${tipoUpper} `)) {
      baseLogradouro = `${tipo} ${logradouro}`;
    }
  } else if (tipo && !logradouro) {
    baseLogradouro = tipo;
  }

  if (!baseLogradouro && !numero && !complemento) {
    return null;
  }

  const partes: string[] = [];
  if (baseLogradouro) {
    partes.push(toTitleCasePtBr(baseLogradouro) || baseLogradouro);
  }
  if (numero) {
    partes.push(toTitleCasePtBr(numero) || numero);
  }

  let resultado = partes.join(", ");
  if (complemento) {
    const compFormatado = toTitleCasePtBr(complemento) || complemento;
    resultado = resultado ? `${resultado} - ${compFormatado}` : compFormatado;
  }

  return resultado || null;
}

/**
 * Monta o campo Cidade / Município no padrão "Cidade - UF".
 */
export function buildCidadeUfFromBrasilApi(
  municipio: string | null | undefined,
  uf: string | null | undefined
): string | null {
  const municipioFmt = toTitleCasePtBr(municipio);
  const ufFmt = uf ? uf.trim().toLocaleUpperCase("pt-BR") : "";

  if (municipioFmt && ufFmt) {
    return `${municipioFmt} - ${ufFmt}`;
  }
  return municipioFmt || (ufFmt || null);
}

/**
 * Normaliza espaços e converte texto para UPPERCASE (padrão oficial da Receita Federal).
 */
export function toUpperCaseNormalized(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.toLocaleUpperCase("pt-BR") : null;
}

/**
 * Mapeia o payload bruto da BrasilAPI para os campos editáveis do cadastro de Cliente.
 */
export function mapBrasilApiToClienteResult(
  raw: BrasilApiCnpjResponse,
  cnpjNormalizado: string,
  cached = false
): ConsultaCnpjResult {
  const emailLimpo = raw.email ? raw.email.trim().toLowerCase() : "";
  const telefonePrincipal =
    formatTelefoneBrasilApi(raw.ddd_telefone_1) ||
    formatTelefoneBrasilApi(raw.ddd_telefone_2);

  return {
    campos: {
      razaoSocialOuNome: toUpperCaseNormalized(raw.razao_social),
      nomeFantasia: toTitleCasePtBr(raw.nome_fantasia),
      telefone: telefonePrincipal,
      email: emailLimpo || null,
      cep: formatCepBrasilApi(raw.cep),
      endereco: buildEnderecoFromBrasilApi(raw),
      bairro: toTitleCasePtBr(raw.bairro),
      cidade: buildCidadeUfFromBrasilApi(raw.municipio, raw.uf),
    },
    metadados: {
      cnpj: cnpjNormalizado,
      cnpjFormatado: formatCnpj(cnpjNormalizado),
      situacaoCadastral: toUpperCaseNormalized(raw.descricao_situacao_cadastral),
      dataSituacaoCadastral: raw.data_situacao_cadastral || null,
      dataInicioAtividade: raw.data_inicio_atividade || null,
      cnaePrincipal: toTitleCasePtBr(raw.cnae_fiscal_descricao),
      porte: toTitleCasePtBr(raw.porte),
    },
    cached,
  };
}

interface CacheEntry {
  expiresAt: number;
  result: Omit<ConsultaCnpjResult, "cached">;
}

const cnpjCache = new Map<string, CacheEntry>();

export function clearBrasilApiCache(): void {
  cnpjCache.clear();
}

function pruneCacheIfNeeded(now: number): void {
  if (cnpjCache.size < MAX_CACHE_ENTRIES) return;
  for (const [key, entry] of cnpjCache.entries()) {
    if (entry.expiresAt <= now) {
      cnpjCache.delete(key);
    }
  }
  if (cnpjCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cnpjCache.keys().next().value;
    if (oldestKey) {
      cnpjCache.delete(oldestKey);
    }
  }
}

export interface ConsultarCnpjOptions {
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  bypassCache?: boolean;
  now?: number;
}

/**
 * Consulta os dados cadastrais de um CNPJ na BrasilAPI com validação prévia (fail fast),
 * timeout, cache em memória com TTL e tratamento explícito de erros HTTP.
 */
export async function consultarCnpjBrasilApi(
  cnpjInput: string | null | undefined,
  options: ConsultarCnpjOptions = {}
): Promise<ConsultaCnpjResult> {
  const cnpjNormalizado = normalizeCnpj(cnpjInput);
  if (!cnpjNormalizado || !isValidCnpj(cnpjNormalizado)) {
    throw new BrasilApiError(
      "CNPJ inválido. Verifique os 14 dígitos antes de consultar.",
      400
    );
  }

  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? BRASIL_API_CACHE_TTL_MS;

  if (!options.bypassCache) {
    const cachedEntry = cnpjCache.get(cnpjNormalizado);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return {
        ...cachedEntry.result,
        cached: true,
      };
    }
    if (cachedEntry) {
      cnpjCache.delete(cnpjNormalizado);
    }
  }

  const fetchFn = options.fetchImpl ?? fetch;
  const url = `${BRASIL_API_CNPJ_BASE_URL}/${cnpjNormalizado}`;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarcoSistemaPedidos/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(BRASIL_API_TIMEOUT_MS),
    });
  } catch (err) {
    const errorName = (err as Error)?.name;
    if (errorName === "TimeoutError" || errorName === "AbortError") {
      throw new BrasilApiError(
        "Tempo limite esgotado ao consultar a BrasilAPI. Tente novamente em instantes.",
        504
      );
    }
    throw new BrasilApiError(
      "Não foi possível conectar à BrasilAPI. Verifique a conexão e tente novamente.",
      502
    );
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new BrasilApiError(
        "CNPJ inválido ou rejeitado pela BrasilAPI.",
        400
      );
    }
    if (response.status === 404) {
      throw new BrasilApiError(
        "CNPJ não encontrado na base pública da Receita Federal.",
        404
      );
    }
    if (response.status === 429) {
      throw new BrasilApiError(
        "Limite de consultas da BrasilAPI atingido temporariamente. Aguarde alguns segundos e tente novamente.",
        429
      );
    }
    if (response.status >= 500) {
      throw new BrasilApiError(
        "O serviço da BrasilAPI/Receita Federal está temporariamente indisponível. Tente novamente em instantes.",
        503
      );
    }
    throw new BrasilApiError(
      `Falha ao consultar CNPJ na BrasilAPI (HTTP ${response.status}).`,
      502
    );
  }

  let payload: BrasilApiCnpjResponse;
  try {
    payload = (await response.json()) as BrasilApiCnpjResponse;
  } catch {
    throw new BrasilApiError(
      "Resposta inválida recebida da BrasilAPI.",
      502
    );
  }

  const mapped = mapBrasilApiToClienteResult(payload, cnpjNormalizado, false);

  if (ttlMs > 0) {
    pruneCacheIfNeeded(now);
    cnpjCache.set(cnpjNormalizado, {
      expiresAt: now + ttlMs,
      result: {
        campos: mapped.campos,
        metadados: mapped.metadados,
      },
    });
  }

  return mapped;
}

import type { Prisma } from "@prisma/client";
import { normalizeCnpj } from "./cnpj.ts";

export interface ClienteBuscaFields {
  razaoSocialOuNome?: string | null;
  nomeFantasia?: string | null;
  cnpjNormalized?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  prazoPagamentoBoleto?: string | null;
  cidade?: string | null;
  bairro?: string | null;
}

export interface SearchTerm {
  raw: string;
  normalized: string;
  digits: string;
}

/**
 * Remove acentos, converte para minúsculas e normaliza espaços em branco.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gera a string consolidada e normalizada usada para busca rápida e sem acentos em SQLite.
 */
export function buildClienteBuscaTexto(fields: ClienteBuscaFields): string {
  const cnpjNorm = fields.cnpjNormalized || normalizeCnpj(fields.cnpj) || "";
  const prazoNorm = normalizeSearchText(fields.prazoPagamentoBoleto);
  const prazoEspacado = prazoNorm ? prazoNorm.replace(/[\/-]+/g, " ") : "";

  const parts = [
    normalizeSearchText(fields.razaoSocialOuNome),
    normalizeSearchText(fields.nomeFantasia),
    cnpjNorm,
    normalizeSearchText(fields.inscricaoEstadual),
    prazoNorm,
    prazoEspacado !== prazoNorm ? prazoEspacado : "",
    normalizeSearchText(fields.cidade),
    normalizeSearchText(fields.bairro),
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Quebra o texto digitado em termos normalizados (limitado a 8 termos).
 */
export function extractSearchTerms(query: string | null | undefined): SearchTerm[] {
  if (!query) return [];
  const rawTokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const terms: SearchTerm[] = [];

  for (const raw of rawTokens) {
    const normalized = normalizeSearchText(raw);
    if (!normalized) continue;
    const digits = raw.replace(/\D/g, "");
    terms.push({ raw, normalized, digits });
  }

  return terms;
}

/**
 * Monta o filtro Prisma para consultas paginadas e combobox de clientes.
 */
export function buildClienteWhere(params: {
  busca?: string | null;
  vendedorId?: string | null;
  ativos?: boolean | null;
}): Prisma.ClienteWhereInput {
  const where: Prisma.ClienteWhereInput = {};

  if (typeof params.ativos === "boolean") {
    where.ativo = params.ativos;
  }

  if (params.vendedorId && params.vendedorId.trim()) {
    where.vendedorId = params.vendedorId.trim();
  }

  const terms = extractSearchTerms(params.busca);
  if (terms.length > 0) {
    where.AND = terms.map((term): Prisma.ClienteWhereInput => {
      const hasFormattedDigits =
        term.digits.length >= 2 && term.digits !== term.normalized;

      const normalizedMatch: Prisma.ClienteWhereInput = hasFormattedDigits
        ? {
            OR: [
              { buscaTexto: { contains: term.normalized } },
              { buscaTexto: { contains: term.digits } },
            ],
          }
        : { buscaTexto: { contains: term.normalized } };

      const legacyFallback: Prisma.ClienteWhereInput = {
        AND: [
          { buscaTexto: null },
          {
            OR: [
              { razaoSocialOuNome: { contains: term.raw } },
              { nomeFantasia: { contains: term.raw } },
              ...(term.digits.length >= 2
                ? [
                    { cnpjNormalized: { contains: term.digits } },
                    { inscricaoEstadual: { contains: term.digits } },
                  ]
                : []),
              { inscricaoEstadual: { contains: term.raw } },
              { prazoPagamentoBoleto: { contains: term.raw } },
              { cidade: { contains: term.raw } },
              { bairro: { contains: term.raw } },
            ],
          },
        ],
      };

      return { OR: [normalizedMatch, legacyFallback] };
    });
  }

  return where;
}

/**
 * Prioriza correspondências exatas ou por prefixo no Nome Fantasia / Razão Social.
 */
export function rankClientesByQuery<
  T extends { razaoSocialOuNome: string; nomeFantasia: string | null },
>(clientes: T[], query?: string | null): T[] {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return clientes;

  const scoreCliente = (c: T): number => {
    const fantasia = normalizeSearchText(c.nomeFantasia);
    const razao = normalizeSearchText(c.razaoSocialOuNome);
    if (fantasia.startsWith(normQuery)) return 0;
    if (razao.startsWith(normQuery)) return 1;
    if (fantasia.includes(normQuery) || razao.includes(normQuery)) return 2;
    return 3;
  };

  return [...clientes].sort((a, b) => {
    const diff = scoreCliente(a) - scoreCliente(b);
    if (diff !== 0) return diff;
    return a.razaoSocialOuNome.localeCompare(b.razaoSocialOuNome, "pt-BR");
  });
}

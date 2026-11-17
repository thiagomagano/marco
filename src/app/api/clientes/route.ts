import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "@/lib/cnpj.ts";
import { parseInscricaoEstadualInput } from "@/lib/inscricao-estadual.ts";
import {
  normalizePrazoPagamentoBoleto,
  PRAZO_PAGAMENTO_DEFAULT,
} from "@/lib/prazo-pagamento.ts";
import {
  buildClienteBuscaTexto,
  buildClienteWhere,
} from "@/lib/cliente-search.ts";
import { ensureClientesBuscaTextoBackfilled } from "@/lib/cliente-backfill.ts";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: Request) {
  try {
    await requireAuth();
    await ensureClientesBuscaTextoBackfilled();

    const { searchParams } = new URL(request.url);
    const ativosParam = searchParams.get("ativos");
    const ativos =
      ativosParam === "true" ? true : ativosParam === "false" ? false : null;
    const busca = searchParams.get("busca")?.trim();
    const vendedorId = searchParams.get("vendedorId")?.trim();

    const pageRaw = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitRaw = Number.parseInt(
      searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
      10
    );
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const where = buildClienteWhere({ busca, vendedorId, ativos });

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: [{ razaoSocialOuNome: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vendedor: {
            select: { id: true, nome: true },
          },
          _count: {
            select: { pedidos: true },
          },
        },
      }),
      prisma.cliente.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      clientes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const {
      razaoSocialOuNome,
      nomeFantasia,
      cnpj,
      inscricaoEstadual,
      prazoPagamentoBoleto,
      vendedorId,
      telefone,
      email,
      endereco,
      bairro,
      cidade,
      cep,
      observacoes,
    } = body;

    if (!razaoSocialOuNome || !razaoSocialOuNome.trim()) {
      return NextResponse.json(
        { error: "Razão social ou nome do cliente é obrigatório." },
        { status: 400 }
      );
    }

    if (!vendedorId || !vendedorId.trim()) {
      return NextResponse.json(
        { error: "Vendedor responsável é obrigatório." },
        { status: 400 }
      );
    }

    const vendedorExiste = await prisma.vendedor.findUnique({
      where: { id: vendedorId.trim() },
    });
    if (!vendedorExiste || !vendedorExiste.ativo) {
      return NextResponse.json(
        { error: "Vendedor selecionado não existe ou está inativo." },
        { status: 400 }
      );
    }

    let normalizedCnpj: string | null = null;
    let formattedCnpj: string | null = null;

    if (cnpj && cnpj.trim()) {
      normalizedCnpj = normalizeCnpj(cnpj);
      if (!isValidCnpj(normalizedCnpj)) {
        return NextResponse.json(
          { error: "O CNPJ informado é inválido." },
          { status: 400 }
        );
      }
      formattedCnpj = formatCnpj(normalizedCnpj);

      // Regra: Não pode duplicar CNPJ entre clientes
      if (normalizedCnpj) {
        const existente = await prisma.cliente.findUnique({
          where: { cnpjNormalized: normalizedCnpj },
        });
        if (existente) {
          return NextResponse.json(
            {
              error: `Este CNPJ já está cadastrado para o cliente "${existente.razaoSocialOuNome}" (ID: ${existente.id}).`,
              clienteExistenteId: existente.id,
            },
            { status: 400 }
          );
        }
      }
    }

    const ieParsed = parseInscricaoEstadualInput(inscricaoEstadual);
    if (!ieParsed.valid) {
      return NextResponse.json({ error: ieParsed.error }, { status: 400 });
    }

    const prazoParsed =
      prazoPagamentoBoleto === undefined
        ? { valid: true, value: PRAZO_PAGAMENTO_DEFAULT }
        : normalizePrazoPagamentoBoleto(prazoPagamentoBoleto);
    if (!prazoParsed.valid) {
      return NextResponse.json({ error: prazoParsed.error }, { status: 400 });
    }

    // Aviso de possível duplicidade por nome quando sem CNPJ
    const nomeLimpo = razaoSocialOuNome.trim();
    const similar = await prisma.cliente.findFirst({
      where: {
        razaoSocialOuNome: {
          contains: nomeLimpo,
        },
      },
    });

    const nomeFantasiaLimpo = nomeFantasia?.trim() || null;
    const cidadeLimpa = cidade?.trim() || null;
    const bairroLimpo = bairro?.trim() || null;

    const cliente = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: nomeLimpo,
        nomeFantasia: nomeFantasiaLimpo,
        cnpj: formattedCnpj,
        cnpjNormalized: normalizedCnpj,
        inscricaoEstadual: ieParsed.normalized,
        prazoPagamentoBoleto: prazoParsed.value,
        vendedorId: vendedorId.trim(),
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        endereco: endereco?.trim() || null,
        bairro: bairroLimpo,
        cidade: cidadeLimpa,
        cep: cep?.trim() || null,
        observacoes: observacoes?.trim() || null,
        buscaTexto: buildClienteBuscaTexto({
          razaoSocialOuNome: nomeLimpo,
          nomeFantasia: nomeFantasiaLimpo,
          cnpjNormalized: normalizedCnpj,
          inscricaoEstadual: ieParsed.normalized,
          prazoPagamentoBoleto: prazoParsed.value,
          cidade: cidadeLimpa,
          bairro: bairroLimpo,
        }),
        ativo: true,
      },
      include: {
        vendedor: {
          select: { id: true, nome: true },
        },
      },
    });

    return NextResponse.json(
      {
        cliente,
        aviso:
          !normalizedCnpj && similar
            ? `Aviso: Foi identificado outro cliente com nome similar ("${similar.razaoSocialOuNome}"). Cadastro realizado.`
            : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao cadastrar cliente." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "@/lib/cnpj.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get("ativos") === "true";
    const busca = searchParams.get("busca")?.trim();
    const vendedorId = searchParams.get("vendedorId")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (apenasAtivos) where.ativo = true;
    if (vendedorId) where.vendedorId = vendedorId;
    if (busca) {
      where.OR = [
        { razaoSocialOuNome: { contains: busca } },
        { nomeFantasia: { contains: busca } },
        { cnpjNormalized: { contains: normalizeCnpj(busca) || busca } },
        { cidade: { contains: busca } },
        { bairro: { contains: busca } },
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { razaoSocialOuNome: "asc" },
      include: {
        vendedor: {
          select: { id: true, nome: true },
        },
        _count: {
          select: { pedidos: true },
        },
      },
    });

    return NextResponse.json(clientes);
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

    // Aviso de possível duplicidade por nome quando sem CNPJ
    const nomeLimpo = razaoSocialOuNome.trim();
    const similar = await prisma.cliente.findFirst({
      where: {
        razaoSocialOuNome: {
          contains: nomeLimpo,
        },
      },
    });

    const cliente = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: nomeLimpo,
        nomeFantasia: nomeFantasia?.trim() || null,
        cnpj: formattedCnpj,
        cnpjNormalized: normalizedCnpj,
        vendedorId: vendedorId.trim(),
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        endereco: endereco?.trim() || null,
        bairro: bairro?.trim() || null,
        cidade: cidade?.trim() || null,
        cep: cep?.trim() || null,
        observacoes: observacoes?.trim() || null,
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

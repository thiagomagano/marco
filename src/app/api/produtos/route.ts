import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";

const UNIDADES_VALIDAS = ["kg", "peça", "caixa"];

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const frigorificoId = searchParams.get("frigorificoId");
    const apenasAtivos = searchParams.get("ativos") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (frigorificoId) where.frigorificoId = frigorificoId;
    if (apenasAtivos) where.ativo = true;

    const produtos = await prisma.produto.findMany({
      where,
      orderBy: [{ frigorifico: { nomeFantasia: "asc" } }, { nome: "asc" }],
      include: {
        frigorifico: {
          select: { id: true, nomeFantasia: true },
        },
        _count: {
          select: { itensPedido: true },
        },
      },
    });

    return NextResponse.json(produtos);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar produtos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const { frigorificoId, codigo, nome, categoria, embalagem, unidade, precoReferencia } = body;

    if (!frigorificoId || !codigo || !nome || !unidade) {
      return NextResponse.json(
        { error: "Frigorífico, código, nome e unidade comercial são obrigatórios." },
        { status: 400 }
      );
    }

    const u = unidade.toLowerCase().trim();
    if (!UNIDADES_VALIDAS.includes(u)) {
      return NextResponse.json(
        { error: "Unidade comercial inválida. Deve ser: 'kg', 'peça' ou 'caixa'." },
        { status: 400 }
      );
    }

    // Regra 1: Código único dentro do respectivo frigorífico
    const codigoLimpo = codigo.trim();
    const duplicado = await prisma.produto.findUnique({
      where: {
        frigorificoId_codigo: {
          frigorificoId,
          codigo: codigoLimpo,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        {
          error: `Já existe um produto com o código "${codigoLimpo}" neste frigorífico (${duplicado.nome}).`,
        },
        { status: 400 }
      );
    }

    const ref = precoReferencia !== undefined && precoReferencia !== "" && precoReferencia !== null
      ? Number(precoReferencia)
      : null;

    if (ref !== null && (isNaN(ref) || ref < 0)) {
      return NextResponse.json(
        { error: "Preço de referência inválido." },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.create({
      data: {
        frigorificoId,
        codigo: codigoLimpo,
        nome: nome.trim(),
        categoria: categoria?.trim() || null,
        embalagem: embalagem?.trim() || null,
        unidade: u,
        precoReferencia: ref,
        ativo: true,
      },
      include: {
        frigorifico: { select: { id: true, nomeFantasia: true } },
      },
    });

    return NextResponse.json(produto, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao cadastrar produto." },
      { status: 500 }
    );
  }
}

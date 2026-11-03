import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "@/lib/cnpj.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get("ativos") === "true";

    const frigorificos = await prisma.frigorifico.findMany({
      where: apenasAtivos ? { ativo: true } : undefined,
      orderBy: { nomeFantasia: "asc" },
      include: {
        _count: {
          select: { produtos: true, pedidos: true },
        },
      },
    });

    return NextResponse.json(frigorificos);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar frigoríficos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const { nomeFantasia, razaoSocial, cnpj, contato, telefone, email, observacoes } = body;

    if (!nomeFantasia || !nomeFantasia.trim()) {
      return NextResponse.json(
        { error: "Nome fantasia é obrigatório." },
        { status: 400 }
      );
    }

    let normalizedCnpj: string | null = null;
    let formattedCnpj: string | null = null;

    if (cnpj && cnpj.trim()) {
      normalizedCnpj = normalizeCnpj(cnpj);
      if (!isValidCnpj(normalizedCnpj)) {
        return NextResponse.json(
          { error: "CNPJ informado é inválido." },
          { status: 400 }
        );
      }
      formattedCnpj = formatCnpj(normalizedCnpj);

      // Checa duplicidade
      const existente = await prisma.frigorifico.findFirst({
        where: { cnpjNormalized: normalizedCnpj },
      });
      if (existente) {
        return NextResponse.json(
          { error: `Já existe um frigorífico cadastrado com este CNPJ (${existente.nomeFantasia}).` },
          { status: 400 }
        );
      }
    }

    const frigorifico = await prisma.frigorifico.create({
      data: {
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial?.trim() || null,
        cnpj: formattedCnpj,
        cnpjNormalized: normalizedCnpj,
        contato: contato?.trim() || null,
        telefone: telefone?.trim() || null,
        email: email?.trim() || null,
        observacoes: observacoes?.trim() || null,
        ativo: true,
      },
    });

    return NextResponse.json(frigorifico, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao cadastrar frigorífico." },
      { status: 500 }
    );
  }
}

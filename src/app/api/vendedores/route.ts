import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const apenasAtivos = searchParams.get("ativos") === "true";

    const vendedores = await prisma.vendedor.findMany({
      where: apenasAtivos ? { ativo: true } : undefined,
      orderBy: { nome: "asc" },
      include: {
        _count: {
          select: { clientes: true, pedidos: true },
        },
      },
    });

    return NextResponse.json(vendedores);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar vendedores." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const { nome, telefone, observacoes } = body;

    if (!nome || !nome.trim()) {
      return NextResponse.json(
        { error: "Nome do vendedor é obrigatório." },
        { status: 400 }
      );
    }

    const vendedor = await prisma.vendedor.create({
      data: {
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        observacoes: observacoes?.trim() || null,
        ativo: true,
      },
    });

    return NextResponse.json(vendedor, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao cadastrar vendedor." },
      { status: 500 }
    );
  }
}

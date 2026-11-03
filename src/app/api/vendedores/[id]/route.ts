import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const vendedor = await prisma.vendedor.findUnique({ where: { id } });
    if (!vendedor) {
      return NextResponse.json({ error: "Vendedor não encontrado." }, { status: 404 });
    }

    const atualizado = await prisma.vendedor.update({
      where: { id },
      data: {
        nome: body.nome?.trim() ?? vendedor.nome,
        telefone: body.telefone !== undefined ? body.telefone?.trim() || null : vendedor.telefone,
        observacoes: body.observacoes !== undefined ? body.observacoes?.trim() || null : vendedor.observacoes,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : vendedor.ativo,
      },
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao atualizar vendedor." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const countPedidos = await prisma.pedido.count({ where: { vendedorId: id } });
    if (countPedidos > 0) {
      return NextResponse.json(
        {
          error: `Este vendedor possui ${countPedidos} pedido(s) registrado(s) e não pode ser excluído fisicamente. Utilize a inativação.`,
        },
        { status: 400 }
      );
    }

    await prisma.vendedor.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao excluir vendedor." },
      { status: 500 }
    );
  }
}

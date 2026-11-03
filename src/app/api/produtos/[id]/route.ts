import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";

const UNIDADES_VALIDAS = ["kg", "peça", "caixa"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    let codigoAtualizado = produto.codigo;
    if (body.codigo && body.codigo.trim() !== produto.codigo) {
      codigoAtualizado = body.codigo.trim();
      // Checa unicidade no mesmo frigorífico
      const duplicado = await prisma.produto.findFirst({
        where: {
          frigorificoId: produto.frigorificoId,
          codigo: codigoAtualizado,
          id: { not: id },
        },
      });
      if (duplicado) {
        return NextResponse.json(
          { error: `Já existe outro produto com o código "${codigoAtualizado}" neste frigorífico.` },
          { status: 400 }
        );
      }
    }

    let unidadeAtualizada = produto.unidade;
    if (body.unidade) {
      const u = body.unidade.toLowerCase().trim();
      if (!UNIDADES_VALIDAS.includes(u)) {
        return NextResponse.json(
          { error: "Unidade comercial inválida. Deve ser: 'kg', 'peça' ou 'caixa'." },
          { status: 400 }
        );
      }
      unidadeAtualizada = u;
    }

    let precoRefAtualizado = produto.precoReferencia;
    if (body.precoReferencia !== undefined) {
      if (body.precoReferencia === "" || body.precoReferencia === null) {
        precoRefAtualizado = null;
      } else {
        const val = Number(body.precoReferencia);
        if (isNaN(val) || val < 0) {
          return NextResponse.json({ error: "Preço de referência inválido." }, { status: 400 });
        }
        precoRefAtualizado = val;
      }
    }

    const atualizado = await prisma.produto.update({
      where: { id },
      data: {
        codigo: codigoAtualizado,
        nome: body.nome?.trim() ?? produto.nome,
        categoria: body.categoria !== undefined ? body.categoria?.trim() || null : produto.categoria,
        unidade: unidadeAtualizada,
        precoReferencia: precoRefAtualizado,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : produto.ativo,
      },
      include: {
        frigorifico: { select: { id: true, nomeFantasia: true } },
      },
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao atualizar produto." },
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

    // Regra 6: Produtos utilizados em pedidos anteriores não poderão ser fisicamente excluídos.
    const countItens = await prisma.pedidoItem.count({ where: { produtoId: id } });
    if (countItens > 0) {
      return NextResponse.json(
        {
          error: `Este produto foi utilizado em ${countItens} pedido(s) histórico(s) e não pode ser excluído fisicamente. Utilize a inativação do produto.`,
        },
        { status: 400 }
      );
    }

    await prisma.produto.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao excluir produto." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import {
  calculateSubtotal,
  calculateOrderTotal,
  calculateReportedWeightKg,
} from "@/lib/money.ts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        frigorifico: true,
        cliente: true,
        vendedor: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    return NextResponse.json(pedido);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao consultar pedido." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const pedidoExistente = await prisma.pedido.findUnique({
      where: { id },
      include: { itens: true },
    });

    if (!pedidoExistente) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    // AÇÃO 1: Cancelamento de Pedido
    if (body.action === "CANCELAR") {
      const { justificativa } = body;
      if (!justificativa || justificativa.trim().length < 5) {
        return NextResponse.json(
          { error: "A justificativa de cancelamento é obrigatória (mínimo de 5 caracteres)." },
          { status: 400 }
        );
      }

      if (pedidoExistente.status === "CANCELADO") {
        return NextResponse.json(
          { error: "Este pedido já está cancelado." },
          { status: 400 }
        );
      }

      const pedidoCancelado = await prisma.pedido.update({
        where: { id },
        data: {
          status: "CANCELADO",
          justificativaCancelamento: justificativa.trim(),
          dataCancelamento: new Date(),
        },
      });

      return NextResponse.json(pedidoCancelado);
    }

    // REGRA DE SEGURANÇA: Pedidos já confirmados não podem ser editados silenciosamente
    if (pedidoExistente.status === "CONFIRMADO") {
      return NextResponse.json(
        {
          error:
            "Pedidos confirmados não podem ser editados diretamente. Caso haja erro, cancele o pedido com justificativa e registre um novo.",
        },
        { status: 400 }
      );
    }

    // REGRA DE SEGURANÇA: Pedidos cancelados não podem ser reativados
    if (pedidoExistente.status === "CANCELADO") {
      return NextResponse.json(
        { error: "Pedidos cancelados não podem ser alterados ou reativados." },
        { status: 400 }
      );
    }

    // AÇÃO 2: Atualização de Rascunho ou Confirmação de Rascunho
    const {
      frigorificoId,
      clienteId,
      vendedorId,
      status, // "RASCUNHO" ou "CONFIRMADO"
      observacoes,
      itens,
    } = body;

    const fId = frigorificoId || pedidoExistente.frigorificoId;
    const cId = clienteId || pedidoExistente.clienteId;
    const vId = vendedorId || pedidoExistente.vendedorId;
    const isConfirming = status === "CONFIRMADO";

    if (isConfirming && (!itens || itens.length === 0)) {
      return NextResponse.json(
        { error: "Um pedido confirmado precisa conter pelo menos um item." },
        { status: 400 }
      );
    }

    // Validação dos produtos no servidor
    const itensProcessados: Array<{
      produtoId: string;
      produtoCodigoSnapshot: string;
      produtoNomeSnapshot: string;
      produtoUnidadeSnapshot: string;
      produtoEmbalagemSnapshot: string | null;
      quantidade: number;
      precoUnitario: number;
      subtotal: number;
      unidade: string;
    }> = [];
    if (itens && itens.length > 0) {
      const produtoIds = itens.map((i: { produtoId: string }) => i.produtoId);
      const produtosBanco = await prisma.produto.findMany({
        where: { id: { in: produtoIds } },
      });
      const produtosMap = new Map(produtosBanco.map((p) => [p.id, p]));

      for (const item of itens) {
        const prod = produtosMap.get(item.produtoId);
        if (!prod) {
          return NextResponse.json(
            { error: `Produto ${item.produtoId} não encontrado.` },
            { status: 400 }
          );
        }

        if (prod.frigorificoId !== fId) {
          return NextResponse.json(
            { error: `O produto "${prod.nome}" pertence a outro frigorífico.` },
            { status: 400 }
          );
        }

        const qtd = Number(item.quantidade);
        const preco = Number(item.precoUnitario);

        if (isConfirming) {
          if (isNaN(qtd) || qtd <= 0) {
            return NextResponse.json(
              { error: `A quantidade de "${prod.nome}" deve ser maior que zero.` },
              { status: 400 }
            );
          }
          if (isNaN(preco) || preco <= 0) {
            return NextResponse.json(
              { error: `O preço de "${prod.nome}" deve ser informado e maior que zero.` },
              { status: 400 }
            );
          }
        }

        const subtotal = calculateSubtotal(qtd, preco);

        itensProcessados.push({
          produtoId: prod.id,
          produtoCodigoSnapshot: prod.codigo,
          produtoNomeSnapshot: prod.nome,
          produtoUnidadeSnapshot: prod.unidade,
          produtoEmbalagemSnapshot: prod.embalagem || null,
          quantidade: qtd,
          precoUnitario: preco,
          subtotal,
          unidade: prod.unidade,
        });
      }
    }

    const totalEstimado = calculateOrderTotal(itensProcessados);
    const pesoInformadoKg = calculateReportedWeightKg(itensProcessados);

    // Atualização atômica
    const pedidoAtualizado = await prisma.$transaction(async (tx) => {
      // Remove itens antigos
      await tx.pedidoItem.deleteMany({
        where: { pedidoId: id },
      });

      // Atualiza pedido
      return tx.pedido.update({
        where: { id },
        data: {
          frigorificoId: fId,
          clienteId: cId,
          vendedorId: vId,
          status: isConfirming ? "CONFIRMADO" : "RASCUNHO",
          observacoes: observacoes !== undefined ? observacoes : pedidoExistente.observacoes,
          totalEstimado,
          pesoInformadoKg: pesoInformadoKg > 0 ? pesoInformadoKg : null,
          dataConfirmacao: isConfirming ? new Date() : null,
          itens: {
            create: itensProcessados.map((it) => ({
              produtoId: it.produtoId,
              produtoCodigoSnapshot: it.produtoCodigoSnapshot,
              produtoNomeSnapshot: it.produtoNomeSnapshot,
              produtoUnidadeSnapshot: it.produtoUnidadeSnapshot,
              produtoEmbalagemSnapshot: it.produtoEmbalagemSnapshot,
              quantidade: it.quantidade,
              precoUnitario: it.precoUnitario,
              subtotal: it.subtotal,
            })),
          },
        },
        include: {
          itens: true,
        },
      });
    });

    return NextResponse.json(pedidoAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao atualizar pedido." },
      { status: 500 }
    );
  }
}

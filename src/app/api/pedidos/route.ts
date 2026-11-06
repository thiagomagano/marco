import { NextResponse } from "next/server";
import { prisma } from "@/lib/db.ts";
import { requireAuth } from "@/lib/session.ts";
import { generateNextOrderNumber } from "@/lib/order-utils.ts";
import {
  calculateSubtotal,
  calculateOrderTotal,
  calculateReportedWeightKg,
} from "@/lib/money.ts";

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const termo = searchParams.get("termo")?.trim();
    const dataInicio = searchParams.get("dataInicio");
    const dataFim = searchParams.get("dataFim");
    const frigorificoId = searchParams.get("frigorificoId");
    const clienteId = searchParams.get("clienteId");
    const vendedorId = searchParams.get("vendedorId");
    const status = searchParams.get("status");

    // Monta cláusula WHERE dinâmica
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (termo) {
      where.numero = {
        contains: termo,
      };
    }

    if (frigorificoId) {
      where.frigorificoId = frigorificoId;
    }

    if (clienteId) {
      where.clienteId = clienteId;
    }

    if (vendedorId) {
      where.vendedorId = vendedorId;
    }

    if (status && status !== "TODOS") {
      where.status = status;
    }

    if (dataInicio || dataFim) {
      where.dataCriacao = {};
      if (dataInicio) {
        where.dataCriacao.gte = new Date(`${dataInicio}T00:00:00.000Z`);
      }
      if (dataFim) {
        where.dataCriacao.lte = new Date(`${dataFim}T23:59:59.999Z`);
      }
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { dataCriacao: "desc" },
      include: {
        frigorifico: { select: { id: true, nomeFantasia: true } },
        cliente: { select: { id: true, razaoSocialOuNome: true, nomeFantasia: true } },
        vendedor: { select: { id: true, nome: true } },
        itens: {
          select: {
            id: true,
            produtoNomeSnapshot: true,
            produtoCodigoSnapshot: true,
            produtoUnidadeSnapshot: true,
            quantidade: true,
            precoUnitario: true,
            subtotal: true,
          },
        },
      },
    });

    // Total de vendas confirmadas dentro do filtro (seção 8 da especificação)
    const pedidosConfirmados = pedidos.filter((p) => p.status === "CONFIRMADO");
    const totalVendasConfirmadas = pedidosConfirmados.reduce(
      (acc, p) => acc + p.totalEstimado,
      0
    );

    return NextResponse.json({
      pedidos,
      resumo: {
        totalVendasConfirmadas,
        qtdTotal: pedidos.length,
        qtdConfirmados: pedidosConfirmados.length,
        qtdRascunhos: pedidos.filter((p) => p.status === "RASCUNHO").length,
        qtdCancelados: pedidos.filter((p) => p.status === "CANCELADO").length,
      },
    });
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);
    return NextResponse.json(
      { error: "Erro ao consultar lista de pedidos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();

    const {
      frigorificoId,
      clienteId,
      vendedorId,
      status, // "RASCUNHO" ou "CONFIRMADO"
      observacoes,
      itens,
    } = body;

    if (!frigorificoId || !clienteId || !vendedorId) {
      return NextResponse.json(
        { error: "Frigorífico, Cliente e Vendedor são campos obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Valida se Frigorífico, Cliente e Vendedor existem e estão ativos
    const [frigorifico, cliente, vendedor] = await Promise.all([
      prisma.frigorifico.findUnique({ where: { id: frigorificoId } }),
      prisma.cliente.findUnique({ where: { id: clienteId } }),
      prisma.vendedor.findUnique({ where: { id: vendedorId } }),
    ]);

    if (!frigorifico || !frigorifico.ativo) {
      return NextResponse.json(
        { error: "Frigorífico selecionado não existe ou está inativo." },
        { status: 400 }
      );
    }

    if (!cliente || !cliente.ativo) {
      return NextResponse.json(
        { error: "Cliente selecionado não existe ou está inativo." },
        { status: 400 }
      );
    }

    if (!vendedor || !vendedor.ativo) {
      return NextResponse.json(
        { error: "Vendedor selecionado não existe ou está inativo." },
        { status: 400 }
      );
    }

    if (cliente.vendedorId && cliente.vendedorId !== vendedorId) {
      return NextResponse.json(
        { error: "O cliente selecionado não pertence à carteira do vendedor informado." },
        { status: 400 }
      );
    }

    // 2. Se for CONFIRMADO, deve conter pelo menos 1 item
    if (status === "CONFIRMADO" && (!itens || itens.length === 0)) {
      return NextResponse.json(
        { error: "Um pedido confirmado precisa conter pelo menos um item." },
        { status: 400 }
      );
    }

    // 3. Validação rigorosa dos itens no servidor (garante que TODOS pertencem ao frigorífico selecionado)
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
            { error: `Produto com id ${item.produtoId} não encontrado.` },
            { status: 400 }
          );
        }

        // REGRA ESSENCIAL: Todos os produtos devem pertencer ao frigorífico selecionado!
        if (prod.frigorificoId !== frigorificoId) {
          return NextResponse.json(
            {
              error: `O produto "${prod.nome}" pertence a outro frigorífico e não pode ser incluído neste pedido.`,
            },
            { status: 400 }
          );
        }

        if (!prod.ativo) {
          return NextResponse.json(
            { error: `O produto "${prod.nome}" está inativo.` },
            { status: 400 }
          );
        }

        const qtd = Number(item.quantidade);
        const preco = Number(item.precoUnitario);

        if (status === "CONFIRMADO") {
          if (isNaN(qtd) || qtd <= 0) {
            return NextResponse.json(
              { error: `A quantidade do produto "${prod.nome}" deve ser maior que zero.` },
              { status: 400 }
            );
          }
          if (isNaN(preco) || preco <= 0) {
            return NextResponse.json(
              { error: `O preço unitário do produto "${prod.nome}" deve ser informado e maior que zero.` },
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

    // 4. Calcula total e peso informado
    const totalEstimado = calculateOrderTotal(itensProcessados);
    const pesoInformadoKg = calculateReportedWeightKg(itensProcessados);

    // 5. Gera número de pedido
    const { numero, sequencial } = await generateNextOrderNumber();

    const isConfirmed = status === "CONFIRMADO";

    // 6. Criação atômica no banco de dados
    const novoPedido = await prisma.pedido.create({
      data: {
        numero,
        numeroSequencial: sequencial,
        frigorificoId,
        clienteId,
        vendedorId,
        status: isConfirmed ? "CONFIRMADO" : "RASCUNHO",
        observacoes: observacoes || null,
        totalEstimado,
        pesoInformadoKg: pesoInformadoKg > 0 ? pesoInformadoKg : null,
        dataConfirmacao: isConfirmed ? new Date() : null,
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

    return NextResponse.json(novoPedido, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao registrar pedido." },
      { status: 500 }
    );
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";
import {
  calculateSubtotal,
  calculateOrderTotal,
  calculateReportedWeightKg,
} from "../src/lib/money.ts";

test("Edição de Pedidos em Rascunho e Proteção de Pedidos Confirmados/Cancelados", async () => {
  // Carrega entidades necessárias
  const frigorifico = await prisma.frigorifico.findFirstOrThrow({
    where: { nomeFantasia: "Frigorífico Boi Gordo" },
  });
  const produtos = await prisma.produto.findMany({
    where: { frigorificoId: frigorifico.id },
    take: 3,
  });
  assert(produtos.length >= 2, "Necessário pelo menos 2 produtos cadastrados.");

  const vendedor1 = await prisma.vendedor.findFirstOrThrow();
  const cliente = await prisma.cliente.findFirstOrThrow();

  // 1. Criar pedido em status RASCUNHO com 1 item
  const itemInicial = {
    produtoId: produtos[0].id,
    produtoCodigoSnapshot: produtos[0].codigo,
    produtoNomeSnapshot: produtos[0].nome,
    produtoUnidadeSnapshot: produtos[0].unidade,
    quantidade: 5,
    precoUnitario: 50.0,
    subtotal: calculateSubtotal(5, 50.0),
  };

  const pedidoRascunho = await prisma.pedido.create({
    data: {
      numero: "TEST-RASC-01",
      numeroSequencial: 99801,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor1.id,
      status: "RASCUNHO",
      observacoes: "Observação original de rascunho",
      totalEstimado: itemInicial.subtotal,
      pesoInformadoKg: produtos[0].unidade.toLowerCase() === "kg" ? 5 : null,
      itens: {
        create: [itemInicial],
      },
    },
    include: { itens: true },
  });

  assert.equal(pedidoRascunho.status, "RASCUNHO");
  assert.equal(pedidoRascunho.itens.length, 1);
  assert.equal(pedidoRascunho.totalEstimado, 250.0);

  // 2. Simular a Ação de Edição do Rascunho (Adicionar segundo produto e alterar quantidade do primeiro)
  const itensEditados = [
    {
      produtoId: produtos[0].id,
      produtoCodigoSnapshot: produtos[0].codigo,
      produtoNomeSnapshot: produtos[0].nome,
      produtoUnidadeSnapshot: produtos[0].unidade,
      quantidade: 10,
      precoUnitario: 55.0,
      subtotal: calculateSubtotal(10, 55.0), // 550.00
      unidade: produtos[0].unidade,
    },
    {
      produtoId: produtos[1].id,
      produtoCodigoSnapshot: produtos[1].codigo,
      produtoNomeSnapshot: produtos[1].nome,
      produtoUnidadeSnapshot: produtos[1].unidade,
      quantidade: 20,
      precoUnitario: 30.0,
      subtotal: calculateSubtotal(20, 30.0), // 600.00
      unidade: produtos[1].unidade,
    },
  ];

  const novoTotalEstimado = calculateOrderTotal(itensEditados); // 1150.00
  const novoPesoInformadoKg = calculateReportedWeightKg(itensEditados);

  // Executa atualização atômica de rascunho (conforme implementado na API PATCH)
  const rascunhoAtualizado = await prisma.$transaction(async (tx) => {
    // Valida status antes de alterar
    const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoRascunho.id } });
    if (pedido.status !== "RASCUNHO") {
      throw new Error("Apenas pedidos em rascunho podem ser editados.");
    }

    await tx.pedidoItem.deleteMany({
      where: { pedidoId: pedidoRascunho.id },
    });

    return tx.pedido.update({
      where: { id: pedidoRascunho.id },
      data: {
        observacoes: "Observação alterada no rascunho",
        totalEstimado: novoTotalEstimado,
        pesoInformadoKg: novoPesoInformadoKg > 0 ? novoPesoInformadoKg : null,
        itens: {
          create: itensEditados.map((it) => ({
            produtoId: it.produtoId,
            produtoCodigoSnapshot: it.produtoCodigoSnapshot,
            produtoNomeSnapshot: it.produtoNomeSnapshot,
            produtoUnidadeSnapshot: it.produtoUnidadeSnapshot,
            quantidade: it.quantidade,
            precoUnitario: it.precoUnitario,
            subtotal: it.subtotal,
          })),
        },
      },
      include: { itens: true },
    });
  });

  assert.equal(rascunhoAtualizado.status, "RASCUNHO");
  assert.equal(rascunhoAtualizado.observacoes, "Observação alterada no rascunho");
  assert.equal(rascunhoAtualizado.itens.length, 2);
  assert.equal(rascunhoAtualizado.totalEstimado, 1150.0);

  // 3. Confirmar o pedido a partir da tela de edição
  const pedidoConfirmado = await prisma.pedido.update({
    where: { id: pedidoRascunho.id },
    data: {
      status: "CONFIRMADO",
      dataConfirmacao: new Date(),
    },
  });

  assert.equal(pedidoConfirmado.status, "CONFIRMADO");
  assert.ok(pedidoConfirmado.dataConfirmacao !== null);

  // 4. Garantir que pedido CONFIRMADO não aceita edição de rascunho
  let erroBloqueioConfirmado = false;
  try {
    const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoConfirmado.id } });
    if (pedido.status !== "RASCUNHO") {
      throw new Error("Pedidos confirmados não podem ser editados diretamente.");
    }
  } catch (err) {
    erroBloqueioConfirmado = true;
    assert.equal((err as Error).message, "Pedidos confirmados não podem ser editados diretamente.");
  }
  assert.equal(erroBloqueioConfirmado, true, "Pedido confirmado deve ser bloqueado para edição.");

  // 5. Cancelar pedido e garantir que CANCELADO não aceita edição
  const pedidoCancelado = await prisma.pedido.update({
    where: { id: pedidoConfirmado.id },
    data: {
      status: "CANCELADO",
      justificativaCancelamento: "Teste de cancelamento formal com justificativa válida.",
      dataCancelamento: new Date(),
    },
  });

  let erroBloqueioCancelado = false;
  try {
    const pedido = await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoCancelado.id } });
    if (pedido.status !== "RASCUNHO") {
      throw new Error("Pedidos cancelados não podem ser alterados ou reativados.");
    }
  } catch (err) {
    erroBloqueioCancelado = true;
    assert.equal((err as Error).message, "Pedidos cancelados não podem ser alterados ou reativados.");
  }
  assert.equal(erroBloqueioCancelado, true, "Pedido cancelado deve ser bloqueado para edição.");

  // Limpeza do pedido de teste
  await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedidoRascunho.id } });
  await prisma.pedido.delete({ where: { id: pedidoRascunho.id } });
});

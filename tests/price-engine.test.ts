import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";
import { getPriceSuggestion } from "../src/lib/price-engine.ts";

test("Motor de Sugestão de Preços - Prioridades", async () => {
  // Busca frigorífico, produto e cliente existentes do seed
  const frigorifico = await prisma.frigorifico.findFirstOrThrow({
    where: { nomeFantasia: "Frigorífico Boi Gordo" },
  });
  const produto = await prisma.produto.findFirstOrThrow({
    where: { frigorificoId: frigorifico.id, codigo: "101" }, // Picanha, ref: 68.90
  });
  const cliente = await prisma.cliente.findFirstOrThrow({
    where: { nomeFantasia: "Supermercado Progresso" },
  });
  const vendedor = await prisma.vendedor.findFirstOrThrow();

  // Caso 1: Sem pedidos anteriores para este cliente -> deve retornar Preço de Referência
  const sugestao1 = await getPriceSuggestion({
    clienteId: cliente.id,
    frigorificoId: frigorifico.id,
    produtoId: produto.id,
  });
  assert.equal(sugestao1.origem, "REFERENCIA");
  assert.equal(sugestao1.precoSugerido, 68.9);

  // Caso 2: Cria um pedido CONFIRMADO com preço negociado de R$ 65.00
  const pedidoConfirmado = await prisma.pedido.create({
    data: {
      numero: "TEST-CONFIRMED-01",
      numeroSequencial: 99901,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      status: "CONFIRMADO",
      dataConfirmacao: new Date(),
      totalEstimado: 650.0,
      itens: {
        create: {
          produtoId: produto.id,
          produtoCodigoSnapshot: produto.codigo,
          produtoNomeSnapshot: produto.nome,
          produtoUnidadeSnapshot: produto.unidade,
          quantidade: 10,
          precoUnitario: 65.0,
          subtotal: 650.0,
        },
      },
    },
  });

  // Agora deve sugerir o último preço negociado no pedido confirmado (R$ 65.00)
  const sugestao2 = await getPriceSuggestion({
    clienteId: cliente.id,
    frigorificoId: frigorifico.id,
    produtoId: produto.id,
  });
  assert.equal(sugestao2.origem, "HISTORICO");
  assert.equal(sugestao2.precoSugerido, 65.0);

  // Caso 3: Cria um pedido CANCELADO posterior com preço R$ 75.00 -> DEVE IGNORAR O CANCELADO
  const pedidoCancelado = await prisma.pedido.create({
    data: {
      numero: "TEST-CANCELLED-02",
      numeroSequencial: 99902,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      status: "CANCELADO",
      justificativaCancelamento: "Erro na negociação",
      dataCancelamento: new Date(),
      totalEstimado: 750.0,
      itens: {
        create: {
          produtoId: produto.id,
          produtoCodigoSnapshot: produto.codigo,
          produtoNomeSnapshot: produto.nome,
          produtoUnidadeSnapshot: produto.unidade,
          quantidade: 10,
          precoUnitario: 75.0,
          subtotal: 750.0,
        },
      },
    },
  });

  // A sugestão AINDA deve ser R$ 65.00 (do confirmado), ignorando o cancelado
  const sugestao3 = await getPriceSuggestion({
    clienteId: cliente.id,
    frigorificoId: frigorifico.id,
    produtoId: produto.id,
  });
  assert.equal(sugestao3.origem, "HISTORICO");
  assert.equal(sugestao3.precoSugerido, 65.0);

  // Caso 4: Cria um RASCUNHO com preço R$ 80.00 -> DEVE IGNORAR O RASCUNHO
  const pedidoRascunho = await prisma.pedido.create({
    data: {
      numero: "TEST-DRAFT-03",
      numeroSequencial: 99903,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      status: "RASCUNHO",
      totalEstimado: 800.0,
      itens: {
        create: {
          produtoId: produto.id,
          produtoCodigoSnapshot: produto.codigo,
          produtoNomeSnapshot: produto.nome,
          produtoUnidadeSnapshot: produto.unidade,
          quantidade: 10,
          precoUnitario: 80.0,
          subtotal: 800.0,
        },
      },
    },
  });

  const sugestao4 = await getPriceSuggestion({
    clienteId: cliente.id,
    frigorificoId: frigorifico.id,
    produtoId: produto.id,
  });
  assert.equal(sugestao4.origem, "HISTORICO");
  assert.equal(sugestao4.precoSugerido, 65.0);

  // Limpeza dos dados de teste
  await prisma.pedidoItem.deleteMany({
    where: {
      pedidoId: { in: [pedidoConfirmado.id, pedidoCancelado.id, pedidoRascunho.id] },
    },
  });
  await prisma.pedido.deleteMany({
    where: {
      id: { in: [pedidoConfirmado.id, pedidoCancelado.id, pedidoRascunho.id] },
    },
  });

  await prisma.$disconnect();
});

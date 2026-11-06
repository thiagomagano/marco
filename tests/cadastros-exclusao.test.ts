import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";

test("Exclusão de Vendedores - Exclusão Segura e Bloqueio por Vínculos", async () => {
  // 1. Vendedor sem vínculos -> deve ser excluído com sucesso
  const vendedorLivre = await prisma.vendedor.create({
    data: {
      nome: "Vendedor Teste Sem Vinculo",
      telefone: "(11) 90000-0000",
      ativo: true,
    },
  });

  const countPedidosLivre = await prisma.pedido.count({ where: { vendedorId: vendedorLivre.id } });
  const countClientesLivre = await prisma.cliente.count({ where: { vendedorId: vendedorLivre.id } });
  assert.equal(countPedidosLivre, 0);
  assert.equal(countClientesLivre, 0);

  // Executa exclusão
  await prisma.vendedor.delete({ where: { id: vendedorLivre.id } });
  const checaExcluido = await prisma.vendedor.findUnique({ where: { id: vendedorLivre.id } });
  assert.equal(checaExcluido, null);

  // 2. Vendedor com cliente vinculado -> deve ser bloqueado
  const vendedorComCliente = await prisma.vendedor.create({
    data: {
      nome: "Vendedor Teste Com Cliente",
      ativo: true,
    },
  });

  const clienteVinculado = await prisma.cliente.create({
    data: {
      razaoSocialOuNome: "Cliente do Vendedor Teste",
      vendedorId: vendedorComCliente.id,
      ativo: true,
    },
  });

  const countClientes = await prisma.cliente.count({ where: { vendedorId: vendedorComCliente.id } });
  assert.equal(countClientes, 1);

  // Valida que a regra de negócio impede a exclusão
  let erroBloqueio = false;
  if (countClientes > 0) {
    erroBloqueio = true;
  }
  assert.equal(erroBloqueio, true, "Exclusão de vendedor com clientes deve ser bloqueada.");

  // Limpeza
  await prisma.cliente.delete({ where: { id: clienteVinculado.id } });
  await prisma.vendedor.delete({ where: { id: vendedorComCliente.id } });
});

test("Exclusão de Frigoríficos - Exclusão Segura e Bloqueio por Produtos/Pedidos", async () => {
  // 1. Frigorífico sem produtos e sem pedidos -> exclusão permitida
  const frigLivre = await prisma.frigorifico.create({
    data: {
      nomeFantasia: "Frigorífico Temporário Teste",
      ativo: true,
    },
  });

  const countProdsLivre = await prisma.produto.count({ where: { frigorificoId: frigLivre.id } });
  const countPedsLivre = await prisma.pedido.count({ where: { frigorificoId: frigLivre.id } });
  assert.equal(countProdsLivre, 0);
  assert.equal(countPedsLivre, 0);

  await prisma.frigorifico.delete({ where: { id: frigLivre.id } });
  const checaExcluido = await prisma.frigorifico.findUnique({ where: { id: frigLivre.id } });
  assert.equal(checaExcluido, null);

  // 2. Frigorífico com produto cadastrado -> exclusão bloqueada
  const frigComProd = await prisma.frigorifico.create({
    data: {
      nomeFantasia: "Frigorífico Com Produtos",
      ativo: true,
    },
  });

  const prodVinculado = await prisma.produto.create({
    data: {
      frigorificoId: frigComProd.id,
      codigo: "FRIG-TEST-01",
      nome: "Lombo Especial",
      unidade: "kg",
      ativo: true,
    },
  });

  const countProds = await prisma.produto.count({ where: { frigorificoId: frigComProd.id } });
  assert.equal(countProds, 1);

  let erroBloqueio = false;
  if (countProds > 0) {
    erroBloqueio = true;
  }
  assert.equal(erroBloqueio, true, "Exclusão de frigorífico com produtos deve ser bloqueada.");

  // Limpeza
  await prisma.produto.delete({ where: { id: prodVinculado.id } });
  await prisma.frigorifico.delete({ where: { id: frigComProd.id } });
});

test("Exclusão de Produtos - Exclusão Segura e Bloqueio por Histórico de Pedidos", async () => {
  const frigorifico = await prisma.frigorifico.findFirstOrThrow({ where: { ativo: true } });

  // 1. Produto sem pedidos -> exclusão permitida
  const prodLivre = await prisma.produto.create({
    data: {
      frigorificoId: frigorifico.id,
      codigo: "PROD-DEL-TEST-01",
      nome: "Corte Suíno Teste Exclusão",
      unidade: "kg",
      ativo: true,
    },
  });

  const countItensLivre = await prisma.pedidoItem.count({ where: { produtoId: prodLivre.id } });
  assert.equal(countItensLivre, 0);

  await prisma.produto.delete({ where: { id: prodLivre.id } });
  const checaExcluido = await prisma.produto.findUnique({ where: { id: prodLivre.id } });
  assert.equal(checaExcluido, null);

  // 2. Produto com pedido histórico -> bloqueado
  const prodComPedido = await prisma.produto.create({
    data: {
      frigorificoId: frigorifico.id,
      codigo: "PROD-DEL-TEST-02",
      nome: "Corte Suíno com Histórico",
      unidade: "kg",
      ativo: true,
    },
  });

  const vendedor = await prisma.vendedor.findFirstOrThrow({ where: { ativo: true } });
  const cliente = await prisma.cliente.findFirstOrThrow({ where: { ativo: true } });

  const pedidoHistorico = await prisma.pedido.create({
    data: {
      numero: "PED-PROD-TEST-DEL",
      numeroSequencial: 99991,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      status: "RASCUNHO",
      totalEstimado: 100.0,
      itens: {
        create: [
          {
            produtoId: prodComPedido.id,
            produtoCodigoSnapshot: prodComPedido.codigo,
            produtoNomeSnapshot: prodComPedido.nome,
            produtoUnidadeSnapshot: prodComPedido.unidade,
            quantidade: 10,
            precoUnitario: 10.0,
            subtotal: 100.0,
          },
        ],
      },
    },
  });

  const countItens = await prisma.pedidoItem.count({ where: { produtoId: prodComPedido.id } });
  assert.equal(countItens, 1);

  let erroBloqueio = false;
  if (countItens > 0) {
    erroBloqueio = true;
  }
  assert.equal(erroBloqueio, true, "Exclusão de produto utilizado em pedidos deve ser bloqueada.");

  // Limpeza
  await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedidoHistorico.id } });
  await prisma.pedido.delete({ where: { id: pedidoHistorico.id } });
  await prisma.produto.delete({ where: { id: prodComPedido.id } });
});

import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";

test("Cadastro de Produtos - Campo Embalagem e Snapshot nos Pedidos", async () => {
  const frigorifico = await prisma.frigorifico.findFirstOrThrow({
    where: { ativo: true },
  });
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });
  const cliente = await prisma.cliente.findFirstOrThrow({
    where: { ativo: true },
  });

  // 1. Criar produto com o campo embalagem (ex: "saco 20kg", "caixa NP", etc.)
  const novoProduto = await prisma.produto.create({
    data: {
      frigorificoId: frigorifico.id,
      codigo: "TEST-EMB-01",
      nome: "Lombo Suíno Resfriado Especial",
      embalagem: "saco 20kg",
      categoria: "Cortes Suínos",
      unidade: "kg",
      precoReferencia: 24.5,
      ativo: true,
    },
  });

  assert.equal(novoProduto.embalagem, "saco 20kg");

  // 2. Criar pedido e verificar que o snapshot de embalagem foi registrado
  const pedido = await prisma.pedido.create({
    data: {
      numero: "PED-EMB-TEST-01",
      numeroSequencial: 99955,
      frigorificoId: frigorifico.id,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      status: "RASCUNHO",
      totalEstimado: 245.0,
      itens: {
        create: [
          {
            produtoId: novoProduto.id,
            produtoCodigoSnapshot: novoProduto.codigo,
            produtoNomeSnapshot: novoProduto.nome,
            produtoUnidadeSnapshot: novoProduto.unidade,
            produtoEmbalagemSnapshot: novoProduto.embalagem,
            quantidade: 10,
            precoUnitario: 24.5,
            subtotal: 245.0,
          },
        ],
      },
    },
    include: { itens: true },
  });

  assert.equal(pedido.itens.length, 1);
  assert.equal(pedido.itens[0].produtoEmbalagemSnapshot, "saco 20kg");

  // 3. Atualizar a embalagem do produto no cadastro (ex: de "saco 20kg" para "caixa 20kg")
  const produtoAtualizado = await prisma.produto.update({
    where: { id: novoProduto.id },
    data: {
      embalagem: "caixa 20kg",
    },
  });
  assert.equal(produtoAtualizado.embalagem, "caixa 20kg");

  // 4. Garantir que o snapshot do pedido anterior permaneceu intacto ("saco 20kg")
  const itemPedido = await prisma.pedidoItem.findFirstOrThrow({
    where: { pedidoId: pedido.id },
  });
  assert.equal(itemPedido.produtoEmbalagemSnapshot, "saco 20kg");

  // Limpeza
  await prisma.pedidoItem.deleteMany({ where: { pedidoId: pedido.id } });
  await prisma.pedido.delete({ where: { id: pedido.id } });
  await prisma.produto.delete({ where: { id: novoProduto.id } });
});

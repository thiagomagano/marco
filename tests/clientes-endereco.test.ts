import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";

test("Cadastro de Clientes - Endereço Estruturado com Cidade, Bairro e CEP", async () => {
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });

  // 1. Criação de cliente com os novos campos de endereço
  const novoCliente = await prisma.cliente.create({
    data: {
      razaoSocialOuNome: "Armazém e Distribuidora Teste Ltda",
      nomeFantasia: "Armazém Teste",
      vendedorId: vendedor.id,
      endereco: "Av. Anhanguera, 4500, Quadra 12, Lote 3",
      bairro: "Setor Central",
      cidade: "Goiânia - GO",
      cep: "74000-010",
      ativo: true,
    },
  });

  assert.equal(novoCliente.bairro, "Setor Central");
  assert.equal(novoCliente.cidade, "Goiânia - GO");
  assert.equal(novoCliente.cep, "74000-010");
  assert.equal(novoCliente.endereco, "Av. Anhanguera, 4500, Quadra 12, Lote 3");

  // 2. Consulta com filtro por Cidade e Bairro
  const buscaPorCidade = await prisma.cliente.findMany({
    where: {
      cidade: { contains: "Goiânia" },
    },
  });
  assert(buscaPorCidade.some((c) => c.id === novoCliente.id));

  const buscaPorBairro = await prisma.cliente.findMany({
    where: {
      bairro: { contains: "Setor Central" },
    },
  });
  assert(buscaPorBairro.some((c) => c.id === novoCliente.id));

  // 3. Atualização dos campos de endereço
  const clienteAtualizado = await prisma.cliente.update({
    where: { id: novoCliente.id },
    data: {
      bairro: "Setor Sul",
      cidade: "Aparecida de Goiânia - GO",
      cep: "74900-000",
    },
  });

  assert.equal(clienteAtualizado.bairro, "Setor Sul");
  assert.equal(clienteAtualizado.cidade, "Aparecida de Goiânia - GO");
  assert.equal(clienteAtualizado.cep, "74900-000");

  // Limpeza
  await prisma.cliente.delete({ where: { id: novoCliente.id } });
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import { prisma } from "../src/lib/db.ts";
import { desativarClientesSemPedidos } from "../src/lib/cliente-manutencao.ts";
import { importarClientes } from "../src/scripts/import-excel.ts";

test("desativarClientesSemPedidos desativa apenas clientes sem pedidos (mantendo quem tem qualquer pedido)", async () => {
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });
  const frigorifico = await prisma.frigorifico.findFirstOrThrow({
    where: { ativo: true },
  });

  const stamp = Date.now();
  const idsClientes: string[] = [];
  const idsPedidos: string[] = [];

  try {
    const cliSemPedidoAtivo = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `TST_INAT_SEM_PEDIDO_${stamp}`,
        vendedorId: vendedor.id,
        ativo: true,
      },
    });
    idsClientes.push(cliSemPedidoAtivo.id);

    const cliComPedidoConfirmado = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `TST_INAT_COM_CONFIRMADO_${stamp}`,
        vendedorId: vendedor.id,
        ativo: true,
      },
    });
    idsClientes.push(cliComPedidoConfirmado.id);

    const cliComPedidoCancelado = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `TST_INAT_COM_CANCELADO_${stamp}`,
        vendedorId: vendedor.id,
        ativo: true,
      },
    });
    idsClientes.push(cliComPedidoCancelado.id);

    const cliJaInativoSemPedido = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `TST_INAT_JA_INATIVO_${stamp}`,
        vendedorId: vendedor.id,
        ativo: false,
      },
    });
    idsClientes.push(cliJaInativoSemPedido.id);

    const maxSeqAgg = await prisma.pedido.aggregate({
      _max: { numeroSequencial: true },
    });
    const baseSeq = (maxSeqAgg._max.numeroSequencial ?? 90000) + 1000;

    const pedConfirmado = await prisma.pedido.create({
      data: {
        numero: `TST-INAT-1-${stamp}`,
        numeroSequencial: baseSeq + 1,
        frigorificoId: frigorifico.id,
        clienteId: cliComPedidoConfirmado.id,
        vendedorId: vendedor.id,
        status: "CONFIRMADO",
        totalEstimado: 100,
      },
    });
    idsPedidos.push(pedConfirmado.id);

    const pedCancelado = await prisma.pedido.create({
      data: {
        numero: `TST-INAT-2-${stamp}`,
        numeroSequencial: baseSeq + 2,
        frigorificoId: frigorifico.id,
        clienteId: cliComPedidoCancelado.id,
        vendedorId: vendedor.id,
        status: "CANCELADO",
        justificativaCancelamento: "Cancelamento de teste",
        totalEstimado: 50,
      },
    });
    idsPedidos.push(pedCancelado.id);

    const whereExtra = { id: { in: idsClientes } };

    // 1. Dry-run não altera o banco
    const dryRes = await desativarClientesSemPedidos({
      dryRun: true,
      whereExtra,
    });
    assert.equal(dryRes.dryRun, true);
    assert.equal(dryRes.totalClientes, 4);
    assert.equal(dryRes.ativosComPedidos, 2);
    assert.equal(dryRes.jaInativosSemPedidos, 1);
    assert.equal(dryRes.paraDesativar, 1);
    assert.equal(dryRes.desativados, 0);

    const aindaAtivo = await prisma.cliente.findUniqueOrThrow({
      where: { id: cliSemPedidoAtivo.id },
    });
    assert.equal(aindaAtivo.ativo, true);

    // 2. Execução real desativa apenas o cliente ativo sem pedidos
    const realRes = await desativarClientesSemPedidos({
      dryRun: false,
      whereExtra,
    });
    assert.equal(realRes.dryRun, false);
    assert.equal(realRes.paraDesativar, 1);
    assert.equal(realRes.desativados, 1);

    const estados = await prisma.cliente.findMany({
      where: { id: { in: idsClientes } },
      select: { id: true, ativo: true },
    });
    const mapa = new Map(estados.map((c) => [c.id, c.ativo]));

    assert.equal(mapa.get(cliSemPedidoAtivo.id), false);
    assert.equal(mapa.get(cliComPedidoConfirmado.id), true);
    assert.equal(mapa.get(cliComPedidoCancelado.id), true);
    assert.equal(mapa.get(cliJaInativoSemPedido.id), false);
  } finally {
    if (idsPedidos.length > 0) {
      await prisma.pedido.deleteMany({ where: { id: { in: idsPedidos } } });
    }
    if (idsClientes.length > 0) {
      await prisma.cliente.deleteMany({ where: { id: { in: idsClientes } } });
    }
  }
});

test("importarClientes cria novos clientes inativos por padrão e preserva status na atualização", async () => {
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });

  const stamp = Date.now();
  const nomeComCnpj = `TST_IMP_CNPJ_${stamp}`;
  const nomeSemCnpj = `TST_IMP_SEM_CNPJ_${stamp}`;
  const cnpjTeste = "11.222.333/0001-81";
  const cnpjNorm = "11222333000181";

  // Garante que o CNPJ de teste não colida
  const conflito = await prisma.cliente.findUnique({
    where: { cnpjNormalized: cnpjNorm },
  });
  const cnpjUsar = conflito ? "11.444.777/0001-61" : cnpjTeste;
  const cnpjUsarNorm = conflito ? "11444777000161" : cnpjNorm;

  const tmpFile = path.join(os.tmpdir(), `clientes-import-test-${stamp}.xlsx`);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    {
      "Razão Social": nomeComCnpj,
      "Nome Fantasia": "Fantasia CNPJ",
      CNPJ: cnpjUsar,
      Vendedor: vendedor.nome,
      Cidade: "Goiânia - GO",
    },
    {
      "Razão Social": nomeSemCnpj,
      "Nome Fantasia": "Fantasia Sem CNPJ",
      CNPJ: "",
      Vendedor: vendedor.nome,
      Cidade: "Anápolis - GO",
    },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, tmpFile);

  const idsCriados: string[] = [];

  try {
    const stats1 = await importarClientes(tmpFile, false);
    assert.equal(stats1.erros, 0);
    assert.equal(stats1.inseridos, 2);

    const cli1 = await prisma.cliente.findUniqueOrThrow({
      where: { cnpjNormalized: cnpjUsarNorm },
    });
    const cli2 = await prisma.cliente.findFirstOrThrow({
      where: { razaoSocialOuNome: nomeSemCnpj },
    });
    idsCriados.push(cli1.id, cli2.id);

    // Novos clientes da planilha entram desativados por padrão
    assert.equal(cli1.ativo, false);
    assert.equal(cli2.ativo, false);

    // Operador ativa um deles manualmente
    await prisma.cliente.update({
      where: { id: cli1.id },
      data: { ativo: true },
    });

    // Reimportação atualiza dados sem derrubar o status ativo de quem já foi ativado
    const stats2 = await importarClientes(tmpFile, false);
    assert.equal(stats2.erros, 0);
    assert.equal(stats2.atualizados, 2);

    const cli1Pos = await prisma.cliente.findUniqueOrThrow({
      where: { id: cli1.id },
    });
    const cli2Pos = await prisma.cliente.findUniqueOrThrow({
      where: { id: cli2.id },
    });

    assert.equal(cli1Pos.ativo, true);
    assert.equal(cli2Pos.ativo, false);
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
    if (idsCriados.length > 0) {
      await prisma.cliente.deleteMany({ where: { id: { in: idsCriados } } });
    }
  }
});

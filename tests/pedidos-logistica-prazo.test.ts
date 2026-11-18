import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";
import {
  calcularDataEntregaPadrao,
  formatCalendarDateBr,
  getDefaultDatasPedido,
  getPeriodoPresetDates,
  parseCalendarDateToSaoPauloNoon,
  toYmdString,
} from "../src/lib/date-utils.ts";
import { buildPedidoDateFilter } from "../src/lib/pedido-filtros.ts";
import { parseAndValidatePedidoLogistica } from "../src/lib/pedido-detalhes.ts";
import { resolverPrazoBoletoPedido } from "../src/lib/prazo-pagamento.ts";

describe("Logística (Embarque / Entrega Prevista D+1) e Prazo de Boleto no Pedido", () => {
  it("deve calcular D+1 corretamente em viradas de mês, ano e ano bissexto", () => {
    assert.equal(calcularDataEntregaPadrao("2026-11-18"), "2026-11-19");
    assert.equal(calcularDataEntregaPadrao("2026-11-30"), "2026-12-01");
    assert.equal(calcularDataEntregaPadrao("2026-12-31"), "2027-01-01");
    assert.equal(calcularDataEntregaPadrao("2024-02-28"), "2024-02-29");
    assert.equal(calcularDataEntregaPadrao("2025-02-28"), "2025-03-01");
    assert.equal(calcularDataEntregaPadrao("data-invalida"), "");
  });

  it("deve gerar datas padrão Hoje/Amanhã e preservar data calendário sem desvio de fuso horário", () => {
    // 2026-11-18 às 22:30 BRT = 2026-11-19T01:30:00.000Z
    const noiteBrt = new Date("2026-11-19T01:30:00.000Z");
    const defaults = getDefaultDatasPedido(noiteBrt);
    assert.equal(defaults.dataEmbarque, "2026-11-18");
    assert.equal(defaults.dataEntregaPrevista, "2026-11-19");

    const amanha = getPeriodoPresetDates("AMANHA", noiteBrt);
    assert.equal(amanha.inicioStr, "2026-11-19");
    assert.equal(amanha.fimStr, "2026-11-19");

    const armazenada = parseCalendarDateToSaoPauloNoon("2026-11-20");
    assert.ok(armazenada);
    assert.equal(toYmdString(armazenada), "2026-11-20");
    assert.equal(formatCalendarDateBr(armazenada), "20/11/2026");
  });

  it("deve validar obrigatoriedade em CONFIRMADO, consistência entrega >= embarque e fallback D+1", () => {
    // RASCUNHO aceita datas vazias
    const rascunhoSemDatas = parseAndValidatePedidoLogistica({
      status: "RASCUNHO",
      dataEmbarque: null,
      dataEntregaPrevista: null,
      fallbackPrazoCliente: "14 dias",
    });
    assert.equal(rascunhoSemDatas.valid, true);
    if (rascunhoSemDatas.valid) {
      assert.equal(rascunhoSemDatas.dataEmbarque, null);
      assert.equal(rascunhoSemDatas.dataEntregaPrevista, null);
      assert.equal(rascunhoSemDatas.prazoPagamentoBoleto, "14 dias");
    }

    // CONFIRMADO exige embarque e entrega
    const confirmadoSemEmbarque = parseAndValidatePedidoLogistica({
      status: "CONFIRMADO",
      dataEmbarque: "",
      dataEntregaPrevista: "2026-11-19",
    });
    assert.equal(confirmadoSemEmbarque.valid, false);

    const confirmadoSemEntrega = parseAndValidatePedidoLogistica({
      status: "CONFIRMADO",
      dataEmbarque: "2026-11-18",
      dataEntregaPrevista: "",
    });
    assert.equal(confirmadoSemEntrega.valid, false);

    // Entrega anterior ao embarque deve ser bloqueada mesmo em rascunho
    const entregaAnterior = parseAndValidatePedidoLogistica({
      status: "RASCUNHO",
      dataEmbarque: "2026-11-20",
      dataEntregaPrevista: "2026-11-19",
    });
    assert.equal(entregaAnterior.valid, false);
    if (!entregaAnterior.valid) {
      assert.match(entregaAnterior.error, /não pode ser anterior/i);
    }

    // Quando embarque é enviado na criação sem dataEntregaPrevista (undefined), aplica D+1
    const autoD1 = parseAndValidatePedidoLogistica({
      status: "CONFIRMADO",
      dataEmbarque: "2026-11-18",
      prazoPagamentoBoleto: "7/14/21",
    });
    assert.equal(autoD1.valid, true);
    if (autoD1.valid) {
      assert.equal(autoD1.dataEmbarqueYmd, "2026-11-18");
      assert.equal(autoD1.dataEntregaPrevistaYmd, "2026-11-19");
      assert.equal(autoD1.prazoPagamentoBoleto, "7/14/21 dias");
    }
  });

  it("deve resolver o prazo efetivo priorizando o pedido com fallback no cliente", () => {
    assert.equal(resolverPrazoBoletoPedido("28 dias", "14 dias"), "28 dias");
    assert.equal(resolverPrazoBoletoPedido(null, "14 dias"), "14 dias");
    assert.equal(resolverPrazoBoletoPedido("  ", "7/14/21 dias"), "7/14/21 dias");
    assert.equal(resolverPrazoBoletoPedido(null, null), null);
  });

  it("deve construir cláusula Prisma correta para tipoData EMBARQUE e ENTREGA", () => {
    const filtroEmb = buildPedidoDateFilter({
      tipoData: "EMBARQUE",
      dataInicio: "2026-11-18",
      dataFim: "2026-11-19",
    }) as { dataEmbarque?: { gte: Date; lte: Date } };
    assert.ok(filtroEmb.dataEmbarque);
    assert.equal(
      filtroEmb.dataEmbarque.gte.toISOString(),
      "2026-11-18T03:00:00.000Z"
    );
    assert.equal(
      filtroEmb.dataEmbarque.lte.toISOString(),
      "2026-11-20T02:59:59.999Z"
    );

    const filtroEnt = buildPedidoDateFilter({
      tipoData: "ENTREGA",
      dataInicio: "2026-11-20",
      dataFim: "2026-11-20",
    }) as { dataEntregaPrevista?: { gte: Date; lte: Date } };
    assert.ok(filtroEnt.dataEntregaPrevista);
    assert.equal(
      filtroEnt.dataEntregaPrevista.gte.toISOString(),
      "2026-11-20T03:00:00.000Z"
    );
  });

  it("deve persistir datas e prazo customizado no pedido sem alterar o cadastro do cliente", async () => {
    const frigorifico = await prisma.frigorifico.create({
      data: {
        nomeFantasia: `Frigorifico Teste Logistica ${Date.now()}`,
        ativo: false,
      },
    });
    const vendedor = await prisma.vendedor.create({
      data: {
        nome: `Vendedor Teste Logistica ${Date.now()}`,
        ativo: false,
      },
    });
    const cliente = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: "Cliente Teste Logistica Ltda",
        prazoPagamentoBoleto: "14 dias",
        buscaTexto: "cliente teste logistica ltda 14 dias",
        ativo: false,
        vendedorId: vendedor.id,
      },
    });

    const pedido = await prisma.pedido.create({
      data: {
        numero: `TEST-LOG-${Date.now()}`,
        numeroSequencial: 99950 + Math.floor(Math.random() * 40),
        frigorificoId: frigorifico.id,
        clienteId: cliente.id,
        vendedorId: vendedor.id,
        status: "CONFIRMADO",
        dataEmbarque: parseCalendarDateToSaoPauloNoon("2026-11-25"),
        dataEntregaPrevista: parseCalendarDateToSaoPauloNoon("2026-11-26"),
        prazoPagamentoBoleto: "28 dias",
        totalEstimado: 100,
        dataConfirmacao: new Date(),
      },
    });

    try {
      const clienteApos = await prisma.cliente.findUniqueOrThrow({
        where: { id: cliente.id },
      });
      assert.equal(clienteApos.prazoPagamentoBoleto, "14 dias");
      assert.equal(pedido.prazoPagamentoBoleto, "28 dias");
      assert.equal(toYmdString(pedido.dataEmbarque), "2026-11-25");
      assert.equal(toYmdString(pedido.dataEntregaPrevista), "2026-11-26");

      const encontrados = await prisma.pedido.findMany({
        where: {
          id: pedido.id,
          ...buildPedidoDateFilter({
            tipoData: "EMBARQUE",
            dataInicio: "2026-11-25",
            dataFim: "2026-11-25",
          }),
        },
      });
      assert.equal(encontrados.length, 1);
    } finally {
      await prisma.pedido.delete({ where: { id: pedido.id } });
      await prisma.cliente.delete({ where: { id: cliente.id } });
      await prisma.vendedor.delete({ where: { id: vendedor.id } });
      await prisma.frigorifico.delete({ where: { id: frigorifico.id } });
    }
  });
});

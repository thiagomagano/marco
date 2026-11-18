import test from "node:test";
import assert from "node:assert/strict";
import {
  getSaoPauloDateString,
  parseSaoPauloDateStart,
  parseSaoPauloDateEnd,
  getPeriodoPresetDates,
  shiftDateString,
  formatYmdBr,
  formatYmdShortBr,
  isValidYmd,
} from "../src/lib/date-utils.ts";
import {
  buildPedidoDateFilter,
  calcularResumoPedidos,
  getPedidoDataReferenciaMs,
} from "../src/lib/pedido-filtros.ts";

test("Fuso horário America/Sao_Paulo - virada após 21h BRT / 00h UTC", () => {
  // 2026-11-18 às 22:30 BRT = 2026-11-19T01:30:00.000Z
  const noiteBrt = new Date("2026-11-19T01:30:00.000Z");
  assert.equal(getSaoPauloDateString(noiteBrt), "2026-11-18");

  // 2026-11-19 às 00:00 BRT = 2026-11-19T03:00:00.000Z
  const meiaNoiteBrt = new Date("2026-11-19T03:00:00.000Z");
  assert.equal(getSaoPauloDateString(meiaNoiteBrt), "2026-11-19");

  const inicio = parseSaoPauloDateStart("2026-11-18");
  const fim = parseSaoPauloDateEnd("2026-11-18");
  assert.equal(inicio?.toISOString(), "2026-11-18T03:00:00.000Z");
  assert.equal(fim?.toISOString(), "2026-11-19T02:59:59.999Z");
});

test("Presets de período - Hoje, Ontem, Semana (início na segunda) e Mês", () => {
  // Quarta-feira 18/11/2026 às 14h BRT
  const quarta = new Date("2026-11-18T17:00:00.000Z");

  const hoje = getPeriodoPresetDates("HOJE", quarta);
  assert.equal(hoje.inicioStr, "2026-11-18");
  assert.equal(hoje.fimStr, "2026-11-18");

  const ontem = getPeriodoPresetDates("ONTEM", quarta);
  assert.equal(ontem.inicioStr, "2026-11-17");
  assert.equal(ontem.fimStr, "2026-11-17");

  const semanaQuarta = getPeriodoPresetDates("SEMANA", quarta);
  assert.equal(semanaQuarta.inicioStr, "2026-11-16"); // Segunda-feira
  assert.equal(semanaQuarta.fimStr, "2026-11-18");

  // Domingo 22/11/2026 às 10h BRT -> segunda da semana ainda é 16/11
  const domingo = new Date("2026-11-22T13:00:00.000Z");
  const semanaDomingo = getPeriodoPresetDates("SEMANA", domingo);
  assert.equal(semanaDomingo.inicioStr, "2026-11-16");
  assert.equal(semanaDomingo.fimStr, "2026-11-22");

  // Segunda-feira 16/11/2026 -> início e fim são 16/11
  const segunda = new Date("2026-11-16T13:00:00.000Z");
  const semanaSegunda = getPeriodoPresetDates("SEMANA", segunda);
  assert.equal(semanaSegunda.inicioStr, "2026-11-16");
  assert.equal(semanaSegunda.fimStr, "2026-11-16");

  const mes = getPeriodoPresetDates("MES", quarta);
  assert.equal(mes.inicioStr, "2026-11-01");
  assert.equal(mes.fimStr, "2026-11-18");
});

test("Validação e formatação de datas YYYY-MM-DD", () => {
  assert.equal(isValidYmd("2026-11-18"), true);
  assert.equal(isValidYmd("2026-02-30"), false);
  assert.equal(isValidYmd(""), false);
  assert.equal(shiftDateString("2026-11-01", -1), "2026-10-31");
  assert.equal(formatYmdBr("2026-11-18"), "18/11/2026");
  assert.equal(formatYmdShortBr("2026-11-18"), "18/11");
});

test("buildPedidoDateFilter - aplica dataConfirmacao para confirmados e dataCriacao para rascunhos/cancelados", () => {
  const filtroVazio = buildPedidoDateFilter({ status: "TODOS" });
  assert.deepEqual(filtroVazio, {});

  const filtroConfirmado = buildPedidoDateFilter({
    status: "CONFIRMADO",
    dataInicio: "2026-11-18",
    dataFim: "2026-11-18",
  }) as { dataConfirmacao?: { gte: Date; lte: Date } };
  assert.equal(
    filtroConfirmado.dataConfirmacao?.gte.toISOString(),
    "2026-11-18T03:00:00.000Z"
  );
  assert.equal(
    filtroConfirmado.dataConfirmacao?.lte.toISOString(),
    "2026-11-19T02:59:59.999Z"
  );

  const filtroRascunho = buildPedidoDateFilter({
    status: "RASCUNHO",
    dataInicio: "2026-11-18",
    dataFim: "2026-11-18",
  }) as { dataCriacao?: { gte: Date; lte: Date } };
  assert.ok(filtroRascunho.dataCriacao);

  const filtroTodos = buildPedidoDateFilter({
    status: "TODOS",
    dataInicio: "2026-11-18",
    dataFim: "2026-11-18",
  }) as { OR?: Array<Record<string, unknown>> };
  assert.equal(filtroTodos.OR?.length, 2);
});

test("calcularResumoPedidos e getPedidoDataReferenciaMs", () => {
  const resumo = calcularResumoPedidos([
    { status: "CONFIRMADO", totalEstimado: 1500.5, pesoInformadoKg: 100.25 },
    { status: "CONFIRMADO", totalEstimado: 499.5, pesoInformadoKg: 50.125 },
    { status: "RASCUNHO", totalEstimado: 900, pesoInformadoKg: 80 },
    { status: "CANCELADO", totalEstimado: 300, pesoInformadoKg: 20 },
  ]);

  assert.equal(resumo.totalVendasConfirmadas, 2000);
  assert.equal(resumo.totalPesoKgConfirmado, 150.375);
  assert.equal(resumo.qtdTotal, 4);
  assert.equal(resumo.qtdConfirmados, 2);
  assert.equal(resumo.qtdRascunhos, 1);
  assert.equal(resumo.qtdCancelados, 1);

  const rascunhoConfirmadoHoje = {
    status: "CONFIRMADO",
    dataCriacao: "2026-11-17T15:00:00.000Z",
    dataConfirmacao: "2026-11-18T14:00:00.000Z",
  };
  const rascunhoDeHoje = {
    status: "RASCUNHO",
    dataCriacao: "2026-11-18T13:00:00.000Z",
    dataConfirmacao: null,
  };
  assert.ok(
    getPedidoDataReferenciaMs(rascunhoConfirmadoHoje) >
      getPedidoDataReferenciaMs(rascunhoDeHoje)
  );
});

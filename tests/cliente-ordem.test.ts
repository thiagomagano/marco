import test from "node:test";
import assert from "node:assert/strict";
import {
  ordenarClientes,
  parseClienteOrdenacao,
  type ClienteParaOrdenacao,
} from "../src/lib/cliente-ordem.ts";

const amostra: ClienteParaOrdenacao[] = [
  {
    id: "inativo-2-pedidos",
    ativo: false,
    razaoSocialOuNome: "Açougue Alpha",
    totalPedidos: 2,
    totalValorComprado: 9000,
    totalPesoKg: 500,
  },
  {
    id: "ativo-2-pedidos-menor-valor",
    ativo: true,
    razaoSocialOuNome: "Casa de Carnes Beta",
    totalPedidos: 2,
    totalValorComprado: 3000,
    totalPesoKg: 250,
  },
  {
    id: "ativo-2-pedidos-maior-valor",
    ativo: true,
    razaoSocialOuNome: "Distribuidora Gama",
    totalPedidos: 2,
    totalValorComprado: 7500,
    totalPesoKg: 180,
  },
  {
    id: "ativo-5-pedidos",
    ativo: true,
    razaoSocialOuNome: "Supermercado Delta",
    totalPedidos: 5,
    totalValorComprado: 6000,
    totalPesoKg: 200,
  },
  {
    id: "inativo-0-pedidos",
    ativo: false,
    razaoSocialOuNome: "Abatedouro Zeta",
    totalPedidos: 0,
    totalValorComprado: 0,
    totalPesoKg: 0,
  },
  {
    id: "ativo-0-pedidos",
    ativo: true,
    razaoSocialOuNome: "Mercado Épsilon",
    totalPedidos: 0,
    totalValorComprado: 0,
    totalPesoKg: 0,
  },
];

test("parseClienteOrdenacao retorna padrão mais_pedidos para valores inválidos", () => {
  assert.equal(parseClienteOrdenacao(undefined), "mais_pedidos");
  assert.equal(parseClienteOrdenacao(""), "mais_pedidos");
  assert.equal(parseClienteOrdenacao("desconhecido"), "mais_pedidos");
  assert.equal(parseClienteOrdenacao("maior_valor"), "maior_valor");
  assert.equal(parseClienteOrdenacao("MAIOR_QTD"), "maior_qtd");
});

test("Ordenação padrão (mais_pedidos): mais pedidos -> ativos -> maior valor/kg -> nome", () => {
  const ordenados = ordenarClientes(amostra);
  assert.deepEqual(
    ordenados.map((c) => c.id),
    [
      "ativo-5-pedidos",
      "ativo-2-pedidos-maior-valor",
      "ativo-2-pedidos-menor-valor",
      "inativo-2-pedidos",
      "ativo-0-pedidos",
      "inativo-0-pedidos",
    ]
  );
});

test("Ordenação por desempate de peso (kg) quando pedidos, ativo e valor empatam", () => {
  const empatados: ClienteParaOrdenacao[] = [
    {
      id: "menor-kg",
      ativo: true,
      razaoSocialOuNome: "A Primeiro",
      totalPedidos: 3,
      totalValorComprado: 5000,
      totalPesoKg: 100,
    },
    {
      id: "maior-kg",
      ativo: true,
      razaoSocialOuNome: "Z Último",
      totalPedidos: 3,
      totalValorComprado: 5000,
      totalPesoKg: 220,
    },
  ];
  const ordenados = ordenarClientes(empatados, "mais_pedidos");
  assert.deepEqual(
    ordenados.map((c) => c.id),
    ["maior-kg", "menor-kg"]
  );
});

test("Ordenação maior_valor e maior_qtd priorizam quem compra mais", () => {
  const porValor = ordenarClientes(amostra, "maior_valor");
  assert.equal(porValor[0].id, "inativo-2-pedidos");
  assert.equal(porValor[1].id, "ativo-2-pedidos-maior-valor");
  assert.equal(porValor[2].id, "ativo-5-pedidos");

  const porQtd = ordenarClientes(amostra, "maior_qtd");
  assert.equal(porQtd[0].id, "inativo-2-pedidos");
  assert.equal(porQtd[1].id, "ativo-2-pedidos-menor-valor");
  assert.equal(porQtd[2].id, "ativo-5-pedidos");
});

test("Ordenação ativos_primeiro e alfabetica", () => {
  const ativosPrimeiro = ordenarClientes(amostra, "ativos_primeiro");
  assert.deepEqual(
    ativosPrimeiro.map((c) => c.ativo),
    [true, true, true, true, false, false]
  );
  assert.equal(ativosPrimeiro[0].id, "ativo-5-pedidos");

  const alfabetica = ordenarClientes(amostra, "alfabetica");
  assert.deepEqual(
    alfabetica.map((c) => c.id),
    [
      "inativo-0-pedidos",
      "inativo-2-pedidos",
      "ativo-2-pedidos-menor-valor",
      "ativo-2-pedidos-maior-valor",
      "ativo-0-pedidos",
      "ativo-5-pedidos",
    ]
  );
});

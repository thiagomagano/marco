import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BRAND_LOGO_PATH, BRAND_NAME } from "../src/lib/brand.ts";
import { type PedidoShareData } from "../src/lib/pedido-share.ts";
import {
  compilarDadosResumoProducao,
  gerarTextoWhatsAppProducao,
  gerarHtmlImpressaoA4Producao,
  gerarNomeArquivoProducao,
} from "../src/lib/pacote-producao.ts";

describe("Resumo de Produtos para Produção / Separação", () => {
  const baseFrig = {
    nomeFantasia: "Frigorífico Valupi",
    cnpj: "12.345.678/0001-99",
    telefone: "(11) 4000-1234",
  };

  const baseCliente = {
    razaoSocialOuNome: "Supermercado Alfa Ltda",
    nomeFantasia: "Supermercado Alfa",
    cnpj: "11.222.333/0001-44",
    telefone: "(19) 98888-7777",
    endereco: "Rua das Flores, 100",
    bairro: "Centro",
    cidade: "Campinas - SP",
    cep: "13010-000",
  };

  const baseVendedor = {
    nome: "Carlos Vendedor",
    telefone: "(11) 97777-6666",
  };

  const pedidosMock: PedidoShareData[] = [
    {
      id: "ped-1",
      numero: "PED-2026-00001",
      status: "CONFIRMADO",
      observacoes: null,
      totalEstimado: 15000.0,
      pesoInformadoKg: 600.125,
      dataCriacao: "2026-11-17T09:00:00.000Z",
      dataConfirmacao: "2026-11-17T09:10:00.000Z",
      frigorifico: baseFrig,
      cliente: baseCliente,
      vendedor: baseVendedor,
      itens: [
        {
          id: "it-1",
          produtoCodigoSnapshot: "200",
          produtoNomeSnapshot: "Pernil Suíno",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 400.125,
          precoUnitario: 25.5,
          subtotal: 10203.19,
        },
        {
          id: "it-2",
          produtoCodigoSnapshot: "100",
          produtoNomeSnapshot: "Costela Suína",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 200,
          precoUnitario: 23.98,
          subtotal: 4796.0,
        },
        {
          id: "it-3",
          produtoCodigoSnapshot: "300",
          produtoNomeSnapshot: "Lombo Temperado",
          produtoUnidadeSnapshot: "caixa",
          produtoEmbalagemSnapshot: "caixa 15kg",
          quantidade: 5,
          precoUnitario: 320.0,
          subtotal: 1600.0,
        },
      ],
    },
    {
      id: "ped-2",
      numero: "PED-2026-00002",
      status: "CONFIRMADO",
      observacoes: null,
      totalEstimado: 22000.0,
      pesoInformadoKg: 1099.875,
      dataCriacao: "2026-11-17T10:00:00.000Z",
      dataConfirmacao: "2026-11-17T10:05:00.000Z",
      frigorifico: baseFrig,
      cliente: {
        ...baseCliente,
        nomeFantasia: "Açougue Beta",
      },
      vendedor: baseVendedor,
      itens: [
        // Mesmo produto (100) repetido 2x no mesmo pedido para validar contagem distinta de pedidos
        {
          id: "it-4",
          produtoCodigoSnapshot: "100",
          produtoNomeSnapshot: "Costela Suína",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 500.5,
          precoUnitario: 24.0,
          subtotal: 12012.0,
        },
        {
          id: "it-5",
          produtoCodigoSnapshot: "100",
          produtoNomeSnapshot: "Costela Suína",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 299.5,
          precoUnitario: 24.0,
          subtotal: 7188.0,
        },
        // Mesmo código (100) com embalagem diferente deve ficar separado
        {
          id: "it-6",
          produtoCodigoSnapshot: "100",
          produtoNomeSnapshot: "Costela Suína",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "saco 15kg",
          quantidade: 100,
          precoUnitario: 24.0,
          subtotal: 2400.0,
        },
        {
          id: "it-7",
          produtoCodigoSnapshot: "200",
          produtoNomeSnapshot: "Pernil Suíno",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 199.875,
          precoUnitario: 25.5,
          subtotal: 5096.81,
        },
        {
          id: "it-8",
          produtoCodigoSnapshot: "300",
          produtoNomeSnapshot: "Lombo Temperado",
          produtoUnidadeSnapshot: "caixa",
          produtoEmbalagemSnapshot: "caixa 15kg",
          quantidade: 10,
          precoUnitario: 320.0,
          subtotal: 3200.0,
        },
      ],
    },
  ];

  it("deve agrupar por código + embalagem + unidade, ordenar alfabeticamente, somar kg com precisão e contar pedidos distintos", () => {
    const resumo = compilarDadosResumoProducao(pedidosMock);

    assert.equal(resumo.frigorificoNome, "Frigorífico Valupi");
    assert.equal(resumo.totalPedidos, 2);
    assert.deepEqual(resumo.numerosPedidos, [
      "PED-2026-00001",
      "PED-2026-00002",
    ]);

    // 4 grupos: Costela [caixa 20kg], Costela [saco 15kg], Lombo [caixa 15kg], Pernil [caixa 20kg]
    assert.equal(resumo.itens.length, 4);

    // Ordem alfabética por nome e desempate por embalagem
    assert.equal(resumo.itens[0].nome, "Costela Suína");
    assert.equal(resumo.itens[0].embalagem, "caixa 20kg");
    assert.equal(resumo.itens[0].quantidadeTotal, 1000); // 200 + 500.5 + 299.5
    assert.equal(resumo.itens[0].qtdPedidosComItem, 2);

    assert.equal(resumo.itens[1].nome, "Costela Suína");
    assert.equal(resumo.itens[1].embalagem, "saco 15kg");
    assert.equal(resumo.itens[1].quantidadeTotal, 100);
    assert.equal(resumo.itens[1].qtdPedidosComItem, 1);

    assert.equal(resumo.itens[2].nome, "Lombo Temperado");
    assert.equal(resumo.itens[2].unidade, "caixa");
    assert.equal(resumo.itens[2].quantidadeTotal, 15); // 5 + 10
    assert.equal(resumo.itens[2].qtdPedidosComItem, 2);

    assert.equal(resumo.itens[3].nome, "Pernil Suíno");
    assert.equal(resumo.itens[3].quantidadeTotal, 600); // 400.125 + 199.875
    assert.equal(resumo.itens[3].qtdPedidosComItem, 2);

    // Peso total soma apenas itens em kg (1000 + 100 + 600 = 1700)
    assert.equal(resumo.totalPesoKg, 1700);
    assert.deepEqual(resumo.totaisOutrasUnidades, [
      { unidade: "caixa", quantidade: 15 },
    ]);
  });

  it("deve gerar texto WhatsApp sem valores financeiros, com contagem de pedidos por item e total de peso", () => {
    const resumo = compilarDadosResumoProducao(pedidosMock);
    const texto = gerarTextoWhatsAppProducao(resumo);

    assert(texto.includes("RESUMO DE PRODUÇÃO / SEPARAÇÃO"));
    assert(texto.includes("PED-2026-00001, PED-2026-00002"));
    assert(texto.includes("*Costela Suína* [caixa 20kg]: *1.000 kg* _(2 pedidos)_"));
    assert(texto.includes("*Costela Suína* [saco 15kg]: *100 kg* _(1 pedido)_"));
    assert(texto.includes("*Lombo Temperado* [caixa 15kg]: *15 caixa* _(2 pedidos)_"));
    assert(texto.includes("*Pernil Suíno* [caixa 20kg]: *600 kg* _(2 pedidos)_"));
    assert(texto.includes("Total de peso em 2 pedidos: 1.700 kg"));
    assert(texto.includes("Outras Unidades: *15 caixa*"));

    // Garantia de ausência de valores financeiros
    assert(!texto.includes("R$"));
    assert(!texto.includes("25,50"));
    assert(!texto.includes("15.000"));
  });

  it("deve gerar HTML A4 de produção sem valores financeiros e com cabeçalho timbrado", () => {
    const resumo = compilarDadosResumoProducao(pedidosMock);
    const html = gerarHtmlImpressaoA4Producao(resumo);

    assert(html.includes("Resumo de Produção"));
    assert(html.includes("PED-2026-00001, PED-2026-00002"));
    assert(html.includes("Costela Suína"));
    assert(html.includes("1.000 kg"));
    assert(html.includes("2 pedidos"));
    assert(html.includes("1 pedido"));
    assert(html.includes("Total de peso em 2 pedidos"));
    assert(html.includes("1.700 kg"));
    assert(html.includes(BRAND_NAME.toUpperCase()));
    assert(html.includes(BRAND_LOGO_PATH));

    assert(!html.includes("R$"));
    assert(!html.includes("Preço Unit."));
    assert(!html.includes("Subtotal"));
  });

  it("deve gerar nome de arquivo padronizado para resumo de produção", () => {
    const nomePdf = gerarNomeArquivoProducao("Frigorífico Valupi", "pdf");
    assert(nomePdf.startsWith("producao-frigorifico-valupi-"));
    assert(nomePdf.endsWith(".pdf"));

    const nomePng = gerarNomeArquivoProducao("Frigorífico Valupi", "png");
    assert(nomePng.startsWith("producao-frigorifico-valupi-"));
    assert(nomePng.endsWith(".png"));
  });

  it("deve bloquear pedidos em RASCUNHO, CANCELADO ou de frigoríficos diferentes", () => {
    assert.throws(
      () => compilarDadosResumoProducao([]),
      /Selecione pelo menos 1 pedido/i
    );

    assert.throws(
      () =>
        compilarDadosResumoProducao([
          pedidosMock[0],
          { ...pedidosMock[1], status: "RASCUNHO" },
        ]),
      /Apenas pedidos CONFIRMADOS/i
    );

    assert.throws(
      () =>
        compilarDadosResumoProducao([
          pedidosMock[0],
          {
            ...pedidosMock[1],
            frigorifico: {
              nomeFantasia: "Outro Frigorífico",
              cnpj: null,
              telefone: null,
            },
          },
        ]),
      /frigoríficos diferentes/i
    );
  });

  it("deve exibir datas de embarque dos pedidos no resumo de produção", () => {
    const resumo = compilarDadosResumoProducao([
      { ...pedidosMock[0], dataEmbarque: "2026-11-20T15:00:00.000Z" },
      { ...pedidosMock[1], dataEmbarque: "2026-11-21T15:00:00.000Z" },
    ]);

    assert.deepEqual(resumo.datasEmbarque, ["20/11/2026", "21/11/2026"]);
    const texto = gerarTextoWhatsAppProducao(resumo);
    const html = gerarHtmlImpressaoA4Producao(resumo);

    assert(texto.includes("20/11/2026, 21/11/2026"));
    assert(html.includes("Datas de Embarque:"));
    assert(html.includes("20/11/2026, 21/11/2026"));
  });
});

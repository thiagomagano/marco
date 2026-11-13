import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compilarDadosPacote,
  gerarTextoWhatsAppPacote,
  gerarHtmlImpressaoA4Pacote,
  gerarNomeArquivoPacote,
  type PedidoShareData,
} from "../src/lib/pedido-share.ts";

describe("Pacote e Agrupamento de Pedidos em Resumo Único", () => {
  const pedidosMock: PedidoShareData[] = [
    {
      id: "ped-1",
      numero: "PED-2026-00001",
      status: "CONFIRMADO",
      observacoes: "Entregar pela manhã.",
      totalEstimado: 2500.0,
      pesoInformadoKg: 120.0,
      dataCriacao: "2026-11-13T09:00:00.000Z",
      dataConfirmacao: "2026-11-13T09:30:00.000Z",
      frigorifico: {
        nomeFantasia: "Frigorífico Valupi",
        cnpj: "12.345.678/0001-99",
        telefone: "(11) 4000-1234",
      },
      cliente: {
        razaoSocialOuNome: "Supermercado Alfa Ltda",
        nomeFantasia: "Supermercado Alfa",
        cnpj: "11.222.333/0001-44",
        telefone: "(19) 98888-7777",
        endereco: "Rua das Flores, 100",
        bairro: "Centro",
        cidade: "Campinas - SP",
        cep: "13010-000",
      },
      vendedor: {
        nome: "Carlos Vendedor",
        telefone: "(11) 97777-6666",
      },
      itens: [
        {
          id: "it-1",
          produtoCodigoSnapshot: "101",
          produtoNomeSnapshot: "Costela Suína",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 100,
          precoUnitario: 20.0,
          subtotal: 2000.0,
        },
        {
          id: "it-2",
          produtoCodigoSnapshot: "102",
          produtoNomeSnapshot: "Lombo Temperado",
          produtoUnidadeSnapshot: "cx",
          produtoEmbalagemSnapshot: "saco 15kg",
          quantidade: 2,
          precoUnitario: 250.0,
          subtotal: 500.0,
        },
      ],
    },
    {
      id: "ped-2",
      numero: "PED-2026-00002",
      status: "CONFIRMADO",
      observacoes: null,
      totalEstimado: 1800.0,
      pesoInformadoKg: 80.5,
      dataCriacao: "2026-11-13T10:00:00.000Z",
      dataConfirmacao: "2026-11-13T10:15:00.000Z",
      frigorifico: {
        nomeFantasia: "Frigorífico Valupi",
        cnpj: "12.345.678/0001-99",
        telefone: "(11) 4000-1234",
      },
      cliente: {
        razaoSocialOuNome: "Açougue Estrela Eireli",
        nomeFantasia: "Açougue Estrela",
        cnpj: "22.333.444/0001-55",
        telefone: "(19) 97777-1111",
        endereco: "Av. Paulista, 200",
        bairro: "Jardim América",
        cidade: "Paulínia - SP",
        cep: "13140-000",
      },
      vendedor: {
        nome: "Carlos Vendedor",
        telefone: "(11) 97777-6666",
      },
      itens: [
        {
          id: "it-3",
          produtoCodigoSnapshot: "103",
          produtoNomeSnapshot: "Pernil Suíno Congelado",
          produtoUnidadeSnapshot: "kg",
          produtoEmbalagemSnapshot: "caixa 20kg",
          quantidade: 80.5,
          precoUnitario: 22.36,
          subtotal: 1800.0,
        },
      ],
    },
  ];

  it("deve compilar os dados consolidados do pacote com soma precisa de peso e valores", () => {
    const pacote = compilarDadosPacote(pedidosMock);

    assert.equal(pacote.frigorificoNome, "Frigorífico Valupi");
    assert.equal(pacote.pedidos.length, 2);
    assert.equal(pacote.totalGeralValor, 4300.0);
    assert.equal(pacote.totalGeralPesoKg, 200.5);
  });

  it("deve gerar o texto formatado para envio via WhatsApp do pacote com pedidos sequenciais", () => {
    const pacote = compilarDadosPacote(pedidosMock);
    const texto = gerarTextoWhatsAppPacote(pacote);

    assert(texto.includes("*📦 PACOTE DE PEDIDOS - FRIGORÍFICO VALUPI*"));
    assert(texto.includes("*PEDIDO 1: PED-2026-00001*"));
    assert(texto.includes("*Cliente:* Supermercado Alfa"));
    assert(texto.includes("*CNPJ:* 11.222.333/0001-44"));
    assert(texto.includes("*Cidade:* Campinas - SP"));
    assert(texto.includes("Costela Suína [caixa 20kg]"));
    assert(texto.includes("*PEDIDO 2: PED-2026-00002*"));
    assert(texto.includes("*Cliente:* Açougue Estrela"));
    assert(texto.includes("*Cidade:* Paulínia - SP"));
    assert(texto.includes("Pernil Suíno Congelado"));
    assert(texto.includes("• Total de Pedidos: *2*"));
    assert(texto.includes("• *PESO TOTAL DO PACOTE: 200,5 kg*"));
    assert(texto.includes("• Valor Total do Pacote:"));
  });

  it("deve gerar o HTML A4 do pacote com blocos de pedidos, CNPJ, cidade e destaque ao peso", () => {
    const pacote = compilarDadosPacote(pedidosMock);
    const html = gerarHtmlImpressaoA4Pacote(pacote);

    assert(html.includes("Pacote de Pedidos &bull; Frigorífico Valupi"));
    assert(html.includes("Peso Total do Pacote"));
    assert(html.includes("PED-2026-00001"));
    assert(html.includes("Supermercado Alfa"));
    assert(html.includes("11.222.333/0001-44"));
    assert(html.includes("Campinas - SP"));
    assert(html.includes("PED-2026-00002"));
    assert(html.includes("Açougue Estrela"));
    assert(html.includes("22.333.444/0001-55"));
    assert(html.includes("Paulínia - SP"));
    assert(html.includes("Resumo Geral Consolidado"));
    assert(html.includes("Total de Pedidos: <strong>2</strong>"));
  });

  it("deve gerar nome de arquivo padronizado para pacote", () => {
    const nomePdf = gerarNomeArquivoPacote("Frigorífico Valupi", "pdf");
    assert(nomePdf.startsWith("pacote-frigorifico-valupi-"));
    assert(nomePdf.endsWith(".pdf"));

    const nomePng = gerarNomeArquivoPacote("Frigorífico Valupi", "png");
    assert(nomePng.startsWith("pacote-frigorifico-valupi-"));
    assert(nomePng.endsWith(".png"));
  });

  it("deve bloquear a geração de pacote quando houver pedidos de frigoríficos diferentes", () => {
    const pedidoOutroFrigorifico: PedidoShareData = {
      ...pedidosMock[1],
      frigorifico: {
        nomeFantasia: "Outro Frigorífico LTDA",
        cnpj: "99.888.777/0001-66",
        telefone: "(11) 3333-2222",
      },
    };

    assert.throws(
      () => compilarDadosPacote([pedidosMock[0], pedidoOutroFrigorifico]),
      /frigoríficos diferentes/i
    );
  });
});

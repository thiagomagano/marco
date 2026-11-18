import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BRAND_LOGO_PATH, BRAND_NAME } from "../src/lib/brand.ts";
import {
  gerarNomeArquivoPrint,
  gerarNomeArquivoPdf,
  formatarEnderecoCliente,
  gerarTextoResumoWhatsApp,
  gerarHtmlImpressaoA4,
  type PedidoShareData,
} from "../src/lib/pedido-share.ts";

describe("Compartilhamento, Print e PDF A4 Imprimível de Pedido", () => {
  const pedidoExemplo: PedidoShareData = {
    id: "ped-123",
    numero: "PED-2026-00042",
    status: "CONFIRMADO",
    observacoes: "Entregar pela manhã no portão 2.",
    totalEstimado: 1580.5,
    pesoInformadoKg: 120.5,
    dataCriacao: "2026-11-09T10:00:00.000Z",
    dataConfirmacao: "2026-11-09T10:30:00.000Z",
    frigorifico: {
      nomeFantasia: "Frigorífico Valupi",
      cnpj: "12.345.678/0001-99",
      telefone: "(11) 4000-1234",
    },
    cliente: {
      razaoSocialOuNome: "Supermercado Irmãos Silva Ltda",
      nomeFantasia: "Supermercado Silva",
      cnpj: "98.765.432/0001-10",
      telefone: "(11) 99999-8888",
      email: "compras@supermercadosilva.com.br",
      endereco: "Av. Brasil, 500",
      bairro: "Centro",
      cidade: "Campinas - SP",
      cep: "13010-000",
    },
    vendedor: {
      nome: "Carlos Representante",
      telefone: "(11) 97777-6666",
    },
    itens: [
      {
        id: "item-1",
        produtoCodigoSnapshot: "101",
        produtoNomeSnapshot: "Costela Suína Congelada",
        produtoUnidadeSnapshot: "kg",
        produtoEmbalagemSnapshot: "caixa 20kg",
        quantidade: 50,
        precoUnitario: 22.5,
        subtotal: 1125.0,
      },
      {
        id: "item-2",
        produtoCodigoSnapshot: "205",
        produtoNomeSnapshot: "Lombo Suíno Temperado",
        produtoUnidadeSnapshot: "cx",
        produtoEmbalagemSnapshot: "saco 15kg",
        quantidade: 2,
        precoUnitario: 227.75,
        subtotal: 455.5,
      },
    ],
  };

  it("deve gerar o nome de arquivo padronizado para o print PNG e documento PDF", () => {
    assert.equal(
      gerarNomeArquivoPrint("PED-2026-00042"),
      "pedido-PED-2026-00042.png"
    );
    assert.equal(
      gerarNomeArquivoPrint("PED 2026/01"),
      "pedido-PED-2026-01.png"
    );
    assert.equal(
      gerarNomeArquivoPdf("PED-2026-00042"),
      "pedido-PED-2026-00042.pdf"
    );
    assert.equal(
      gerarNomeArquivoPdf("PED 2026/01"),
      "pedido-PED-2026-01.pdf"
    );
  });

  it("deve formatar o endereço completo do cliente com logradouro, bairro, cidade e CEP", () => {
    const endereco = formatarEnderecoCliente(pedidoExemplo.cliente);
    assert.equal(
      endereco,
      "Av. Brasil, 500 • Bairro Centro • Campinas - SP • CEP 13010-000"
    );
  });

  it("deve gerar o resumo formatado para WhatsApp com todos os dados e embalagens", () => {
    const texto = gerarTextoResumoWhatsApp(pedidoExemplo);

    assert(texto.includes("*RESUMO DO PEDIDO PED-2026-00042*"));
    assert(texto.includes("Status: *CONFIRMADO*"));
    assert(texto.includes("*Frigorífico:* Frigorífico Valupi"));
    assert(texto.includes("*Cliente:* Supermercado Silva"));
    assert(texto.includes("Razão Social: Supermercado Irmãos Silva Ltda"));
    assert(
      texto.includes(
        "Endereço: Av. Brasil, 500 • Bairro Centro • Campinas - SP • CEP 13010-000"
      )
    );
    assert(texto.includes("Tel. Cliente: (11) 99999-8888"));
    assert(texto.includes("E-mail Cliente: compras@supermercadosilva.com.br"));
    assert(texto.includes("*Vendedor:* Carlos Representante"));
    assert(
      texto.includes(
        "• (101) *Costela Suína Congelada* [caixa 20kg]: 50 kg"
      )
    );
    assert(
      texto.includes("• (205) *Lombo Suíno Temperado* [saco 15kg]: 2 cx")
    );
    assert(texto.includes("*TOTAL ESTIMADO:"));
    assert(texto.includes("*Observações:* Entregar pela manhã no portão 2."));
  });

  it("deve gerar o documento HTML de impressão em papel A4 sem assinaturas e com peso em destaque", () => {
    const html = gerarHtmlImpressaoA4(pedidoExemplo);

    assert(html.includes("@page"));
    assert(html.includes("size: A4 portrait"));
    assert(html.includes("Pedido Comercial de Representação"));
    assert(html.includes("PED-2026-00042"));
    assert(html.includes("Frigorífico Valupi"));
    assert(html.includes("Supermercado Silva"));
    assert(html.includes("E-mail: compras@supermercadosilva.com.br"));
    assert(html.includes("Av. Brasil, 500 • Bairro Centro • Campinas - SP • CEP 13010-000"));
    assert(html.includes("Costela Suína Congelada"));
    assert(html.includes("caixa 20kg"));
    assert(html.includes("Lombo Suíno Temperado"));
    assert(html.includes("saco 15kg"));
    assert(html.includes("Entregar pela manhã no portão 2."));
    assert(!html.includes("Conferência / Cliente"));
    assert(!html.includes("Vendedor / Representação"));
    assert(!html.includes('class="signatures"'));
    assert(html.includes("Peso Informado do Pedido"));
    assert(html.includes("120,5 kg"));
    assert(html.includes("Valor Total: R$"));
    assert(html.includes("PESO INFORMADO:"));
    assert(html.includes("Valor Total Estimado:"));
    assert(html.includes('class="letterhead"'));
    assert(html.includes('class="letterhead-logo"'));
    assert(html.includes(BRAND_NAME.toUpperCase()));
    assert(html.includes(BRAND_LOGO_PATH));
  });

  it("deve manter o valor total em destaque no documento A4 quando não houver peso informado", () => {
    const pedidoSemPeso: PedidoShareData = {
      ...pedidoExemplo,
      pesoInformadoKg: null,
    };
    const html = gerarHtmlImpressaoA4(pedidoSemPeso);

    assert(html.includes("Total Estimado do Pedido"));
    assert(html.includes("TOTAL ESTIMADO:"));
    assert(!html.includes("Peso Informado do Pedido"));
    assert(!html.includes("PESO INFORMADO:"));
  });

  it("deve omitir o campo E-mail quando o cliente não possuir e-mail cadastrado", () => {
    const pedidoSemEmail: PedidoShareData = {
      ...pedidoExemplo,
      cliente: {
        ...pedidoExemplo.cliente,
        email: "   ",
      },
    };
    const texto = gerarTextoResumoWhatsApp(pedidoSemEmail);
    const html = gerarHtmlImpressaoA4(pedidoSemEmail);

    assert(!texto.includes("E-mail Cliente:"));
    assert(!html.includes("E-mail:"));
  });

  it("deve exibir datas de embarque, entrega prevista e prazo do boleto customizado no pedido", () => {
    const pedidoComLogistica: PedidoShareData = {
      ...pedidoExemplo,
      dataEmbarque: "2026-11-20T15:00:00.000Z",
      dataEntregaPrevista: "2026-11-21T15:00:00.000Z",
      prazoPagamentoBoleto: "21/28 dias",
      cliente: {
        ...pedidoExemplo.cliente,
        prazoPagamentoBoleto: "14 dias",
      },
    };

    const texto = gerarTextoResumoWhatsApp(pedidoComLogistica);
    const html = gerarHtmlImpressaoA4(pedidoComLogistica);

    assert(texto.includes("Embarque/Carregamento: *20/11/2026*"));
    assert(texto.includes("Entrega Prevista: *21/11/2026*"));
    assert(texto.includes("Prazo Boleto: 21/28 dias"));
    assert(!texto.includes("Prazo Boleto: 14 dias"));

    assert(html.includes("Embarque/Carregamento: 20/11/2026"));
    assert(html.includes("Entrega Prevista: 21/11/2026"));
    assert(html.includes("21/28 dias"));
    assert(!html.includes("14 dias"));
  });
});

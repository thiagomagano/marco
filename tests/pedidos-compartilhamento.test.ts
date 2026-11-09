import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gerarNomeArquivoPrint,
  formatarEnderecoCliente,
  gerarTextoResumoWhatsApp,
  type PedidoShareData,
} from "../src/lib/pedido-share.ts";

describe("Compartilhamento e Exportação de Print de Pedido", () => {
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

  it("deve gerar o nome de arquivo padronizado para o print PNG", () => {
    assert.equal(
      gerarNomeArquivoPrint("PED-2026-00042"),
      "pedido-PED-2026-00042.png"
    );
    assert.equal(
      gerarNomeArquivoPrint("PED 2026/01"),
      "pedido-PED-2026-01.png"
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
});

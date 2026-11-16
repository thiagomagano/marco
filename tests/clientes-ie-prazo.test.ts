import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";
import {
  gerarTextoResumoWhatsApp,
  gerarHtmlImpressaoA4,
  type PedidoShareData,
} from "../src/lib/pedido-share.ts";

test("Cadastro de Clientes - Defaults e Opcionalidade de IE e Prazo Boleto", async () => {
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });

  // 1. Criação omitindo os dois campos: IE deve ser null e Prazo deve ser "14 dias"
  const clienteDefault = await prisma.cliente.create({
    data: {
      razaoSocialOuNome: "Mercado Default IE Prazo Ltda",
      vendedorId: vendedor.id,
      ativo: true,
    },
  });

  try {
    assert.equal(clienteDefault.inscricaoEstadual, null);
    assert.equal(clienteDefault.prazoPagamentoBoleto, "14 dias");

    // 2. Atualização com IE do RS e prazo personalizado (ex: 7/14/21 dias)
    const atualizado = await prisma.cliente.update({
      where: { id: clienteDefault.id },
      data: {
        inscricaoEstadual: "2243658792",
        prazoPagamentoBoleto: "7/14/21 dias",
      },
    });
    assert.equal(atualizado.inscricaoEstadual, "2243658792");
    assert.equal(atualizado.prazoPagamentoBoleto, "7/14/21 dias");

    // 3. Como ambos são opcionais, também deve permitir limpar o prazo para null
    const limpo = await prisma.cliente.update({
      where: { id: clienteDefault.id },
      data: {
        inscricaoEstadual: null,
        prazoPagamentoBoleto: null,
      },
    });
    assert.equal(limpo.inscricaoEstadual, null);
    assert.equal(limpo.prazoPagamentoBoleto, null);
  } finally {
    await prisma.cliente.delete({ where: { id: clienteDefault.id } });
  }
});

test("Pedido Share - Exibe IE formatada e Prazo Boleto quando informados", () => {
  const pedido: PedidoShareData = {
    numero: "PED-2026-00999",
    status: "CONFIRMADO",
    observacoes: null,
    totalEstimado: 500,
    pesoInformadoKg: 20,
    dataCriacao: "2026-11-14T13:00:00.000Z",
    dataConfirmacao: "2026-11-14T13:05:00.000Z",
    frigorifico: {
      nomeFantasia: "Frigorífico Sul",
      cnpj: null,
      telefone: null,
    },
    cliente: {
      razaoSocialOuNome: "Açougue Gaúcho Ltda",
      nomeFantasia: "Açougue Gaúcho",
      cnpj: "11.222.333/0001-81",
      inscricaoEstadual: "2243658792",
      prazoPagamentoBoleto: "21 dias",
      telefone: "(51) 99999-0000",
      endereco: "Av. Borges de Medeiros, 100",
      bairro: "Centro",
      cidade: "Porto Alegre - RS",
      cep: "90020-020",
    },
    vendedor: {
      nome: "João Vendedor",
      telefone: null,
    },
    itens: [
      {
        produtoCodigoSnapshot: "10",
        produtoNomeSnapshot: "Picanha Bovina",
        produtoUnidadeSnapshot: "kg",
        quantidade: 20,
        precoUnitario: 25,
        subtotal: 500,
      },
    ],
  };

  const whatsapp = gerarTextoResumoWhatsApp(pedido);
  assert(whatsapp.includes("IE Cliente: 224/3658792"));
  assert(whatsapp.includes("Prazo Boleto: 21 dias"));

  const html = gerarHtmlImpressaoA4(pedido);
  assert(html.includes("IE: 224/3658792"));
  assert(html.includes("Prazo Boleto:</strong> 21 dias"));
});

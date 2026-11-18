import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db.ts";
import {
  normalizeSearchText,
  buildClienteBuscaTexto,
  buildClienteWhere,
  rankClientesByQuery,
} from "../src/lib/cliente-search.ts";
import {
  backfillClientesBuscaTexto,
  resetClientesBackfillCache,
} from "../src/lib/cliente-backfill.ts";

test("Normalização de texto e construção de buscaTexto para clientes", () => {
  assert.equal(normalizeSearchText("  Açougue São José  "), "acougue sao jose");
  assert.equal(normalizeSearchText("GOIÂNIA - GO"), "goiania - go");

  const buscaTexto = buildClienteBuscaTexto({
    razaoSocialOuNome: "Açougue e Mercado São João Ltda",
    nomeFantasia: "São João Carnes",
    cnpjNormalized: "12345678000195",
    inscricaoEstadual: "2243658792",
    prazoPagamentoBoleto: "7/14/21 dias",
    cidade: "Goiânia - GO",
    bairro: "Setor Bueno",
  });

  assert(buscaTexto.includes("acougue e mercado sao joao ltda"));
  assert(buscaTexto.includes("sao joao carnes"));
  assert(buscaTexto.includes("12345678000195"));
  assert(buscaTexto.includes("2243658792"));
  assert(buscaTexto.includes("7/14/21 dias"));
  assert(buscaTexto.includes("7 14 21 dias"));
  assert(buscaTexto.includes("goiania - go"));
  assert(buscaTexto.includes("setor bueno"));
});

test("Busca normalizada, backfill legado, paginação (50/página) e ranking", async () => {
  const vendedor = await prisma.vendedor.findFirstOrThrow({
    where: { ativo: true },
  });

  const prefixo = `TST_PAG_${Date.now()}`;
  const idsCriados: string[] = [];

  try {
    // Cria 1 cliente com buscaTexto preenchido e acentuação
    const cliAcentuado = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `${prefixo} Açougue São Vicente Ltda`,
        nomeFantasia: `${prefixo} São Vicente`,
        cnpj: "99.888.777/0001-66",
        cnpjNormalized: "99888777000166",
        prazoPagamentoBoleto: "7/14/21 dias",
        cidade: "Goiânia - GO",
        bairro: "Setor Marista",
        vendedorId: vendedor.id,
        ativo: true,
        buscaTexto: buildClienteBuscaTexto({
          razaoSocialOuNome: `${prefixo} Açougue São Vicente Ltda`,
          nomeFantasia: `${prefixo} São Vicente`,
          cnpjNormalized: "99888777000166",
          prazoPagamentoBoleto: "7/14/21 dias",
          cidade: "Goiânia - GO",
          bairro: "Setor Marista",
        }),
      },
    });
    idsCriados.push(cliAcentuado.id);

    // Cria 1 cliente legado (buscaTexto: null) para testar fallback e backfill
    const cliLegado = await prisma.cliente.create({
      data: {
        razaoSocialOuNome: `${prefixo} Mercado Pão Dourado`,
        nomeFantasia: `${prefixo} Pão Dourado`,
        cidade: "Anápolis - GO",
        vendedorId: vendedor.id,
        ativo: true,
        buscaTexto: null,
      },
    });
    idsCriados.push(cliLegado.id);

    // Busca antes do backfill (legado ainda nulo)
    const achadoSemAcento = await prisma.cliente.findMany({
      where: buildClienteWhere({
        busca: `${prefixo} acougue goiania`,
        ativos: true,
      }),
    });
    assert.equal(achadoSemAcento.length, 1);
    assert.equal(achadoSemAcento[0].id, cliAcentuado.id);

    // Busca por CNPJ com máscara
    const achadoPorCnpj = await prisma.cliente.findMany({
      where: buildClienteWhere({
        busca: "99.888.777",
        ativos: true,
      }),
    });
    assert(achadoPorCnpj.some((c) => c.id === cliAcentuado.id));

    // Executa backfill e verifica que o cliente legado passa a responder sem acento
    resetClientesBackfillCache();
    const atualizados = await backfillClientesBuscaTexto(100);
    assert(atualizados >= 1);

    const achadoLegadoPosBackfill = await prisma.cliente.findMany({
      where: buildClienteWhere({
        busca: `${prefixo} pao anapolis`,
        ativos: true,
      }),
    });
    assert.equal(achadoLegadoPosBackfill.length, 1);
    assert.equal(achadoLegadoPosBackfill[0].id, cliLegado.id);

    // Ranking prioriza prefixo do Nome Fantasia / Razão Social
    const ranqueados = rankClientesByQuery(
      [
        {
          id: "2",
          razaoSocialOuNome: "Comercial Nova Alvorada Ltda",
          nomeFantasia: "Nova Alvorada",
        },
        {
          id: "1",
          razaoSocialOuNome: "Alvorada Distribuidora Ltda",
          nomeFantasia: "Alvorada Carnes",
        },
      ],
      "alvorada"
    );
    assert.equal(ranqueados[0].id, "1");

    // Cria mais 53 registros para validar paginação de 50 por página
    const loteExtra = Array.from({ length: 53 }, (_, i) => {
      const idx = String(i + 1).padStart(2, "0");
      const razao = `${prefixo} Lote Cliente ${idx}`;
      return {
        razaoSocialOuNome: razao,
        vendedorId: vendedor.id,
        ativo: true,
        buscaTexto: buildClienteBuscaTexto({ razaoSocialOuNome: razao }),
      };
    });
    await prisma.cliente.createMany({ data: loteExtra });

    const wherePag = buildClienteWhere({
      busca: prefixo,
      vendedorId: vendedor.id,
      ativos: true,
    });
    const limit = 50;
    const [pag1, pag2, total] = await Promise.all([
      prisma.cliente.findMany({
        where: wherePag,
        orderBy: [{ razaoSocialOuNome: "asc" }, { id: "asc" }],
        skip: 0,
        take: limit,
      }),
      prisma.cliente.findMany({
        where: wherePag,
        orderBy: [{ razaoSocialOuNome: "asc" }, { id: "asc" }],
        skip: limit,
        take: limit,
      }),
      prisma.cliente.count({ where: wherePag }),
    ]);

    assert.equal(total, 55);
    assert.equal(pag1.length, 50);
    assert.equal(pag2.length, 5);
    assert.equal(Math.ceil(total / limit), 2);
  } finally {
    await prisma.cliente.deleteMany({
      where: {
        OR: [
          { id: { in: idsCriados } },
          { razaoSocialOuNome: { startsWith: prefixo } },
        ],
      },
    });
  }
});

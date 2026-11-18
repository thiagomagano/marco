import test from "node:test";
import assert from "node:assert/strict";
import {
  BrasilApiError,
  buildCidadeUfFromBrasilApi,
  buildEnderecoFromBrasilApi,
  clearBrasilApiCache,
  consultarCnpjBrasilApi,
  formatCepBrasilApi,
  formatTelefoneBrasilApi,
  mapBrasilApiToClienteResult,
  toTitleCasePtBr,
} from "../src/lib/brasilapi-cnpj.ts";

test("toTitleCasePtBr - Formatação em Title Case respeitando preposições", () => {
  assert.equal(
    toTitleCasePtBr("SUPERMERCADO ALVORADA DE ALIMENTOS LTDA"),
    "Supermercado Alvorada de Alimentos Ltda"
  );
  assert.equal(
    toTitleCasePtBr("  ARMazém   DO   NORTE E SUL "),
    "Armazém do Norte e Sul"
  );
  assert.equal(
    toTitleCasePtBr("DE LUCA COMERCIO S/N"),
    "De Luca Comercio S/N"
  );
  assert.equal(
    toTitleCasePtBr("OLHO D'AGUA DO PIAUI"),
    "Olho d'Agua do Piaui"
  );
  assert.equal(toTitleCasePtBr("   "), null);
  assert.equal(toTitleCasePtBr(null), null);
});

test("buildEnderecoFromBrasilApi - Compõe endereço sem duplicar tipo de logradouro", () => {
  assert.equal(
    buildEnderecoFromBrasilApi({
      descricao_tipo_de_logradouro: "AVENIDA",
      logradouro: "ANHANGUERA",
      numero: "4500",
      complemento: "SALA 12",
    }),
    "Avenida Anhanguera, 4500 - Sala 12"
  );

  // Não duplica quando o logradouro já inicia com o tipo
  assert.equal(
    buildEnderecoFromBrasilApi({
      descricao_tipo_de_logradouro: "RUA",
      logradouro: "RUA DAS FLORES",
      numero: "S/N",
      complemento: "",
    }),
    "Rua das Flores, S/N"
  );

  assert.equal(
    buildEnderecoFromBrasilApi({
      descricao_tipo_de_logradouro: null,
      logradouro: null,
      numero: null,
      complemento: null,
    }),
    null
  );
});

test("buildCidadeUfFromBrasilApi - Compõe Cidade em Title Case e UF em maiúsculas", () => {
  assert.equal(
    buildCidadeUfFromBrasilApi("APARECIDA DE GOIANIA", "go"),
    "Aparecida de Goiania - GO"
  );
  assert.equal(buildCidadeUfFromBrasilApi("PORTO ALEGRE", null), "Porto Alegre");
  assert.equal(buildCidadeUfFromBrasilApi(null, null), null);
});

test("CEP e Telefone - Formatação padrão BrasilAPI", () => {
  assert.equal(formatCepBrasilApi("74000010"), "74000-010");
  assert.equal(formatCepBrasilApi(""), null);

  assert.equal(formatTelefoneBrasilApi("6232001234"), "(62) 3200-1234");
  assert.equal(formatTelefoneBrasilApi("62999991234"), "(62) 99999-1234");
  assert.equal(formatTelefoneBrasilApi("06232001234"), "(62) 3200-1234");
  assert.equal(formatTelefoneBrasilApi(""), null);
});

test("mapBrasilApiToClienteResult - Mapeia payload completo e campos nulos", () => {
  const result = mapBrasilApiToClienteResult(
    {
      cnpj: "04252011000110",
      razao_social: "SUPERMERCADO ALVORADA LTDA",
      nome_fantasia: null,
      descricao_situacao_cadastral: "ativa",
      cnae_fiscal_descricao: "COMERCIO VAREJISTA DE MERCADORIAS EM GERAL",
      porte: "DEMAIS",
      descricao_tipo_de_logradouro: "AVENIDA",
      logradouro: "BRASIL",
      numero: "100",
      complemento: "GALPAO A",
      bairro: "SETOR CENTRAL",
      cep: "74000010",
      municipio: "GOIANIA",
      uf: "GO",
      ddd_telefone_1: "",
      ddd_telefone_2: "62988887777",
      email: "CONTATO@ALVORADA.COM.BR",
    },
    "04252011000110"
  );

  assert.deepEqual(result.campos, {
    razaoSocialOuNome: "SUPERMERCADO ALVORADA LTDA",
    nomeFantasia: null,
    telefone: "(62) 98888-7777",
    email: "contato@alvorada.com.br",
    cep: "74000-010",
    endereco: "Avenida Brasil, 100 - Galpao A",
    bairro: "Setor Central",
    cidade: "Goiania - GO",
  });
  assert.equal(result.metadados.cnpjFormatado, "04.252.011/0001-10");
  assert.equal(result.metadados.situacaoCadastral, "ATIVA");
  assert.equal(
    result.metadados.cnaePrincipal,
    "Comercio Varejista de Mercadorias em Geral"
  );
  assert.equal(result.cached, false);
});

test("consultarCnpjBrasilApi - Fail fast para CNPJ inválido sem chamar fetch", async () => {
  clearBrasilApiCache();
  let called = false;
  const mockFetch = (async () => {
    called = true;
    throw new Error("Não deveria chamar fetch");
  }) as unknown as typeof fetch;

  await assert.rejects(
    () => consultarCnpjBrasilApi("11.111.111/1111-11", { fetchImpl: mockFetch }),
    (err: unknown) => err instanceof BrasilApiError && err.status === 400
  );
  assert.equal(called, false);
});

test("consultarCnpjBrasilApi - Cache em memória com TTL e expiração", async () => {
  clearBrasilApiCache();
  let fetchCount = 0;

  const mockFetch = (async (input: RequestInfo | URL) => {
    fetchCount++;
    assert.equal(
      String(input),
      "https://brasilapi.com.br/api/cnpj/v1/04252011000110"
    );
    return new Response(
      JSON.stringify({
        razao_social: "EMPRESA TESTE LTDA",
        descricao_situacao_cadastral: "ATIVA",
        municipio: "GOIANIA",
        uf: "GO",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as unknown as typeof fetch;

  const res1 = await consultarCnpjBrasilApi("04.252.011/0001-10", {
    fetchImpl: mockFetch,
    ttlMs: 1000,
    now: 10_000,
  });
  assert.equal(res1.cached, false);
  assert.equal(res1.campos.razaoSocialOuNome, "EMPRESA TESTE LTDA");
  assert.equal(fetchCount, 1);

  // Dentro do TTL: serve do cache
  const res2 = await consultarCnpjBrasilApi("04252011000110", {
    fetchImpl: mockFetch,
    ttlMs: 1000,
    now: 10_500,
  });
  assert.equal(res2.cached, true);
  assert.equal(fetchCount, 1);

  // Após expirar TTL: refaz consulta
  const res3 = await consultarCnpjBrasilApi("04252011000110", {
    fetchImpl: mockFetch,
    ttlMs: 1000,
    now: 11_500,
  });
  assert.equal(res3.cached, false);
  assert.equal(fetchCount, 2);
});

test("consultarCnpjBrasilApi - Tratamento explícito de 404, 429, 503 e timeout", async () => {
  clearBrasilApiCache();

  const makeStatusFetch = (status: number) =>
    (async () => new Response("{}", { status })) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      consultarCnpjBrasilApi("04252011000110", {
        fetchImpl: makeStatusFetch(404),
        bypassCache: true,
      }),
    (err: unknown) => err instanceof BrasilApiError && err.status === 404
  );

  await assert.rejects(
    () =>
      consultarCnpjBrasilApi("04252011000110", {
        fetchImpl: makeStatusFetch(429),
        bypassCache: true,
      }),
    (err: unknown) => err instanceof BrasilApiError && err.status === 429
  );

  await assert.rejects(
    () =>
      consultarCnpjBrasilApi("04252011000110", {
        fetchImpl: makeStatusFetch(503),
        bypassCache: true,
      }),
    (err: unknown) => err instanceof BrasilApiError && err.status === 503
  );

  const timeoutFetch = (async () => {
    const err = new Error("Aborted");
    err.name = "TimeoutError";
    throw err;
  }) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      consultarCnpjBrasilApi("04252011000110", {
        fetchImpl: timeoutFetch,
        bypassCache: true,
      }),
    (err: unknown) => err instanceof BrasilApiError && err.status === 504
  );
});

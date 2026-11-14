import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInscricaoEstadual,
  formatInscricaoEstadual,
  isValidInscricaoEstadualRS,
  parseInscricaoEstadualInput,
} from "../src/lib/inscricao-estadual.ts";
import {
  PRAZO_PAGAMENTO_DEFAULT,
  normalizePrazoPagamentoBoleto,
} from "../src/lib/prazo-pagamento.ts";

test("Inscrição Estadual - Normalização e Formatação RS", () => {
  assert.equal(normalizeInscricaoEstadual(""), null);
  assert.equal(normalizeInscricaoEstadual("   "), null);
  assert.equal(normalizeInscricaoEstadual(null), null);
  assert.equal(normalizeInscricaoEstadual("isento"), "ISENTO");
  assert.equal(normalizeInscricaoEstadual("224/3658792"), "2243658792");
  assert.equal(normalizeInscricaoEstadual("224.365.879-2"), "2243658792");

  assert.equal(formatInscricaoEstadual("2243658792"), "224/3658792");
  assert.equal(formatInscricaoEstadual("ISENTO"), "ISENTO");
  assert.equal(formatInscricaoEstadual(null), "");
});

test("Inscrição Estadual RS - Validação Módulo 11", () => {
  assert.equal(isValidInscricaoEstadualRS("224/3658792"), true);
  assert.equal(isValidInscricaoEstadualRS("2243658792"), true);
  assert.equal(isValidInscricaoEstadualRS("100/0000017"), true);

  // Dígito verificador incorreto
  assert.equal(isValidInscricaoEstadualRS("224/3658793"), false);
  // Sequência repetida
  assert.equal(isValidInscricaoEstadualRS("1111111111"), false);
  // Quantidade errada de dígitos para RS
  assert.equal(isValidInscricaoEstadualRS("123456"), false);
});

test("Inscrição Estadual - Parse de entrada (campo opcional)", () => {
  assert.deepEqual(parseInscricaoEstadualInput(""), {
    valid: true,
    normalized: null,
    formatted: null,
  });

  assert.deepEqual(parseInscricaoEstadualInput("isento"), {
    valid: true,
    normalized: "ISENTO",
    formatted: "ISENTO",
  });

  assert.deepEqual(parseInscricaoEstadualInput("224/3658792"), {
    valid: true,
    normalized: "2243658792",
    formatted: "224/3658792",
  });

  // Outra UF (ex: SC 9 dígitos) continua aceita se numérica entre 8 e 14 dígitos
  const sc = parseInscricaoEstadualInput("251040852");
  assert.equal(sc.valid, true);
  assert.equal(sc.normalized, "251040852");

  // Letras inválidas
  assert.equal(parseInscricaoEstadualInput("123ABC4567").valid, false);
  // Muito curta
  assert.equal(parseInscricaoEstadualInput("12345").valid, false);
  // RS 10 dígitos com DV inválido
  assert.equal(parseInscricaoEstadualInput("224/3658790").valid, false);
});

test("Prazo de Pagamento no Boleto - Default e Normalização", () => {
  assert.equal(PRAZO_PAGAMENTO_DEFAULT, "14 dias");

  assert.deepEqual(normalizePrazoPagamentoBoleto(""), {
    valid: true,
    value: null,
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto(null), {
    valid: true,
    value: null,
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto("14"), {
    valid: true,
    value: "14 dias",
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto(21), {
    valid: true,
    value: "21 dias",
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto(0), {
    valid: true,
    value: "À vista",
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto("7 / 14 / 21"), {
    valid: true,
    value: "7/14/21 dias",
  });
  assert.deepEqual(normalizePrazoPagamentoBoleto("28 DDL"), {
    valid: true,
    value: "28 DDL",
  });
  assert.equal(normalizePrazoPagamentoBoleto(-5).valid, false);
});

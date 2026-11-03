import test from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "../src/lib/cnpj.ts";

test("CNPJ - Normalização", () => {
  assert.equal(normalizeCnpj("04.252.011/0001-10"), "04252011000110");
  assert.equal(normalizeCnpj("  73.119.515/0001-92 "), "73119515000192");
  assert.equal(normalizeCnpj(""), null);
  assert.equal(normalizeCnpj(null), null);
  assert.equal(normalizeCnpj(undefined), null);
});

test("CNPJ - Formatação", () => {
  assert.equal(formatCnpj("04252011000110"), "04.252.011/0001-10");
  assert.equal(formatCnpj("04.252.011/0001-10"), "04.252.011/0001-10");
  assert.equal(formatCnpj(""), "");
});

test("CNPJ - Validação de Dígitos Verificadores", () => {
  // CNPJs válidos reais de teste
  assert.equal(isValidCnpj("04.252.011/0001-10"), true);
  assert.equal(isValidCnpj("73.119.515/0001-89"), true);
  assert.equal(isValidCnpj("33.000.167/0001-01"), true);
  assert.equal(isValidCnpj("04252011000110"), true);

  // CNPJs inválidos
  assert.equal(isValidCnpj("00.000.000/0000-00"), false); // sequencial repetido
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  assert.equal(isValidCnpj("04.252.011/0001-99"), false); // dígito verificador errado
  assert.equal(isValidCnpj("123"), false); // comprimento menor
  assert.equal(isValidCnpj(""), false);
  assert.equal(isValidCnpj(null), false);
});

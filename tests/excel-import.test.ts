import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanSpreadsheetCnpj,
  cleanSpreadsheetUnidade,
  cleanSpreadsheetPrice,
  normalizeKey,
  readSpreadsheet,
} from "../src/lib/excel-utils.ts";
import { prisma } from "../src/lib/db.ts";

test("Excel Utils - Normalização de Cabeçalhos", () => {
  assert.equal(normalizeKey("Razão Social"), "razaosocial");
  assert.equal(normalizeKey("C.N.P.J."), "cnpj");
  assert.equal(normalizeKey("Preço Referência (R$)"), "precoreferencia");
  assert.equal(normalizeKey("Vendedor Responsável"), "vendedorresponsavel");
});

test("Excel Utils - Recuperação e Sanitização de CNPJ do Excel", () => {
  // Caso comum no Excel: zero à esquerda omitido (13 dígitos)
  const cnpj13 = cleanSpreadsheetCnpj("4252011000110");
  assert.equal(cnpj13.normalized, "04252011000110");
  assert.equal(cnpj13.formatted, "04.252.011/0001-10");
  assert.equal(cnpj13.valid, true);

  // CNPJ já com 14 dígitos
  const cnpj14 = cleanSpreadsheetCnpj("11.222.333/0001-81");
  assert.equal(cnpj14.normalized, "11222333000181");
  assert.equal(cnpj14.valid, true);

  // CNPJ em branco / nulo (permitido)
  const cnpjVazio = cleanSpreadsheetCnpj("");
  assert.equal(cnpjVazio.normalized, null);
  assert.equal(cnpjVazio.valid, true);

  // CNPJ com dígitos inválidos
  const cnpjInvalido = cleanSpreadsheetCnpj("11.111.111/1111-11");
  assert.equal(cnpjInvalido.valid, false);
});

test("Excel Utils - Normalização de Unidades Comerciais", () => {
  assert.equal(cleanSpreadsheetUnidade("kg"), "kg");
  assert.equal(cleanSpreadsheetUnidade("QUILO"), "kg");
  assert.equal(cleanSpreadsheetUnidade("Kilos"), "kg");

  assert.equal(cleanSpreadsheetUnidade("cx"), "caixa");
  assert.equal(cleanSpreadsheetUnidade("Caixas"), "caixa");

  assert.equal(cleanSpreadsheetUnidade("pc"), "peça");
  assert.equal(cleanSpreadsheetUnidade("Peça"), "peça");
  assert.equal(cleanSpreadsheetUnidade("unidade"), "peça");

  assert.equal(cleanSpreadsheetUnidade("litro"), null); // Unidade inválida no sistema
});

test("Excel Utils - Conversão de Valores Monetários", () => {
  assert.equal(cleanSpreadsheetPrice("R$ 68,90"), 68.9);
  assert.equal(cleanSpreadsheetPrice("68,90"), 68.9);
  assert.equal(cleanSpreadsheetPrice("1.250,50"), 1250.5);
  assert.equal(cleanSpreadsheetPrice(85.0), 85.0);
  assert.equal(cleanSpreadsheetPrice(""), null);
  assert.equal(cleanSpreadsheetPrice("grátis"), null);
});

test("Excel Utils - Leitura e Parsing de Arquivo .xlsx", () => {
  const rows = readSpreadsheet("importacao/modelo_clientes.xlsx");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].razaosocial, "Supermercado Exemplo Ltda");
  assert.equal(rows[0].vendedor, "Carlos Eduardo Silva");
  assert.equal(rows[0].bairro, "Centro");
  assert.equal(rows[0].cidade, "São Paulo - SP");
  assert.equal(rows[0].cep, "01001-000");

  const rowsProd = readSpreadsheet("importacao/modelo_produtos.xlsx");
  assert(rowsProd.length > 0);
  assert(rowsProd[0].codigo);
  assert(rowsProd[0].nome);
  assert(rowsProd[0].embalagem);
});

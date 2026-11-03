import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSubtotal,
  calculateOrderTotal,
  calculateReportedWeightKg,
  formatCurrency,
  formatQuantity,
} from "../src/lib/money.ts";

test("Cálculos Financeiros - Subtotal de item", () => {
  // 125,500 kg * R$ 28,45/kg = R$ 3570.475 -> arredonda 3570.48
  const subtotal1 = calculateSubtotal(125.5, 28.45);
  assert.equal(subtotal1, 3570.48);

  // 15 peças * R$ 85,00 = R$ 1275.00
  const subtotal2 = calculateSubtotal(15, 85);
  assert.equal(subtotal2, 1275.0);

  // 4 caixas * R$ 195,50 = R$ 782.00
  const subtotal3 = calculateSubtotal(4, 195.5);
  assert.equal(subtotal3, 782.0);
});

test("Cálculos Financeiros - Total Estimado do Pedido", () => {
  const itens = [
    { quantidade: 125.5, precoUnitario: 28.45 }, // 3570.48
    { quantidade: 15, precoUnitario: 85.0 },     // 1275.00
    { quantidade: 4, precoUnitario: 195.5 },     // 782.00
  ];
  const total = calculateOrderTotal(itens);
  assert.equal(total, 5627.48);
});

test("Regra de Peso Informado em kg - Apenas itens em kg são somados", () => {
  const itens = [
    { quantidade: 125.5, unidade: "kg" },
    { quantidade: 50.25, unidade: "kg" },
    { quantidade: 10, unidade: "peça" }, // NÃO soma
    { quantidade: 5, unidade: "caixa" }, // NÃO soma
  ];

  const pesoKg = calculateReportedWeightKg(itens);
  assert.equal(pesoKg, 175.75);
});

test("Formatação de Quantidades e Moeda", () => {
  assert.equal(formatCurrency(5627.48).replace(/\s/g, " "), "R$ 5.627,48");
  assert.equal(formatQuantity(125.5, "kg"), "125,5 kg");
  assert.equal(formatQuantity(10, "peça"), "10 peça");
  assert.equal(formatQuantity(5, "caixa"), "5 caixa");
});

import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

function gerarModelos() {
  const dirImportacao = path.resolve(process.cwd(), "importacao");
  if (!fs.existsSync(dirImportacao)) {
    fs.mkdirSync(dirImportacao, { recursive: true });
  }

  // 1. Modelo de Clientes
  const colunasClientes = [
    {
      razao_social: "Supermercado Exemplo Ltda",
      nome_fantasia: "Supermercado Exemplo",
      cnpj: "11.222.333/0001-81",
      vendedor: "Carlos Eduardo Silva",
      telefone: "(11) 98765-4321",
      email: "compras@exemplo.com.br",
      endereco: "Av. Brasil, 1500 - Centro, São Paulo - SP",
      observacoes: "Entregas no período matutino até as 11h.",
    },
    {
      razao_social: "Churrascaria Boi na Brasa Eireli",
      nome_fantasia: "Boi na Brasa",
      cnpj: "33.000.167/0001-01",
      vendedor: "Mariana Souza Santos",
      telefone: "(11) 91234-5678",
      email: "financeiro@boinabrasa.com.br",
      endereco: "Rua das Flores, 88 - Bairro Alto",
      observacoes: "Fechamento de faturamento a cada 15 dias.",
    },
    {
      razao_social: "Açougue do Zé e Filhos",
      nome_fantasia: "Açougue do Zé",
      cnpj: "", // Sem CNPJ permitido
      vendedor: "Carlos Eduardo Silva",
      telefone: "(11) 99999-8888",
      email: "",
      endereco: "Rua do Mercado, 45",
      observacoes: "Cliente tradicional sem CNPJ.",
    },
  ];

  const wsClientes = XLSX.utils.json_to_sheet(colunasClientes);
  const wbClientes = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbClientes, wsClientes, "Clientes");
  const pathClientes = path.join(dirImportacao, "modelo_clientes.xlsx");
  XLSX.writeFile(wbClientes, pathClientes);

  // 2. Modelo de Produtos
  const colunasProdutos = [
    {
      frigorifico: "Frigorífico Boi Gordo",
      codigo: "101",
      nome: "Picanha Bovina Resfriada",
      unidade: "kg",
      preco_referencia: 68.9,
      categoria: "Cortes Nobres",
    },
    {
      frigorifico: "Frigorífico Boi Gordo",
      codigo: "102",
      nome: "Costela Bovina Janela",
      unidade: "caixa",
      preco_referencia: 380.0,
      categoria: "Tradicionais",
    },
    {
      frigorifico: "Frigorífico Boi Gordo",
      codigo: "103",
      nome: "Filé Mignon Inteiro",
      unidade: "peça",
      preco_referencia: 85.0,
      categoria: "Cortes Nobres",
    },
    {
      frigorifico: "Frigorífico Ouro do Sul",
      codigo: "101", // mesmo código demonstrando unicidade por frigorífico
      nome: "Costelinha Suína Especial",
      unidade: "kg",
      preco_referencia: 26.9,
      categoria: "Suínos",
    },
  ];

  const wsProdutos = XLSX.utils.json_to_sheet(colunasProdutos);
  const wbProdutos = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbProdutos, wsProdutos, "Produtos");
  const pathProdutos = path.join(dirImportacao, "modelo_produtos.xlsx");
  XLSX.writeFile(wbProdutos, pathProdutos);

  console.log("=================================================");
  console.log("✓ Planilhas modelo geradas com sucesso!");
  console.log("=================================================");
  console.log(`1. Modelo de Clientes: ${pathClientes}`);
  console.log(`2. Modelo de Produtos: ${pathProdutos}`);
  console.log("\nPreencha com seus dados e execute a importação via:");
  console.log("  npm run db:import clientes importacao/modelo_clientes.xlsx --dry-run");
  console.log("  npm run db:import produtos importacao/modelo_produtos.xlsx --dry-run");
  console.log("=================================================");
}

gerarModelos();

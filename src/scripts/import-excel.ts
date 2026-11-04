import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db.ts";
import {
  readSpreadsheet,
  cleanSpreadsheetCnpj,
  cleanSpreadsheetUnidade,
  cleanSpreadsheetPrice,
  normalizeKey,
} from "../lib/excel-utils.ts";

interface ImportStats {
  total: number;
  validos: number;
  inseridos: number;
  atualizados: number;
  erros: number;
  detalhesErros: Array<{ linha: number; identificador: string; motivo: string }>;
}

async function importarClientes(filePath: string, isDryRun: boolean) {
  console.log(`\n=================================================`);
  console.log(`Iniciando importação de CLIENTES ${isDryRun ? "[MODO SIMULAÇÃO / DRY-RUN]" : ""}`);
  console.log(`Arquivo: ${filePath}`);
  console.log(`=================================================\n`);

  const rows = readSpreadsheet(filePath);
  if (rows.length === 0) {
    console.log("Aviso: A planilha está vazia ou não contém dados.");
    return;
  }

  // Carrega vendedores ativos do banco para associação
  const vendedores = await prisma.vendedor.findMany({
    where: { ativo: true },
  });

  const vendedorMap = new Map<string, string>();
  for (const v of vendedores) {
    vendedorMap.set(normalizeKey(v.nome), v.id);
  }

  const stats: ImportStats = {
    total: rows.length,
    validos: 0,
    inseridos: 0,
    atualizados: 0,
    erros: 0,
    detalhesErros: [],
  };

  const cnpjsProcessados = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linhaNum = i + 2; // Linha 1 é o cabeçalho no Excel

    // Extrai valores com suporte a variações de cabeçalhos
    const razaoSocial = String(
      row["razaosocial"] || row["nome"] || row["cliente"] || row["empresa"] || ""
    ).trim();

    const nomeFantasia = String(
      row["nomefantasia"] || row["fantasia"] || row["apelido"] || ""
    ).trim();

    const rawCnpj = row["cnpj"] || row["documento"] || row["cpfcnpj"] || "";
    const rawVendedor = String(
      row["vendedor"] || row["representante"] || row["responsavel"] || ""
    ).trim();

    const telefone = String(row["telefone"] || row["tel"] || row["celular"] || "").trim();
    const email = String(row["email"] || row["correioeletronico"] || "").trim();
    const endereco = String(row["endereco"] || row["rua"] || row["local"] || "").trim();
    const observacoes = String(row["observacoes"] || row["obs"] || "").trim();

    // Validação 1: Razão Social obrigatória
    if (!razaoSocial) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: "Sem Nome",
        motivo: "Razão social / Nome do cliente não foi informado.",
      });
      continue;
    }

    // Validação 2: Vendedor obrigatório e deve existir no banco
    if (!rawVendedor) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: razaoSocial,
        motivo: "Vendedor não informado na linha.",
      });
      continue;
    }

    const vendedorId = vendedorMap.get(normalizeKey(rawVendedor));
    if (!vendedorId) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: razaoSocial,
        motivo: `Vendedor "${rawVendedor}" não encontrado no cadastro ou inativo.`,
      });
      continue;
    }

    // Validação 3: CNPJ (opcional, mas se preenchido precisa ser válido)
    const cnpjInfo = cleanSpreadsheetCnpj(rawCnpj);
    if (!cnpjInfo.valid) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: razaoSocial,
        motivo: `CNPJ informado ("${rawCnpj}") possui dígitos verificadores inválidos.`,
      });
      continue;
    }

    // Validação 4: Checa duplicidade do CNPJ dentro da própria planilha
    if (cnpjInfo.normalized) {
      if (cnpjsProcessados.has(cnpjInfo.normalized)) {
        stats.erros++;
        stats.detalhesErros.push({
          linha: linhaNum,
          identificador: razaoSocial,
          motivo: `CNPJ ${cnpjInfo.formatted} duplicado dentro da própria planilha.`,
        });
        continue;
      }
      cnpjsProcessados.add(cnpjInfo.normalized);
    }

    stats.validos++;

    // Se estiver em modo dry-run, apenas contabiliza
    if (isDryRun) {
      continue;
    }

    // Gravação real: Upsert por CNPJ se informado, ou busca por razão social
    try {
      if (cnpjInfo.normalized) {
        const clienteExistente = await prisma.cliente.findUnique({
          where: { cnpjNormalized: cnpjInfo.normalized },
        });

        if (clienteExistente) {
          await prisma.cliente.update({
            where: { id: clienteExistente.id },
            data: {
              razaoSocialOuNome: razaoSocial,
              nomeFantasia: nomeFantasia || clienteExistente.nomeFantasia,
              cnpj: cnpjInfo.formatted,
              vendedorId: vendedorId,
              telefone: telefone || clienteExistente.telefone,
              email: email || clienteExistente.email,
              endereco: endereco || clienteExistente.endereco,
              observacoes: observacoes || clienteExistente.observacoes,
            },
          });
          stats.atualizados++;
        } else {
          await prisma.cliente.create({
            data: {
              razaoSocialOuNome: razaoSocial,
              nomeFantasia: nomeFantasia || null,
              cnpj: cnpjInfo.formatted,
              cnpjNormalized: cnpjInfo.normalized,
              vendedorId: vendedorId,
              telefone: telefone || null,
              email: email || null,
              endereco: endereco || null,
              observacoes: observacoes || null,
              ativo: true,
            },
          });
          stats.inseridos++;
        }
      } else {
        // Sem CNPJ: verifica se já existe exatamente pelo nome
        const clienteExistente = await prisma.cliente.findFirst({
          where: { razaoSocialOuNome: razaoSocial },
        });

        if (clienteExistente) {
          await prisma.cliente.update({
            where: { id: clienteExistente.id },
            data: {
              nomeFantasia: nomeFantasia || clienteExistente.nomeFantasia,
              vendedorId: vendedorId,
              telefone: telefone || clienteExistente.telefone,
              email: email || clienteExistente.email,
              endereco: endereco || clienteExistente.endereco,
              observacoes: observacoes || clienteExistente.observacoes,
            },
          });
          stats.atualizados++;
        } else {
          await prisma.cliente.create({
            data: {
              razaoSocialOuNome: razaoSocial,
              nomeFantasia: nomeFantasia || null,
              vendedorId: vendedorId,
              telefone: telefone || null,
              email: email || null,
              endereco: endereco || null,
              observacoes: observacoes || null,
              ativo: true,
            },
          });
          stats.inseridos++;
        }
      }
    } catch (dbError) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: razaoSocial,
        motivo: `Erro no banco de dados: ${(dbError as Error).message}`,
      });
    }
  }

  // Relatório Final
  exibirRelatorio("CLIENTES", stats, isDryRun);
}

async function importarProdutos(
  filePath: string,
  isDryRun: boolean,
  frigorificoFixo?: string
) {
  console.log(`\n=================================================`);
  console.log(`Iniciando importação de PRODUTOS ${isDryRun ? "[MODO SIMULAÇÃO / DRY-RUN]" : ""}`);
  console.log(`Arquivo: ${filePath}`);
  if (frigorificoFixo) {
    console.log(`Frigorífico Padrão: ${frigorificoFixo}`);
  }
  console.log(`=================================================\n`);

  const rows = readSpreadsheet(filePath);
  if (rows.length === 0) {
    console.log("Aviso: A planilha está vazia ou não contém dados.");
    return;
  }

  // Carrega frigoríficos ativos do banco
  const frigorificos = await prisma.frigorifico.findMany({
    where: { ativo: true },
  });

  const frigorificoMap = new Map<string, string>();
  for (const f of frigorificos) {
    frigorificoMap.set(normalizeKey(f.nomeFantasia), f.id);
    if (f.razaoSocial) {
      frigorificoMap.set(normalizeKey(f.razaoSocial), f.id);
    }
  }

  const stats: ImportStats = {
    total: rows.length,
    validos: 0,
    inseridos: 0,
    atualizados: 0,
    erros: 0,
    detalhesErros: [],
  };

  const codigosPorFrigorifico = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linhaNum = i + 2;

    const rawFrig = String(
      frigorificoFixo ||
        row["frigorifico"] ||
        row["empresa"] ||
        row["fornecedor"] ||
        ""
    ).trim();

    const codigo = String(
      row["codigo"] || row["cod"] || row["sku"] || row["referencia"] || ""
    ).trim();

    const nome = String(
      row["nome"] || row["produto"] || row["descricao"] || row["corte"] || ""
    ).trim();

    const rawUnidade = row["unidade"] || row["unid"] || row["und"] || row["emb"];
    const rawPreco = row["precoreferencia"] || row["preco"] || row["valor"] || "";
    const categoria = String(row["categoria"] || row["grupo"] || row["tipo"] || "").trim();

    // Validação 1: Frigorífico
    if (!rawFrig) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: nome || `Código ${codigo}`,
        motivo: "Frigorífico não informado (informe na planilha ou use o parâmetro --frigorifico).",
      });
      continue;
    }

    const frigorificoId = frigorificoMap.get(normalizeKey(rawFrig));
    if (!frigorificoId) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: nome || `Código ${codigo}`,
        motivo: `Frigorífico "${rawFrig}" não encontrado no cadastro ou inativo.`,
      });
      continue;
    }

    // Validação 2: Código e Nome obrigatórios
    if (!codigo) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: nome || "Sem Código",
        motivo: "Código do produto no frigorífico é obrigatório.",
      });
      continue;
    }

    if (!nome) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: `Código ${codigo}`,
        motivo: "Nome/descrição do corte do produto é obrigatório.",
      });
      continue;
    }

    // Validação 3: Unidade Comercial (kg, peça ou caixa)
    const unidade = cleanSpreadsheetUnidade(rawUnidade);
    if (!unidade) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: `[${codigo}] ${nome}`,
        motivo: `Unidade comercial inválida ("${rawUnidade}"). Deve ser: 'kg', 'peça' ou 'caixa'.`,
      });
      continue;
    }

    // Validação 4: Preço de referência
    const precoRef = cleanSpreadsheetPrice(rawPreco);

    // Validação 5: Duplicidade na própria planilha (mesmo frigorífico + código)
    const comboKey = `${frigorificoId}::${codigo}`;
    if (codigosPorFrigorifico.has(comboKey)) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: `[${codigo}] ${nome}`,
        motivo: `Código "${codigo}" duplicado para o mesmo frigorífico nesta planilha.`,
      });
      continue;
    }
    codigosPorFrigorifico.add(comboKey);

    stats.validos++;

    if (isDryRun) {
      continue;
    }

    // Gravação real: Upsert por (frigorificoId, codigo)
    try {
      const prodExistente = await prisma.produto.findUnique({
        where: {
          frigorificoId_codigo: {
            frigorificoId,
            codigo,
          },
        },
      });

      if (prodExistente) {
        await prisma.produto.update({
          where: { id: prodExistente.id },
          data: {
            nome,
            unidade,
            precoReferencia: precoRef !== null ? precoRef : prodExistente.precoReferencia,
            categoria: categoria || prodExistente.categoria,
          },
        });
        stats.atualizados++;
      } else {
        await prisma.produto.create({
          data: {
            frigorificoId,
            codigo,
            nome,
            unidade,
            precoReferencia: precoRef,
            categoria: categoria || null,
            ativo: true,
          },
        });
        stats.inseridos++;
      }
    } catch (dbError) {
      stats.erros++;
      stats.detalhesErros.push({
        linha: linhaNum,
        identificador: `[${codigo}] ${nome}`,
        motivo: `Erro no banco de dados: ${(dbError as Error).message}`,
      });
    }
  }

  exibirRelatorio("PRODUTOS", stats, isDryRun);
}

function exibirRelatorio(tipo: string, stats: ImportStats, isDryRun: boolean) {
  console.log(`\n=================================================`);
  console.log(`RELATÓRIO DE MIGRAÇÃO: ${tipo} ${isDryRun ? "(SIMULAÇÃO)" : ""}`);
  console.log(`=================================================`);
  console.log(`Total de linhas lidas:     ${stats.total}`);
  console.log(`Linhas válidas:            ${stats.validos}`);

  if (isDryRun) {
    console.log(`\n* MODO DRY-RUN: Nenhum dado foi inserido ou alterado no banco.`);
    console.log(`  Se aprovar os resultados, execute sem o parâmetro --dry-run.`);
  } else {
    console.log(`Novos registros criados:   ${stats.inseridos}`);
    console.log(`Registros atualizados:     ${stats.atualizados}`);
  }

  console.log(`Linhas com erro/ignoradas: ${stats.erros}`);

  if (stats.detalhesErros.length > 0) {
    console.log(`\n-------------------------------------------------`);
    console.log(`DETALHAMENTO DOS ERROS ENCONTRADOS (${stats.detalhesErros.length}):`);
    console.log(`-------------------------------------------------`);
    for (const erro of stats.detalhesErros.slice(0, 50)) {
      console.log(`[Linha ${erro.linha}] ${erro.identificador}`);
      console.log(`  └─ Motivo: ${erro.motivo}\n`);
    }
    if (stats.detalhesErros.length > 50) {
      console.log(`... e mais ${stats.detalhesErros.length - 50} erros.`);
    }
  }

  console.log(`=================================================\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const tipo = args[0]?.toLowerCase();
  const filePathArg = args[1];

  const isDryRun = args.includes("--dry-run");

  // Captura --frigorifico "Nome"
  let frigorificoFixo: string | undefined;
  const frigoIdx = args.indexOf("--frigorifico");
  if (frigoIdx !== -1 && args[frigoIdx + 1]) {
    frigorificoFixo = args[frigoIdx + 1];
  }

  if (!tipo || !["clientes", "produtos"].includes(tipo) || !filePathArg) {
    console.log("\nUso correto do script de importação:");
    console.log("  npm run db:import clientes <caminho/arquivo.xlsx> [--dry-run]");
    console.log("  npm run db:import produtos <caminho/arquivo.xlsx> [--frigorifico \"Nome\"] [--dry-run]\n");
    console.log("Exemplos:");
    console.log("  npm run db:import clientes importacao/clientes.xlsx --dry-run");
    console.log("  npm run db:import clientes importacao/clientes.xlsx");
    console.log("  npm run db:import produtos importacao/produtos.xlsx --frigorifico \"Frigorífico Boi Gordo\"");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePathArg);
  if (!fs.existsSync(absolutePath)) {
    console.error(`\nErro: Arquivo não encontrado no caminho: ${absolutePath}`);
    process.exit(1);
  }

  if (tipo === "clientes") {
    await importarClientes(absolutePath, isDryRun);
  } else if (tipo === "produtos") {
    await importarProdutos(absolutePath, isDryRun, frigorificoFixo);
  }
}

main()
  .catch((e) => {
    console.error("Erro fatal na execução da importação:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

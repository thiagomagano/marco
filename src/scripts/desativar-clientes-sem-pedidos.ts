import { prisma } from "../lib/db.ts";
import { desativarClientesSemPedidos } from "../lib/cliente-manutencao.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("\nUso:");
    console.log("  npm run db:desativar-sem-pedidos -- --dry-run   # Apenas simula e exibe os totais");
    console.log("  npm run db:desativar-sem-pedidos                # Aplica a desativação no banco\n");
    return;
  }

  const isDryRun = args.includes("--dry-run");

  console.log("\n=================================================");
  console.log(
    `Manutenção de Clientes sem Pedidos ${isDryRun ? "[MODO SIMULAÇÃO / DRY-RUN]" : ""}`
  );
  console.log("=================================================\n");

  const resultado = await desativarClientesSemPedidos({ dryRun: isDryRun });

  console.log(`Total de clientes no banco:              ${resultado.totalClientes}`);
  console.log(`Ativos COM pedido(s) (mantidos ativos):  ${resultado.ativosComPedidos}`);
  if (resultado.inativosComPedidos > 0) {
    console.log(`Inativos COM pedido(s) (inalterados):    ${resultado.inativosComPedidos}`);
  }
  console.log(`Já inativos SEM pedidos (inalterados):   ${resultado.jaInativosSemPedidos}`);
  console.log(`Ativos SEM pedidos (alvo da operação):   ${resultado.paraDesativar}`);

  if (isDryRun) {
    console.log("\n* MODO DRY-RUN: Nenhum registro foi alterado no banco.");
    console.log("  Para aplicar, execute primeiro `npm run backup` e depois:");
    console.log("  npm run db:desativar-sem-pedidos\n");
  } else {
    console.log(`\n✓ Clientes desativados agora:            ${resultado.desativados}`);
    console.log("=================================================\n");
  }
}

main()
  .catch((err) => {
    console.error("Erro ao desativar clientes sem pedidos:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

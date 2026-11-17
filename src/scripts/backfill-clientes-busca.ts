import { prisma } from "../lib/db.ts";
import { backfillClientesBuscaTexto } from "../lib/cliente-backfill.ts";

async function main() {
  console.log("Iniciando backfill de buscaTexto para clientes...");
  const total = await backfillClientesBuscaTexto();
  console.log(`Backfill concluído. ${total} cliente(s) atualizado(s).`);
}

main()
  .catch((err) => {
    console.error("Erro no backfill de clientes:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

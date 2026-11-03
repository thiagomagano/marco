import fs from "node:fs";
import path from "node:path";

function runRestore() {
  const args = process.argv.slice(2);
  const backupDir = path.resolve(process.cwd(), "backups");
  const prismaDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  const rootDbPath = path.resolve(process.cwd(), "dev.db");
  const targetDbPath = fs.existsSync(prismaDbPath) ? prismaDbPath : rootDbPath;

  let sourceBackupPath: string;

  if (args.length > 0) {
    sourceBackupPath = path.resolve(process.cwd(), args[0]);
  } else {
    // Se nenhum arquivo for passado, pega o backup mais recente na pasta backups
    if (!fs.existsSync(backupDir)) {
      console.error("Erro: Diretório de backups não existe.");
      process.exit(1);
    }
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".db"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error("Erro: Nenhum arquivo de backup encontrado na pasta backups.");
      process.exit(1);
    }
    sourceBackupPath = path.join(backupDir, files[0]);
  }

  if (!fs.existsSync(sourceBackupPath)) {
    console.error(`Erro: Arquivo de backup não encontrado em: ${sourceBackupPath}`);
    process.exit(1);
  }

  // Realiza backup de emergência do arquivo atual se existir
  if (fs.existsSync(targetDbPath)) {
    const preRestoreSafety = path.join(
      backupDir,
      `pre-restore-safety-${Date.now()}.db`
    );
    fs.copyFileSync(targetDbPath, preRestoreSafety);
  }

  // Restaura o arquivo
  fs.copyFileSync(sourceBackupPath, targetDbPath);
  console.log(`✓ Restauração concluída com sucesso a partir de:`);
  console.log(`  ${sourceBackupPath}`);
}

runRestore();

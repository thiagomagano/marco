import fs from "node:fs";
import path from "node:path";

function runBackup() {
  const prismaDbPath = path.resolve(process.cwd(), "prisma", "dev.db");
  const rootDbPath = path.resolve(process.cwd(), "dev.db");
  const dbPath = fs.existsSync(prismaDbPath) ? prismaDbPath : rootDbPath;
  const backupDir = path.resolve(process.cwd(), "backups");

  if (!fs.existsSync(dbPath)) {
    console.error(`Erro: Banco de dados não encontrado em ${dbPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.db`;
  const targetPath = path.join(backupDir, backupFileName);

  fs.copyFileSync(dbPath, targetPath);
  const stats = fs.statSync(targetPath);

  console.log(`✓ Backup concluído com sucesso!`);
  console.log(`  Arquivo: ${backupFileName}`);
  console.log(`  Caminho: ${targetPath}`);
  console.log(`  Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
}

runBackup();

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STANDALONE_DIR = path.join(ROOT, ".next", "standalone");
const STATIC_DIR = path.join(ROOT, ".next", "static");
const PUBLIC_DIR = path.join(ROOT, "public");
const PRISMA_DIR = path.join(ROOT, "prisma");
const DEPLOY_DIR = path.join(ROOT, "deploy");

function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function main() {
  const incluirDb = process.argv.includes("--with-db");

  console.log("📦 Preparando pacote standalone para deploy na VPS Ubuntu...");
  if (!incluirDb) {
    console.log(
      "ℹ️  Modo Atualização Segura: 'prisma/dev.db' local NÃO será copiado para evitar sobrescrever o banco de produção na VPS."
    );
    console.log(
      "   (Caso seja o primeiro deploy e queira enviar seu dev.db local, use: npm run deploy:pack -- --with-db)\n"
    );
  }

  if (!fs.existsSync(STANDALONE_DIR)) {
    console.error(
      "❌ Pasta .next/standalone não encontrada. Execute 'npm run build' antes de rodar este script."
    );
    process.exit(1);
  }

  // Limpa pasta deploy anterior
  if (fs.existsSync(DEPLOY_DIR)) {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });

  // 1. Copia a base standalone (.next/standalone -> deploy/)
  console.log("1/5 Copiando servidor standalone (.next/standalone)...");
  copyRecursive(STANDALONE_DIR, DEPLOY_DIR);

  // 2. Copia os assets estáticos (.next/static -> deploy/.next/static)
  console.log("2/5 Copiando assets estáticos (.next/static)...");
  copyRecursive(STATIC_DIR, path.join(DEPLOY_DIR, ".next", "static"));

  // 3. Copia a pasta public (public -> deploy/public)
  if (fs.existsSync(PUBLIC_DIR)) {
    console.log("3/5 Copiando pasta public...");
    copyRecursive(PUBLIC_DIR, path.join(DEPLOY_DIR, "public"));
  }

  // 4. Copia a pasta prisma (schema.prisma e opcionalmente dev.db apenas com --with-db)
  console.log("4/5 Copiando schema Prisma...");
  const deployPrismaDir = path.join(DEPLOY_DIR, "prisma");
  fs.mkdirSync(deployPrismaDir, { recursive: true });
  if (fs.existsSync(path.join(PRISMA_DIR, "schema.prisma"))) {
    fs.copyFileSync(
      path.join(PRISMA_DIR, "schema.prisma"),
      path.join(deployPrismaDir, "schema.prisma")
    );
  }
  if (incluirDb && fs.existsSync(path.join(PRISMA_DIR, "dev.db"))) {
    console.log("   -> Incluindo prisma/dev.db local (--with-db ativado)...");
    fs.copyFileSync(
      path.join(PRISMA_DIR, "dev.db"),
      path.join(deployPrismaDir, "dev.db")
    );
  }

  // 5. Gera arquivos de configuração de exemplo para Systemd e Caddy
  console.log("5/5 Gerando arquivos de exemplo (marco.service e Caddyfile)...");

  const envContent = [
    'NODE_ENV="production"',
    'PORT="3000"',
    'HOSTNAME="127.0.0.1"',
    'DATABASE_URL="file:/var/www/marco/prisma/dev.db"',
    'JWT_SECRET="troque-por-uma-chave-secreta-forte-em-producao-2026"',
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(DEPLOY_DIR, ".env.production.example"),
    envContent,
    "utf8"
  );

  const systemdService = `[Unit]
Description=Sistema de Pedidos Comerciais (Next.js Standalone)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/marco
EnvironmentFile=/var/www/marco/.env
ExecStart=/usr/bin/node /var/www/marco/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
  fs.writeFileSync(
    path.join(DEPLOY_DIR, "marco.service"),
    systemdService,
    "utf8"
  );

  const caddyExample = `seu-dominio.com.br {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
`;
  fs.writeFileSync(
    path.join(DEPLOY_DIR, "Caddyfile.example"),
    caddyExample,
    "utf8"
  );

  console.log("\n✅ Pacote pronto na pasta './deploy'!");
}

main();

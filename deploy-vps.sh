#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/marco}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3013}"
cd "$APP_DIR"

echo "===================================================="
echo "🚀 Iniciando atualização de produção (Marco Pedidos)"
echo "===================================================="

# 1. Backup preventivo do banco SQLite de produção antes de qualquer alteração
if [ -f "prisma/dev.db" ]; then
  mkdir -p backups
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  cp prisma/dev.db "backups/dev.db.pre_deploy_${TIMESTAMP}.bak"
  echo "✅ 1/7 Backup de segurança criado: backups/dev.db.pre_deploy_${TIMESTAMP}.bak"

  # Mantém apenas os 10 backups pré-deploy mais recentes
  ls -1t backups/dev.db.pre_deploy_*.bak 2>/dev/null | tail -n +11 | xargs -r rm -f
else
  echo "ℹ️  1/7 Banco prisma/dev.db ainda não existe; pulando backup."
fi

# 2. Atualiza o código a partir do GitHub (preserva .env, backups/ e prisma/dev.db)
if [ "${SKIP_GIT_PULL:-0}" != "1" ]; then
  echo "🔄 2/7 Baixando código atualizado do GitHub..."
  git fetch origin main
  git reset --hard origin/main
else
  echo "🔄 2/7 Código já atualizado pelo CI; pulando git pull."
fi

# 3. Instala dependências e sincroniza schema do Prisma
echo "📦 3/7 Instalando pacotes e sincronizando schema do banco..."
npm install --no-audit --no-fund
npx prisma generate
npx prisma db push

# 4. Compila a aplicação Next.js
echo "🏗️  4/7 Compilando aplicação Next.js..."
npm run build

# 5. Prepara os arquivos estáticos junto ao standalone
echo "📂 5/7 Atualizando assets do servidor standalone..."
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/
if [ -d "public" ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/
fi

# 6. Ajusta permissões e reinicia o serviço no systemd
echo "🔁 6/7 Ajustando permissões e reiniciando serviço 'marco'..."
sudo chown -R www-data:www-data "$APP_DIR"
sudo chmod -R 775 "$APP_DIR/prisma"
sudo systemctl restart marco

# 7. Healthcheck pós-deploy
echo "🩺 7/7 Verificando saúde da aplicação em $HEALTHCHECK_URL..."
for i in $(seq 1 15); do
  if curl -fsS -o /dev/null "$HEALTHCHECK_URL"; then
    echo "===================================================="
    echo "✅ Deploy finalizado com sucesso! Serviço no ar."
    echo "===================================================="
    exit 0
  fi
  sleep 1
done

echo "❌ Healthcheck falhou após 15s. Últimos logs do serviço 'marco':"
sudo systemctl status marco --no-pager || true
sudo journalctl -u marco -n 30 --no-pager || true
exit 1

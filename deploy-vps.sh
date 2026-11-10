#!/usr/bin/env bash
set -e

APP_DIR="/var/www/marco"
cd "$APP_DIR"

echo "===================================================="
echo "🚀 Iniciando atualização de produção (Marco Pedidos)"
echo "===================================================="

# 1. Backup preventivo do banco SQLite de produção antes de qualquer alteração
if [ -f "prisma/dev.db" ]; then
  mkdir -p backups
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  cp prisma/dev.db "backups/dev.db.pre_deploy_${TIMESTAMP}.bak"
  echo "✅ 1/6 Backup de segurança criado: backups/dev.db.pre_deploy_${TIMESTAMP}.bak"
fi

# 2. Baixa as atualizações do GitHub preservando o banco e o .env de produção
echo "🔄 2/6 Baixando código atualizado do GitHub..."
git checkout -- prisma/dev.db 2>/dev/null || true
git pull origin master

# Restaura o banco de produção recém-salvo caso o git pull tenha tocado nele
if [ -n "$TIMESTAMP" ] && [ -f "backups/dev.db.pre_deploy_${TIMESTAMP}.bak" ]; then
  cp "backups/dev.db.pre_deploy_${TIMESTAMP}.bak" prisma/dev.db
fi

# 3. Instala dependências e sincroniza schema do Prisma (sem perder dados)
echo "📦 3/6 Instalando pacotes e sincronizando schema do banco..."
npm install
npx prisma generate
npx prisma db push

# 4. Compila a aplicação Next.js
echo "🏗️  4/6 Compilando aplicação Next.js..."
npm run build

# 5. Prepara os arquivos estáticos junto ao standalone
echo "📂 5/6 Atualizando assets do servidor standalone..."
cp -r .next/static .next/standalone/.next/
if [ -d "public" ]; then
  cp -r public .next/standalone/
fi

# 6. Ajusta permissões e reinicia o serviço no systemd
echo "🔁 6/6 Ajustando permissões e reiniciando serviço 'marco'..."
sudo chown -R www-data:www-data "$APP_DIR"
sudo chmod -R 775 "$APP_DIR/prisma"
sudo systemctl restart marco

echo "===================================================="
echo "✅ Deploy finalizado com sucesso! Serviço no ar."
echo "===================================================="

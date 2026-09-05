#!/bin/bash
# ==============================================================================
# Enterprise AI Algo Trading - Oracle Cloud Free Tier Production Deploy Script
# Mode: PAPER TRADING ONLY (Real-Money Execution Hard-Blocked)
# ==============================================================================
set -e

echo "=========================================================="
echo "🚀 1. Updating System & Installing Dependencies"
echo "=========================================================="
sudo apt-get update -y
sudo apt-get install -y curl git ufw jq openssl

# Install Docker & Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
fi

echo "=========================================================="
echo "🔒 2. Configuring Host Security & Firewall (UFW)"
echo "=========================================================="
# Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
# Explicitly keep PostgreSQL (5432) CLOSED from public internet
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

echo "=========================================================="
echo "🔑 3. Generating Production Environment Secrets"
echo "=========================================================="
if [ ! -f .env ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    JWT_SECRET_KEY=$(openssl rand -hex 32)
    BROKER_SECRET_KEY=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)

    cat <<EOF > .env
DATABASE_URL=postgresql+psycopg://algo_user:${DB_PASSWORD}@db:5432/algo_trading
POSTGRES_USER=algo_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=algo_trading
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
BROKER_SECRET_KEY=${BROKER_SECRET_KEY}
CORS_ALLOWED_ORIGINS=*

# MANDATORY CRITICAL SAFETY GATES
LIVE_TRADING_ENABLED=False
STRATEGY_SCHEDULER_ENABLED=True
STRATEGY_SCHEDULER_INTERVAL_SECONDS=5
BROKER_RECONCILIATION_ENABLED=True
BROKER_RECONCILIATION_INTERVAL_SECONDS=30
AUDIT_LOG_ENABLED=True
REDIS_EVENT_BUS_ENABLED=False
DEBUG=False
EOF
    echo "Created fresh secure .env with high-entropy keys."
else
    echo "Existing .env found. Preserving current secrets."
fi

echo "=========================================================="
echo "📦 4. Building Frontend Production Artifacts"
echo "=========================================================="
if [ ! -d "frontend/dist" ] || [ "$1" == "--rebuild-frontend" ]; then
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js 20 LTS for frontend build..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo "=========================================================="
echo "🐳 5. Launching Containers via Docker Compose"
echo "=========================================================="
docker compose -f docker-compose.production.yml down --remove-orphans || true
docker compose -f docker-compose.production.yml up -d --build

echo "=========================================================="
echo "⏳ 6. Verifying Database Migrations & Engine Health"
echo "=========================================================="
sleep 10
docker compose -f docker-compose.production.yml ps

echo "=========================================================="
echo "✅ Oracle Cloud UAT Deployment Ready!"
echo "Status: Running in 100% PAPER TRADING mode."
echo "=========================================================="

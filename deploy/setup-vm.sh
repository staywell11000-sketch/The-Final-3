#!/usr/bin/env bash
set -euo pipefail

echo "=== LuxEstate CRM Backend - Oracle Cloud VM Setup ==="

# --- Install Node.js 22 ---
if ! command -v node &>/dev/null; then
  echo ">>> Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

# --- Install pnpm ---
if ! command -v pnpm &>/dev/null; then
  echo ">>> Installing pnpm..."
  npm install -g pnpm
fi
echo "pnpm: $(pnpm --version)"

# --- Install PM2 for process management ---
if ! command -v pm2 &>/dev/null; then
  echo ">>> Installing PM2..."
  npm install -g pm2
fi
echo "pm2: $(pm2 --version)"

# --- Clone repo (if not already cloned) ---
REPO_DIR="$HOME/the-final-3"
if [ ! -d "$REPO_DIR" ]; then
  echo ">>> Cloning repository..."
  git clone https://github.com/staywell11000-sketch/The-Final-3.git "$REPO_DIR"
fi

cd "$REPO_DIR"

# --- Use the latest code ---
git checkout main
git pull origin main

# --- Set up environment variables ---
if [ ! -f "$REPO_DIR/.env" ]; then
  echo ">>> Creating .env file (you must edit with real values)..."
  cat > "$REPO_DIR/.env" << 'ENVEOF'
# --- Required ---
PORT=3000
NODE_ENV=production

# Supabase (from Supabase Dashboard -> Settings -> API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (from Supabase Dashboard -> Database -> Connection String)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# --- Optional (set if you need the features) ---
OPENAI_API_KEY=sk-your-openai-key
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
FACEBOOK_APP_SECRET=your-facebook-app-secret
ENVEOF
  echo "  -->  Edit $REPO_DIR/.env with real values before starting"
fi

# --- Install dependencies (backend only) ---
echo ">>> Installing dependencies..."
pnpm install --frozen-lockfile

# --- Build the backend ---
echo ">>> Building backend..."
cd "$REPO_DIR/artifacts/api-server"
pnpm run build

# --- Start with PM2 ---
echo ">>> Starting backend with PM2..."
pm2 delete luxestate-api 2>/dev/null || true
pm2 start dist/index.mjs \
  --name luxestate-api \
  --node-args="--enable-source-maps" \
  --kill-timeout 10000 \
  --env-file "$REPO_DIR/.env" \
  --log "$HOME/logs/luxestate-api.log"

# Save PM2 process list so it auto-restarts on reboot
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null

echo ""
echo "=== Setup complete ==="
echo "Backend running on port $(grep ^PORT "$REPO_DIR/.env" | cut -d= -f2)"
echo ""
pm2 status

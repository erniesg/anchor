#!/bin/bash
set -e

echo "🚀 Anchor Setup"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ node required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm required"; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Check for .env
if [ ! -f .env ]; then
  echo "⚠️  Creating .env from template..."
  cp .env.example .env
  echo "✏️  Edit .env with your Cloudflare credentials:"
  echo "   - CLOUDFLARE_ACCOUNT_ID"
  echo "   - CLOUDFLARE_API_TOKEN"
  echo ""
  read -p "Press enter when ready to continue..."
fi

# Run Cloudflare setup
echo "☁️  Setting up Cloudflare resources..."
pnpm setup:cloudflare

# Database setup
echo "🗄️  Setting up database..."
pnpm db:generate
pnpm db:migrate:dev

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start development: pnpm dev"
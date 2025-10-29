#!/bin/bash
set -e

echo "🚀 Setting up Supabase Workflow Engine..."

npm install
npm run build
npm run lint
npm run typecheck
npm run test

echo ""
echo "✅ Supabase Workflow Engine setup complete!"
echo "Note: Run 'npm run db:reset' to initialize local database"

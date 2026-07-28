#!/bin/bash
# ============================================================
# VeriAgent — Push to GitHub & Deploy to Vercel
# Live Domain Target: https://veri-agent.vercel.app
# ============================================================
#
# PREREQUISITES:
#   1. GitHub CLI (gh) installed: https://cli.github.com
#   2. Vercel CLI installed: npm i -g vercel
#   3. Logged in: gh auth login && vercel login
#
# ============================================================

set -e

REPO_NAME="VeriAgent"
REPO_DESC="On-chain verification protocol for autonomous AI agents, built on GenLayer Studio"

echo "════════════════════════════════════════════════════════════"
echo "  Step 1: Create GitHub repository"
echo "════════════════════════════════════════════════════════════"

# Create public repo on GitHub
gh repo create $REPO_NAME \
  --public \
  --description "$REPO_DESC" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "✅ Repository created and code pushed to GitHub!"
echo ""
echo "  https://github.com/$GITHUB_USERNAME/$REPO_NAME"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  Step 2: Deploy on Vercel"
echo "════════════════════════════════════════════════════════════"

# Deploy to Vercel (production)
vercel --prod \
  --yes \
  --name veri-agent

echo ""
echo "✅ Deployed to Vercel!"
echo ""
echo "  Your live application is ready at: https://veri-agent.vercel.app"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  Step 3: Environment Variables (Optional)"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  The GenLayer Studio contract address is baked in by default:"
echo "    0xb91f66881b27EA184c92468579dCFcB0F39bDFE4"
echo ""
echo "  If you want to override it on Vercel, run:"
echo "    vercel env add NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS production"
echo "    → Enter: 0xb91f66881b27EA184c92468579dCFcB0F39bDFE4"
echo "    vercel --prod"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  🎉 Done! Live App: https://veri-agent.vercel.app"
echo "════════════════════════════════════════════════════════════"

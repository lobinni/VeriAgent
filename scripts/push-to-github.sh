#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# VeriAgent — Push to GitHub
# ═══════════════════════════════════════════════════════════════
#
# USAGE:
#   chmod +x scripts/push-to-github.sh
#   ./scripts/push-to-github.sh <GITHUB_USERNAME> <GITHUB_TOKEN>
#
# GITHUB_TOKEN: Personal Access Token with 'repo' scope
#   Create at: https://github.com/settings/tokens/new
#   Select scope: ✅ repo (Full control of private repositories)
#
# ═══════════════════════════════════════════════════════════════

set -e

USERNAME="${1:?Usage: $0 <GITHUB_USERNAME> <GITHUB_TOKEN>}"
TOKEN="${2:?Usage: $0 <GITHUB_USERNAME> <GITHUB_TOKEN>}"
REPO_NAME="VeriAgent"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Step 1: Create GitHub repository '$REPO_NAME'"
echo "═══════════════════════════════════════════════════════"

# Create repo via GitHub API
HTTP_CODE=$(curl -s -o /tmp/gh_response.json -w "%{http_code}" \
  -X POST "https://api.github.com/user/repos" \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{
    \"name\": \"$REPO_NAME\",
    \"description\": \"On-chain verification protocol for autonomous AI agents — GenLayer Intelligent Contract\",
    \"private\": false,
    \"has_issues\": true,
    \"has_wiki\": false
  }")

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Repository created successfully!"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "ℹ️  Repository already exists, continuing with push..."
else
  echo "❌ Failed to create repository (HTTP $HTTP_CODE):"
  cat /tmp/gh_response.json | head -5
  echo ""
  echo "Continuing anyway — if repo exists, push will work."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Step 2: Configure remote and push"
echo "═══════════════════════════════════════════════════════"

# Remove existing origin if any
git remote remove origin 2>/dev/null || true

# Add remote with token authentication
git remote add origin "https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO_NAME}.git"

echo "Remote set: https://github.com/${USERNAME}/${REPO_NAME}"
echo ""

# Push all commits to main
echo "Pushing to main branch..."
git push -u origin main --force

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ DONE!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  GitHub:  https://github.com/${USERNAME}/${REPO_NAME}"
echo ""
echo "  Next step — deploy on Vercel:"
echo "    1. Go to https://vercel.com/new"
echo "    2. Import '${REPO_NAME}' repository"
echo "    3. Project Name: veri-agent"
echo "    4. Click Deploy"
echo ""
echo "  Live app: https://veri-agent.vercel.app"
echo ""

# Clean up token from remote URL (security)
git remote set-url origin "https://github.com/${USERNAME}/${REPO_NAME}.git"
echo "🔒 Token removed from remote URL for security."

#!/bin/bash
# Stop-hook validation script.
# - Runs lint + format check if any files changed (vs HEAD)
# - Also runs tests only when app code changed
#   (excludes docs/, CLAUDE.md, and .claude/ ritual files)

set -e

cd "$(git rev-parse --show-toplevel)"

CHANGED=$(git diff HEAD --name-only 2>/dev/null)

if [ -z "$CHANGED" ]; then
  exit 0
fi

npm run lint && npm run format:check

APP_CHANGED=$(echo "$CHANGED" | grep -vE '^(docs/|CLAUDE\.md|\.claude/)' || true)

if [ -n "$APP_CHANGED" ]; then
  npm run test
fi

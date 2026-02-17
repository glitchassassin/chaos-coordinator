#!/bin/bash
# Stop-hook validation script.
# - Runs lint + format check if any files changed (vs HEAD)
# - Also runs tests only when app code changed
#   (excludes docs/, CLAUDE.md, and .claude/ ritual files)
# Exit codes:
#   0 = all good, allow stop
#   2 = validation failed, block stop and resume agent with feedback

cd "$(git rev-parse --show-toplevel)"

CHANGED=$(git diff HEAD --name-only 2>/dev/null)

if [ -z "$CHANGED" ]; then
  exit 0
fi

if ! npm run lint; then
  echo "Lint/typecheck failed — fix the errors above before stopping."
  exit 2
fi

if ! npm run format:check; then
  echo "Format check failed — run 'npm run format' to fix."
  exit 2
fi

APP_CHANGED=$(echo "$CHANGED" | grep -vE '^(docs/|CLAUDE\.md|\.claude/)' || true)

if [ -n "$APP_CHANGED" ]; then
  if ! npm run test; then
    echo "Tests failed — fix the failing tests above before stopping."
    exit 2
  fi
fi

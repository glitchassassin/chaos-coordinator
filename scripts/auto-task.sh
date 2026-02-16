#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# auto-task.sh — Automated task implementation pipeline using Claude Code CLI
#
# Pipeline: IMPLEMENT → VALIDATE+FIX → REVIEW → VALIDATE+FIX → [REVIEW → VALIDATE+FIX] → DONE
# =============================================================================

# ---- Constants & Defaults ----

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DEFAULT_MODEL="sonnet"
DEFAULT_REVIEW_MODEL="opus"
DEFAULT_MAX_FIX=3
DEFAULT_MAX_REVIEW=2
DEFAULT_LOG_DIR="$PROJECT_ROOT/logs"

# ---- Configuration (env var fallbacks, then defaults) ----

MODEL="${AUTO_TASK_MODEL:-$DEFAULT_MODEL}"
REVIEW_MODEL="${AUTO_TASK_REVIEW_MODEL:-$DEFAULT_REVIEW_MODEL}"
MAX_FIX="${AUTO_TASK_MAX_FIX:-$DEFAULT_MAX_FIX}"
MAX_REVIEW="${AUTO_TASK_MAX_REVIEW:-$DEFAULT_MAX_REVIEW}"
LOG_DIR="$DEFAULT_LOG_DIR"
TASK=""
VERBOSE=false

# ---- Usage ----

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Automated task implementation pipeline using Claude Code CLI.

Pipeline: IMPLEMENT → VALIDATE+FIX → REVIEW → VALIDATE+FIX → DONE

Options:
  --task T-NNN          Implement a specific task (default: auto-select next ready task)
  --model MODEL         Model for implement/fix phases (default: $DEFAULT_MODEL)
  --review-model MODEL  Model for review phase (default: $DEFAULT_REVIEW_MODEL)
  --max-fix N           Max validation fix attempts per phase (default: $DEFAULT_MAX_FIX)
  --max-review N        Max review rounds (default: $DEFAULT_MAX_REVIEW)
  --log-dir DIR         Log directory (default: $DEFAULT_LOG_DIR)
  -v, --verbose         Show full Claude output (default: last 30 lines)
  -h, --help            Show this help message

Environment Variables:
  AUTO_TASK_MODEL         Override default implement/fix model
  AUTO_TASK_REVIEW_MODEL  Override default review model
  AUTO_TASK_MAX_FIX       Override default max fix attempts
  AUTO_TASK_MAX_REVIEW    Override default max review rounds

Exit Codes:
  0  Success (implemented + approved), or no eligible task
  1  Validation failures couldn't be fixed within max attempts
  2  Script error (missing prereqs, invalid args)
EOF
  exit 0
}

# ---- CLI Argument Parsing ----

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK="$2"; shift 2 ;;
    --model)
      MODEL="$2"; shift 2 ;;
    --review-model)
      REVIEW_MODEL="$2"; shift 2 ;;
    --max-fix)
      MAX_FIX="$2"; shift 2 ;;
    --max-review)
      MAX_REVIEW="$2"; shift 2 ;;
    --log-dir)
      LOG_DIR="$2"; shift 2 ;;
    -v|--verbose)
      VERBOSE=true; shift ;;
    -h|--help)
      usage ;;
    *)
      echo "Error: Unknown option: $1" >&2
      echo "Run '$(basename "$0") --help' for usage." >&2
      exit 2 ;;
  esac
done

# ---- Logging ----

mkdir -p "$LOG_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/auto-task_${TIMESTAMP}.log"
touch "$LOG_FILE"

CLAUDE_OUTPUT=""

log() {
  local msg
  msg="[$(date +%H:%M:%S)] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

# ---- Temp File Cleanup ----

TEMP_FILES=()
CLAUDE_PID=""

cleanup() {
  if [[ -n "$CLAUDE_PID" ]] && kill -0 "$CLAUDE_PID" 2>/dev/null; then
    kill -TERM "$CLAUDE_PID" 2>/dev/null
    wait "$CLAUDE_PID" 2>/dev/null || true
  fi
  for f in "${TEMP_FILES[@]}"; do
    rm -f "$f"
  done
}
trap cleanup EXIT
trap 'log "Interrupted."; exit 130' INT TERM

make_temp() {
  local tmp
  tmp="$(mktemp)"
  TEMP_FILES+=("$tmp")
  echo "$tmp"
}

# ---- Prerequisites Check ----

check_prereqs() {
  local missing=false

  if ! command -v claude &>/dev/null; then
    echo "Error: 'claude' not found in PATH." >&2
    missing=true
  fi

  if ! command -v npm &>/dev/null; then
    echo "Error: 'npm' not found in PATH." >&2
    missing=true
  fi

  if [[ "$missing" == true ]]; then
    exit 2
  fi

  if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
    echo "Error: Not a git repository: $PROJECT_ROOT" >&2
    exit 2
  fi

  if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    echo "Error: No package.json found in $PROJECT_ROOT" >&2
    exit 2
  fi

  if [[ ! -f "$PROJECT_ROOT/docs/tasks/README.md" ]]; then
    echo "Error: No docs/tasks/README.md found in $PROJECT_ROOT" >&2
    exit 2
  fi

  # Warn about dirty working tree
  if ! git -C "$PROJECT_ROOT" diff --quiet HEAD 2>/dev/null || \
     [[ -n "$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard 2>/dev/null)" ]]; then
    log "WARNING: Working tree has uncommitted changes. Proceeding anyway."
  fi
}

# ---- Claude Runner ----

run_claude() {
  local phase="$1"
  shift

  local tmp_out
  tmp_out="$(make_temp)"

  log "--- Phase: $phase ---"
  log "Running: claude $*"

  claude "$@" > "$tmp_out" 2>&1 &
  CLAUDE_PID=$!
  if wait "$CLAUDE_PID"; then
    log "Phase '$phase' completed successfully."
  else
    local exit_code=$?
    log "Phase '$phase' exited with code $exit_code."
  fi
  CLAUDE_PID=""

  # Append to log
  {
    echo ""
    echo "===== CLAUDE OUTPUT: $phase ====="
    cat "$tmp_out"
    echo "===== END CLAUDE OUTPUT: $phase ====="
    echo ""
  } >> "$LOG_FILE"

  # Show output
  if [[ "$VERBOSE" == true ]]; then
    cat "$tmp_out"
  else
    local lines
    lines="$(wc -l < "$tmp_out" | tr -d ' ')"
    if [[ "$lines" -gt 30 ]]; then
      log "(Showing last 30 of $lines lines — use -v for full output)"
      tail -30 "$tmp_out"
    else
      cat "$tmp_out"
    fi
  fi

  CLAUDE_OUTPUT="$(cat "$tmp_out")"
}

# ---- Validation ----

validate() {
  local errors_file="$1"

  log "Running validation (lint + test)..."

  local lint_out test_out
  lint_out="$(make_temp)"
  test_out="$(make_temp)"

  local failed=false

  if (cd "$PROJECT_ROOT" && npm run lint > "$lint_out" 2>&1); then
    log "Lint: PASSED"
  else
    log "Lint: FAILED"
    failed=true
  fi

  if (cd "$PROJECT_ROOT" && npm run test > "$test_out" 2>&1); then
    log "Test: PASSED"
  else
    log "Test: FAILED"
    failed=true
  fi

  # Combine errors
  {
    echo "===== LINT OUTPUT ====="
    cat "$lint_out"
    echo ""
    echo "===== TEST OUTPUT ====="
    cat "$test_out"
  } > "$errors_file"

  # Append to log
  cat "$errors_file" >> "$LOG_FILE"

  if [[ "$failed" == true ]]; then
    return 1
  fi
  return 0
}

# ---- Validate + Fix Loop ----

validate_and_fix() {
  local errors_file
  errors_file="$(make_temp)"

  for attempt in $(seq 1 "$MAX_FIX"); do
    if validate "$errors_file"; then
      log "Validation passed."
      return 0
    fi

    if [[ "$attempt" -eq "$MAX_FIX" ]]; then
      log "ERROR: Validation still failing after $MAX_FIX fix attempts."
      return 1
    fi

    log "Fix attempt $attempt/$MAX_FIX..."

    run_claude "FIX (attempt $attempt)" \
      -p "$FIX_PROMPT" \
      --model "$MODEL" \
      --dangerously-skip-permissions \
      --output-format text \
      < "$errors_file"
  done
}

# ---- Prompts ----

TASK_SELECTOR=""
if [[ -n "$TASK" ]]; then
  TASK_SELECTOR="Implement task $TASK specifically. Read its task doc from docs/tasks/."
else
  TASK_SELECTOR="Read docs/tasks/README.md to find the next eligible task. An eligible task has status: ready in its frontmatter and all its dependencies (if any) have status: done. Follow the recommended implementation order — pick the earliest eligible task."
fi

read -r -d '' IMPLEMENT_PROMPT <<'IMPLEMENT_EOF' || true
You are implementing a task for the Chaos Coordinator project.

TASK_SELECTOR_PLACEHOLDER

Instructions:
1. First, read CLAUDE.md for project conventions.
2. Find and read the task document to understand what needs to be built.
3. If the task status is not "ready", output "NO_ELIGIBLE_TASK" and stop.
4. Update the task frontmatter status from "ready" to "in-progress".
5. Implement the task fully:
   - Write all production code required by the task spec.
   - Write tests that cover the new functionality.
   - Follow all project conventions (TypeScript strict, accessibility, etc.).
6. After implementation, update the task frontmatter status from "in-progress" to "review".
7. Output "TASK_IMPLEMENTED: T-NNN" (with the actual task ID) as the last line.

If no eligible task is found, output only: NO_ELIGIBLE_TASK
If a task's dependencies are not met (status != done), output only: DEPENDENCIES_NOT_MET

Do NOT commit any changes.
IMPLEMENT_EOF

# Substitute the task selector into the prompt
IMPLEMENT_PROMPT="${IMPLEMENT_PROMPT//TASK_SELECTOR_PLACEHOLDER/$TASK_SELECTOR}"

read -r -d '' FIX_PROMPT <<'FIX_EOF' || true
You are fixing validation errors in the Chaos Coordinator project.

The following lint and/or test errors were found (provided via stdin).
Fix ALL errors in the codebase. Follow these rules:

1. Read CLAUDE.md for project conventions.
2. Fix the actual code issues — do NOT weaken lint rules, disable checks, or skip tests.
3. If a test is genuinely wrong (testing removed/changed behavior), update the test to match the new behavior.
4. Do NOT commit any changes.

Fix every error shown below:
FIX_EOF

read -r -d '' REVIEW_PROMPT <<'REVIEW_EOF' || true
You are reviewing recent code changes in the Chaos Coordinator project.

Instructions:
1. Read CLAUDE.md for project conventions.
2. Run `git diff` and `git status` to see all uncommitted changes.
3. Identify which task was implemented by reading the changed task doc(s) in docs/tasks/.
4. Read the full task document to understand the requirements.
5. Review all changes against these criteria:
   - Correctness: Does the implementation match the task spec?
   - Code quality: Clean code, no dead code, proper error handling?
   - Type safety: Strict TypeScript, no unnecessary `any`?
   - Test coverage: Are new features adequately tested?
   - Accessibility: Keyboard navigation, ARIA labels, focus management?
   - Consistency: Does it follow existing patterns in the codebase?
6. If you find issues:
   - Fix them directly in the code.
   - Briefly describe what you fixed in your output.
7. If everything looks good (or after fixing all issues), output: CHANGES APPROVED

Do NOT commit any changes.
REVIEW_EOF

# ---- Main Pipeline ----

main() {
  log "========================================="
  log "Auto-Task Pipeline Starting"
  log "========================================="
  log "Model: $MODEL | Review: $REVIEW_MODEL"
  log "Max fix: $MAX_FIX | Max review: $MAX_REVIEW"
  log "Log file: $LOG_FILE"
  if [[ -n "$TASK" ]]; then
    log "Target task: $TASK"
  else
    log "Target task: (auto-select)"
  fi
  log ""

  check_prereqs

  # Phase 1: Implement
  log ""
  log "========== PHASE 1: IMPLEMENT =========="
  run_claude "IMPLEMENT" \
    -p "$IMPLEMENT_PROMPT" \
    --model "$MODEL" \
    --dangerously-skip-permissions \
    --output-format text

  if echo "$CLAUDE_OUTPUT" | grep -q "NO_ELIGIBLE_TASK"; then
    log ""
    log "No eligible task found. All done!"
    exit 0
  fi

  if echo "$CLAUDE_OUTPUT" | grep -q "DEPENDENCIES_NOT_MET"; then
    log ""
    log "ERROR: Task dependencies are not met."
    exit 2
  fi

  # Extract task ID from output
  local task_id
  task_id="$(echo "$CLAUDE_OUTPUT" | grep -o 'TASK_IMPLEMENTED: T-[0-9]*' | tail -1 | sed 's/TASK_IMPLEMENTED: //' || true)"
  if [[ -n "$task_id" ]]; then
    log "Task implemented: $task_id"
  else
    log "WARNING: Could not extract task ID from output. Continuing anyway."
  fi

  # Phase 2: Validate + Fix (post-implementation)
  log ""
  log "========== PHASE 2: VALIDATE + FIX =========="
  if ! validate_and_fix; then
    log ""
    log "FAILED: Could not fix validation errors after implementation."
    exit 1
  fi

  # Phase 3: Review rounds
  local approved=false
  for round in $(seq 1 "$MAX_REVIEW"); do
    log ""
    log "========== PHASE 3: REVIEW (round $round/$MAX_REVIEW) =========="

    run_claude "REVIEW (round $round)" \
      -p "$REVIEW_PROMPT" \
      --model "$REVIEW_MODEL" \
      --dangerously-skip-permissions \
      --output-format text

    if echo "$CLAUDE_OUTPUT" | grep -q "CHANGES APPROVED"; then
      log "Review: CHANGES APPROVED"
      approved=true

      # Validate once more after review (reviewer may have made changes)
      log ""
      log "========== POST-REVIEW VALIDATE + FIX =========="
      if ! validate_and_fix; then
        log ""
        log "FAILED: Validation failed after review changes."
        exit 1
      fi
      break
    fi

    log "Review requested changes. Running validation..."
    log ""
    log "========== POST-REVIEW VALIDATE + FIX (round $round) =========="
    if ! validate_and_fix; then
      log ""
      log "FAILED: Could not fix validation errors after review round $round."
      exit 1
    fi
  done

  # Final status
  log ""
  log "========================================="
  if [[ "$approved" == true ]]; then
    log "SUCCESS: Task ${task_id:-unknown} implemented and approved."
    log "Changes are left uncommitted for your review."
    log "Run 'git diff' to inspect, then commit when satisfied."
  else
    log "WARNING: Max review rounds ($MAX_REVIEW) reached without explicit approval."
    log "Changes are left uncommitted. Please review manually."
  fi
  log "Log file: $LOG_FILE"
  log "========================================="
}

main

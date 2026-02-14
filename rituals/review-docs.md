# Ritual: Review Documentation

**When to run:** After completing a task, adding/changing an ADR, or whenever docs feel like they may have drifted.

---

## 1. ADR Index (`docs/decisions/README.md`)

- [ ] Every `.md` file in `docs/decisions/` (except README) has a row in the table
- [ ] No table rows point to files that don't exist
- [ ] Status column matches the `**Status:**` line inside each ADR
- [ ] Table is sorted by ADR number

**Quick check:**

```bash
# Files on disk (excluding README)
ls docs/decisions/*.md | grep -v README | sed 's|.*/||' | sort

# Files referenced in the table
grep -oP '\[.*?\]\((\K[^)]+)' docs/decisions/README.md | sort
```

Both lists should match.

## 2. Task Index (`docs/tasks/README.md`)

- [ ] Every `T-*.md` file in `docs/tasks/` has a row in a phase table
- [ ] No table rows point to files that don't exist
- [ ] Complexity and dependency columns match frontmatter in each task file
- [ ] Dependency graph at the bottom reflects current task dependencies
- [ ] No tasks listed in the graph are missing from the phase tables (or vice versa)

**Quick check:**

```bash
# Files on disk
ls docs/tasks/T-*.md | sed 's|.*/||' | sort

# Files referenced in tables
grep -oP '\[T-\d+\]\((\K[^)]+)' docs/tasks/README.md | sort
```

## 3. Task Frontmatter

For each task file in `docs/tasks/T-*.md`:

- [ ] `status` reflects reality (draft/ready/in-progress/review/done)
- [ ] `dependencies` lists only task IDs that exist (e.g., `T-002` has a corresponding file)
- [ ] `adrs` lists only ADR numbers that exist (e.g., `011` has `docs/decisions/011-*.md`)
- [ ] `spec_refs` reference sections that exist in `docs/SPEC.md`

## 4. ADR Cross-References

For each ADR in `docs/decisions/`:

- [ ] "Related" section references (ADRs, tasks, spec sections) point to things that exist
- [ ] If an ADR supersedes another, the superseded ADR's status says "Superseded" and links to the replacement
- [ ] Implementation notes reference source paths that still exist

## 5. SPEC.md (`docs/SPEC.md`)

- [ ] Section numbers (`§1`, `§2.1`, etc.) referenced elsewhere in the codebase actually exist in the spec
- [ ] No orphaned sections that have been removed but are still referenced

**Quick check:**

```bash
# All spec section references across the project
grep -rhoP '§[\d.]+' docs/ | sort -u

# Compare against actual headings in SPEC.md
grep -P '^#{1,3} \d+' docs/SPEC.md
```

## 6. ARCHITECTURE.md

- [ ] Source file paths mentioned (e.g., `src/main/priority/engine.ts`) still exist
- [ ] Component descriptions reflect the current implementation
- [ ] ADR and spec references are valid
- [ ] The system diagram reflects current components

## 7. CLAUDE.md

- [ ] Command examples (`npm run dev`, etc.) still work
- [ ] File path references are valid
- [ ] References to docs (`docs/SPEC.md`, `docs/decisions/`, etc.) point to things that exist

## 8. docs/references/

- [ ] Any pattern docs in `docs/references/` reference source code that still exists
- [ ] Patterns described are still the current approach (not superseded by later ADRs)

---

## Running This Ritual

When asking Claude Code to run this ritual:

> Run the review-docs ritual. Check all cross-references between docs, flag anything missing or stale, and fix what you can.

Claude Code should:

1. Run the quick-check commands to find obvious mismatches
2. Spot-check frontmatter and cross-references
3. Fix simple issues (missing index entries, stale statuses) directly
4. Flag anything ambiguous for human judgment

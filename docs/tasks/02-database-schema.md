# Task 02 — Database & Schema

## Goal

Set up SQLite via better-sqlite3 + Drizzle ORM with the `projects` and `agents` tables. Include migration tooling.

## Subtasks

- [ ] Define Drizzle schema for `projects` table:
  - `id` (TEXT PK, ULID), `name`, `directory` (UNIQUE), `remote_url`, `provider_type`, `owner`, `repo`, `created_at`, `removed_at`
- [ ] Define Drizzle schema for `agents` table:
  - `id` (TEXT PK, ULID), `project_id` (FK), `tmux_session` (UNIQUE), `status`, `initial_prompt`, `linked_issue_id`, `linked_pr_id`, `log_path`, `created_at`, `ended_at`
- [ ] Configure Drizzle Kit for migration generation (`db:generate`)
- [ ] Create a `getDb()` singleton that opens/creates the SQLite file at a sensible default location (e.g. `~/.chaos-coordinator/data.db` or within the project working directory)
- [ ] Run migrations on startup automatically
- [ ] Write unit tests for schema: insert, query, soft delete, FK constraints

## Acceptance

- `npm run db:generate` produces migration SQL
- App startup creates the database and tables if they don't exist
- Tests pass for basic CRUD on both tables

## References

- Requirements: §1.6 SQLite Schema

# Task 10 — Per-Project Detail View (Phase 2)

## Goal

Build the project detail page with tabs for issues, PRs, builds, and agents, with actions to launch agents from issues/PRs.

## Subtasks

### Route & Layout

- [ ] Route: `/projects/:id` → project detail
- [ ] Tab navigation: Issues, PRs, Builds, Agents

### Issues Tab

- [ ] List open issues from provider (Task 09)
- [ ] Each issue row: number, title, labels, assignee
- [ ] "Launch agent on issue" action: pre-fills agent prompt with issue title, body, and link
- [ ] Auto-sets `linked_issue_id` on the created agent

### PRs Tab

- [ ] List open PRs from provider
- [ ] Each PR row: number, title, branch, status checks summary
- [ ] "Launch review agent" action: pre-fills prompt for code review context
- [ ] Auto-sets `linked_pr_id` on the created agent

### Builds Tab

- [ ] List recent CI/pipeline runs
- [ ] Each row: title, branch, status (pass/fail/running), time

### Agents Tab

- [ ] List active and recent agents for this project
- [ ] Link to agent detail view
- [ ] Show linked issue/PR title where applicable

### REST API

- [ ] `GET /projects/:id/issues`
- [ ] `GET /projects/:id/prs`
- [ ] `GET /projects/:id/builds`

## Acceptance

- Project detail page shows issues, PRs, builds from the correct provider
- Can launch an agent from an issue or PR, with the prompt pre-filled and link auto-set
- Agents tab shows all agents for the project

## References

- Requirements: §2.3

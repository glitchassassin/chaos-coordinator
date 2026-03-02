# Task 09 — CLI Provider Abstraction (Phase 2)

## Goal

Implement the `ProjectProvider` interface for GitHub and Azure DevOps, calling their respective CLIs for issues, PRs, and builds.

## Subtasks

### Interface

- [ ] Define `ProjectProvider` TypeScript interface:
  - `listIssues(filters?)`, `getIssue(id)`, `listPRs(filters?)`, `getPR(id)`, `listBuilds(filters?)`
- [ ] Provider factory: given a project's `provider_type`, `owner`, `repo` → return the correct implementation (or null)

### GitHub Provider

- [ ] `listIssues`: `gh issue list --repo {owner}/{repo} --json number,title,state,labels,assignees`
- [ ] `getIssue`: `gh issue view {id} --repo {owner}/{repo} --json number,title,body,state,labels,assignees,comments`
- [ ] `listPRs`: `gh pr list --repo {owner}/{repo} --json number,title,state,headRefName,statusCheckRollup`
- [ ] `getPR`: `gh pr view {id} --repo {owner}/{repo} --json ...`
- [ ] `listBuilds`: `gh run list --repo {owner}/{repo} --json databaseId,displayTitle,status,conclusion,headBranch`

### Azure DevOps Provider

- [ ] `listIssues`: `az boards work-item query` with WIQL
- [ ] `listPRs`: `az repos pr list --repository {repo} --organization ... --project ...`
- [ ] `listBuilds`: `az pipelines run list --organization ... --project ...`
- [ ] Handle org/project extraction from Azure DevOps remote URLs

### Caching

- [ ] TTL cache (30–60s) on all CLI results to avoid hammering on page loads
- [ ] Cache keyed by provider + method + args

### Tests

- [ ] Unit tests with mocked CLI output for each provider method
- [ ] Unit tests for cache TTL behavior

## Acceptance

- Given a GitHub project, can list its issues, PRs, and builds via `gh`
- Given an Azure DevOps project, can list its issues, PRs, and builds via `az`
- Results are cached briefly
- Projects without a provider gracefully return empty/null

## References

- Requirements: §2.2

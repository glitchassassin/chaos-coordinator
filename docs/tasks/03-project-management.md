# Task 03 — Project Management (CRUD + Git Detection)

## Goal

Implement the backend and frontend for adding, listing, and removing projects.

## Subtasks

### Backend

- [ ] `addProject(directory)` service:
  - Validate directory exists and is accessible
  - Run `git -C {dir} remote get-url origin` to detect remote (nullable)
  - Parse remote URL → classify `provider_type` (`github` | `azure-devops` | null), extract `owner`/`repo`
  - Default `name` to directory basename (or `owner/repo` if available)
  - Insert into SQLite, return project record
- [ ] `listProjects()` — returns all non-removed projects
- [ ] `removeProject(id)` — sets `removed_at` timestamp (soft delete)
- [ ] Git remote parser: handle GitHub SSH/HTTPS, Azure DevOps HTTPS (including `visualstudio.com` legacy)
- [ ] REST routes (or React Router resource routes): `POST /projects`, `GET /projects`, `DELETE /projects/:id`
- [ ] Unit tests for git remote parsing (various URL formats)
- [ ] Unit tests for project CRUD

### Frontend

- [ ] "Add Project" flow: path text input → validate → submit → show in list
- [ ] Project list on dashboard: name, directory, provider badge
- [ ] Remove project action (with confirmation)

## Acceptance

- Can add a project by directory path, see it listed, and soft-delete it
- Git remote detection correctly classifies GitHub and Azure DevOps URLs
- Directories without remotes are accepted (provider fields null)

## References

- Requirements: §1.1, §2.1

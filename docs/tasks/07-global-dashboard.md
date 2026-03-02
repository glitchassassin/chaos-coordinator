# Task 07 — Global Agent Dashboard

## Goal

Build the main dashboard view: all agents grouped by project, with status, actions, and new agent/project flows.

## Subtasks

### Layout

- [ ] Implement app shell: sidebar (projects list, nav) + main content area at ≥768px, single column on mobile
- [ ] Route: `/` → dashboard

### Agent Cards

- [ ] Card per agent showing:
  - Status badge (active/idle/waiting/error/terminated) with design system colors
  - Project name
  - Last message snippet (truncated)
  - Duration since launch (relative time)
- [ ] Group cards by project
- [ ] Actions on each card:
  - Open detail → navigates to agent detail view
  - Terminate → confirmation, then calls terminate API
  - Quick input → inline text field, sends to agent

### New Agent Flow

- [ ] "New Agent" button → modal or inline form:
  - Select project (dropdown of active projects)
  - Optional initial prompt (text area)
  - Launch → calls API, new agent appears in dashboard

### Add Project Flow

- [ ] "Add Project" button → form:
  - Directory path text input
  - Submit → validates and stores via API
  - New project appears in sidebar/list

### Data Loading

- [ ] React Router loader fetches agents + projects on page load
- [ ] WebSocket updates agent cards in real-time (status changes, new messages)

## Acceptance

- Dashboard shows all agents grouped by project
- Can launch a new agent, see it appear, send it input, and terminate it
- Can add a new project from the dashboard
- All interactive elements meet 44×44px tap target minimum

## References

- Requirements: §1.4

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchiveView from '../ArchiveView'
import type { Task, Project, Link, ColumnHistory } from '../../../../shared/types/models'
import { TaskColumn } from '../../../../shared/types/enums'

const mockInvoke = vi.fn()
vi.stubGlobal('api', { invoke: mockInvoke })

// --- fixtures -----------------------------------------------------------

const project: Project = {
  id: 1,
  name: 'Test Project',
  colorPrimary: '#6366f1',
  colorAccent: '#818cf8',
  backgroundImage: null,
  priorityRank: 0,
  repoAssociations: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}

const task: Task = {
  id: 42,
  title: 'Write e2e tests',
  contextBlock: 'Used Playwright. Tests live in e2e/ directory.',
  column: TaskColumn.Review,
  projectId: 1,
  archived: true,
  columnChangedAt: '2024-01-05T12:00:00Z',
  lastTouchedAt: '2024-01-05T12:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-05T12:00:00Z'
}

const link: Link = {
  id: 10,
  taskId: 42,
  url: 'https://github.com/user/repo/pull/99',
  label: 'PR #99',
  sourceType: 'github_pr',
  isPrimary: true,
  createdAt: '2024-01-02T00:00:00Z'
}

const historyEntry: ColumnHistory = {
  id: 1,
  taskId: 42,
  fromColumn: TaskColumn.Planning,
  toColumn: TaskColumn.InProgress,
  contextSnapshot: 'Started implementation.',
  movedAt: '2024-01-03T10:00:00Z'
}

const historyEntry2: ColumnHistory = {
  id: 2,
  taskId: 42,
  fromColumn: TaskColumn.InProgress,
  toColumn: TaskColumn.Review,
  contextSnapshot: null,
  movedAt: '2024-01-05T12:00:00Z'
}

// Default mock: one archived task with full data
function setupDefaultMocks() {
  mockInvoke.mockImplementation((channel: string, args?: { taskId?: number }) => {
    if (channel === 'tasks:list') return Promise.resolve([task])
    if (channel === 'projects:list') return Promise.resolve([project])
    if (channel === 'links:list' && args?.taskId === 42) return Promise.resolve([link])
    if (channel === 'columnHistory:list' && args?.taskId === 42)
      return Promise.resolve([historyEntry, historyEntry2])
    return Promise.resolve([])
  })
}

// ---------------------------------------------------------------------------

describe('ArchiveView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty state', () => {
    it('shows "No completed tasks yet." when no archived tasks exist', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list') return Promise.resolve([])
        if (channel === 'projects:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument()
      })
    })
  })

  describe('Task list', () => {
    it('renders archived tasks in completion-date order', async () => {
      const olderTask: Task = {
        ...task,
        id: 43,
        title: 'Older task',
        updatedAt: '2023-12-01T00:00:00Z'
      }
      const newerTask: Task = {
        ...task,
        id: 44,
        title: 'Newer task',
        updatedAt: '2024-02-01T00:00:00Z'
      }

      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list') return Promise.resolve([olderTask, newerTask])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Newer task')).toBeInTheDocument()
      })

      const cards = screen.getAllByTestId('archived-task-card')
      expect(cards[0]).toHaveTextContent('Newer task')
      expect(cards[1]).toHaveTextContent('Older task')
    })

    it('renders task title and project name', async () => {
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('renders created and completed timestamps', async () => {
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      expect(screen.getByText(/Completed/)).toBeInTheDocument()
      expect(screen.getByText(/Created/)).toBeInTheDocument()
    })

    it('shows project color indicator dot', async () => {
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      // Color dot is an aria-hidden span with inline background-color style
      const card = screen
        .getByText('Write e2e tests')
        .closest('[data-testid="archived-task-card"]')
      const dot = card?.querySelector('[aria-hidden="true"][style*="background-color"]')
      expect(dot).toBeTruthy()
    })
  })

  describe('Expandable cards', () => {
    it('does not show context block before expanding', async () => {
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      expect(
        screen.queryByText('Used Playwright. Tests live in e2e/ directory.')
      ).not.toBeInTheDocument()
    })

    it('shows context block after expanding', async () => {
      const user = userEvent.setup()
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      const toggleBtn = screen.getByRole('button', { name: /write e2e tests/i })
      await user.click(toggleBtn)

      expect(
        screen.getByText('Used Playwright. Tests live in e2e/ directory.')
      ).toBeInTheDocument()
    })

    it('collapses again when clicked a second time', async () => {
      const user = userEvent.setup()
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      const toggleBtn = screen.getByRole('button', { name: /write e2e tests/i })
      await user.click(toggleBtn)
      expect(
        screen.getByText('Used Playwright. Tests live in e2e/ directory.')
      ).toBeInTheDocument()

      await user.click(toggleBtn)
      expect(
        screen.queryByText('Used Playwright. Tests live in e2e/ directory.')
      ).not.toBeInTheDocument()
    })
  })

  describe('Links', () => {
    it('renders links with correct href after expanding', async () => {
      const user = userEvent.setup()
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /write e2e tests/i }))

      const linkEl = screen.getByRole('link', { name: /PR #99/i })
      expect(linkEl).toHaveAttribute('href', 'https://github.com/user/repo/pull/99')
      expect(linkEl).toHaveAttribute('target', '_blank')
    })

    it('does not render links section when task has no links', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list') return Promise.resolve([task])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)
      await waitFor(() => expect(screen.getByText('Write e2e tests')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /write e2e tests/i }))

      // No links section heading
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('Column history', () => {
    it('renders column transition timeline after expanding', async () => {
      const user = userEvent.setup()
      setupDefaultMocks()
      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /write e2e tests/i }))

      // First entry: Planning → In Progress; second entry: In Progress → Review/Verify
      // "In Progress" appears twice (as destination of entry 1 and source of entry 2)
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getAllByText('In Progress')).toHaveLength(2)
      expect(screen.getByText('Review/Verify')).toBeInTheDocument()

      // Context snapshot from first entry
      expect(screen.getByText('Started implementation.')).toBeInTheDocument()
    })

    it('does not render history section when task has no history', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list') return Promise.resolve([task])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)
      await waitFor(() => expect(screen.getByText('Write e2e tests')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /write e2e tests/i }))

      expect(screen.queryByText('History')).not.toBeInTheDocument()
    })
  })

  describe('Search', () => {
    it('shows all tasks when search is empty', async () => {
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list')
          return Promise.resolve([
            { ...task, id: 1, title: 'Alpha task' },
            { ...task, id: 2, title: 'Beta task' }
          ])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Alpha task')).toBeInTheDocument()
      })
      expect(screen.getByText('Beta task')).toBeInTheDocument()
    })

    it('filters tasks by title', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list')
          return Promise.resolve([
            { ...task, id: 1, title: 'Alpha task' },
            { ...task, id: 2, title: 'Beta task' }
          ])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Alpha task')).toBeInTheDocument()
      })

      const searchInput = screen.getByRole('searchbox', {
        name: /search archived tasks/i
      })
      await user.type(searchInput, 'alpha')

      expect(screen.getByText('Alpha task')).toBeInTheDocument()
      expect(screen.queryByText('Beta task')).not.toBeInTheDocument()
    })

    it('filters tasks by context block content', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list')
          return Promise.resolve([
            {
              ...task,
              id: 1,
              title: 'Task One',
              contextBlock: 'database migration notes'
            },
            { ...task, id: 2, title: 'Task Two', contextBlock: 'frontend refactor notes' }
          ])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Task One')).toBeInTheDocument()
      })

      const searchInput = screen.getByRole('searchbox', {
        name: /search archived tasks/i
      })
      await user.type(searchInput, 'database')

      expect(screen.getByText('Task One')).toBeInTheDocument()
      expect(screen.queryByText('Task Two')).not.toBeInTheDocument()
    })

    it('shows "No tasks match your search." when search has no results', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list') return Promise.resolve([task])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Write e2e tests')).toBeInTheDocument()
      })

      const searchInput = screen.getByRole('searchbox', {
        name: /search archived tasks/i
      })
      await user.type(searchInput, 'xyzzy123')

      expect(screen.getByText('No tasks match your search.')).toBeInTheDocument()
    })

    it('search is case-insensitive', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:list')
          return Promise.resolve([{ ...task, id: 1, title: 'Refactor Auth Module' }])
        if (channel === 'projects:list') return Promise.resolve([project])
        if (channel === 'links:list') return Promise.resolve([])
        if (channel === 'columnHistory:list') return Promise.resolve([])
        return Promise.resolve([])
      })

      render(<ArchiveView />)

      await waitFor(() => {
        expect(screen.getByText('Refactor Auth Module')).toBeInTheDocument()
      })

      const searchInput = screen.getByRole('searchbox', {
        name: /search archived tasks/i
      })
      await user.type(searchInput, 'AUTH')

      expect(screen.getByText('Refactor Auth Module')).toBeInTheDocument()
    })
  })
})

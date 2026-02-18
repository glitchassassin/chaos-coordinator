/* eslint-disable @typescript-eslint/no-non-null-assertion -- DOM queries in tests */
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BoardView from '../BoardView'
import type { Project, Task } from '../../../../shared/types/models'
import { TaskColumn } from '../../../../shared/types/enums'
import { BOARD_PUSH_CHANNEL } from '../../../../shared/types/ipc'

const mockProject: Project = {
  id: 1,
  name: 'Test Project',
  colorPrimary: '#6366f1',
  colorAccent: '#818cf8',
  backgroundImage: null,
  priorityRank: 0,
  repoAssociations: ['myorg/myrepo'],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}

const baseTask: Task = {
  id: 10,
  title: 'https://github.com/myorg/myrepo/issues/42',
  contextBlock: null,
  column: TaskColumn.Backlog,
  projectId: 1,
  archived: false,
  columnChangedAt: '2024-01-01T00:00:00Z',
  lastTouchedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}

// Captures the callback registered for board:taskUpdated so tests can simulate push events
let boardTaskUpdatedCb: ((payload: { taskId: number; success: boolean }) => void) | null =
  null

const mockApi = {
  invoke: vi.fn(),
  on: vi.fn((channel: string, cb: (payload: unknown) => void) => {
    if (channel === BOARD_PUSH_CHANNEL) {
      boardTaskUpdatedCb = cb as (payload: { taskId: number; success: boolean }) => void
    }
  }),
  off: vi.fn()
}

function setupDefaultMocks(
  opts: {
    processTaskResult?: Promise<undefined>
    extraTasks?: Task[]
  } = {}
) {
  mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
    if (channel === 'projects:list') return Promise.resolve([mockProject])
    if (channel === 'tasks:list') return Promise.resolve(opts.extraTasks ?? [])
    if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
    if (channel === 'tasks:archive') return Promise.resolve(baseTask)
    if (channel === 'links:list') return Promise.resolve([])
    if (channel === 'intake:processTask') {
      void data // suppress unused warning
      return opts.processTaskResult ?? Promise.resolve(undefined)
    }
    return Promise.resolve(undefined)
  })
}

describe('BoardView URL auto-population', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    boardTaskUpdatedCb = null
    Object.defineProperty(window, 'api', {
      value: mockApi,
      writable: true,
      configurable: true
    })
  })

  it('URL paste calls tasks:create then intake:processTask', async () => {
    setupDefaultMocks()
    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    // tasks:create should be called with URL as title
    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('tasks:create', {
        title: 'https://github.com/myorg/myrepo/issues/42',
        projectId: 1,
        column: TaskColumn.Backlog
      })
    })

    // intake:processTask should be called with correct args
    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('intake:processTask', {
        url: 'https://github.com/myorg/myrepo/issues/42',
        taskId: 10,
        projectId: 1
      })
    })
  })

  it('shows loading indicator on card while intake:processTask is pending', async () => {
    let resolveProcess!: () => void
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:processTask')
        return new Promise<undefined>((r) => {
          resolveProcess = () => {
            r(undefined)
          }
        })
      return Promise.resolve(undefined)
    })

    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    // Loading indicator should appear
    await waitFor(() => {
      expect(screen.getByText('Fetching metadata…')).toBeVisible()
    })

    // Resolve to clean up
    act(() => {
      resolveProcess()
    })
  })

  it('board:taskUpdated with success:true clears loading and shows toast', async () => {
    setupDefaultMocks({ extraTasks: [baseTask] })
    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    // Wait for loading to appear
    await waitFor(() => {
      expect(screen.getByText('Fetching metadata…')).toBeVisible()
    })

    // Simulate push event from main process
    act(() => {
      boardTaskUpdatedCb!({ taskId: 10, success: true })
    })

    // Loading state should clear
    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })

    // Toast should appear
    await waitFor(() => {
      expect(screen.getByText('Task populated from URL')).toBeVisible()
    })
  })

  it('board:taskUpdated with success:false clears loading without toast', async () => {
    setupDefaultMocks({ extraTasks: [baseTask] })
    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('Fetching metadata…')).toBeVisible()
    })

    act(() => {
      boardTaskUpdatedCb!({ taskId: 10, success: false })
    })

    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })

    // No toast on failure
    expect(screen.queryByText('Task populated from URL')).toBeNull()
  })

  it('cancel archives the task and removes loading state', async () => {
    let resolveProcess!: () => void
    const invokes: Array<[string, unknown]> = []

    mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
      invokes.push([channel, data])
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'tasks:archive') return Promise.resolve(baseTask)
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:processTask')
        return new Promise<undefined>((r) => {
          resolveProcess = () => {
            r(undefined)
          }
        })
      return Promise.resolve(undefined)
    })

    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/99')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText('Fetching metadata…')).toBeVisible())

    const cancelBtn = screen.getByRole('button', { name: /Cancel fetch/i })
    await user.click(cancelBtn)

    await waitFor(() => {
      const archiveCall = invokes.find(([ch]) => ch === 'tasks:archive')
      expect(archiveCall).toBeDefined()
      expect((archiveCall![1] as { id: number }).id).toBe(10)
    })

    // Loading state clears immediately on cancel
    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })

    // Resolve to clean up
    act(() => {
      resolveProcess()
    })
  })

  it('delayed push event after cancel does not show stale toast', async () => {
    let resolveProcess!: () => void

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'tasks:archive') return Promise.resolve(baseTask)
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:processTask')
        return new Promise<undefined>((r) => {
          resolveProcess = () => {
            r(undefined)
          }
        })
      return Promise.resolve(undefined)
    })

    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText('Fetching metadata…')).toBeVisible())

    // Cancel the fetch
    const cancelBtn = screen.getByRole('button', { name: /Cancel fetch/i })
    await user.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })

    // Main process completes and sends a late success push event
    act(() => {
      boardTaskUpdatedCb!({ taskId: 10, success: true })
    })
    act(() => {
      resolveProcess()
    })

    // Toast must NOT appear — task was already cancelled
    expect(screen.queryByText('Task populated from URL')).toBeNull()
  })

  it('non-URL title creates task normally without calling intake:processTask', async () => {
    setupDefaultMocks()
    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'Plain task title')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('tasks:create', {
        title: 'Plain task title',
        projectId: 1,
        column: TaskColumn.Backlog
      })
    })

    expect(mockApi.invoke).not.toHaveBeenCalledWith(
      'intake:processTask',
      expect.anything()
    )
  })
})

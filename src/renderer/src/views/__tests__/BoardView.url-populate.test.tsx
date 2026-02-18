/* eslint-disable @typescript-eslint/no-non-null-assertion -- DOM queries in tests */
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BoardView from '../BoardView'
import type { Project, Task, Link } from '../../../../shared/types/models'
import { TaskColumn } from '../../../../shared/types/enums'

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

const mockApi = { invoke: vi.fn() }

// Track invoke calls for assertions (async-safe)
let allInvokes: Array<[string, unknown]> = []

function setupDefaultMocks(
  opts: {
    fetchMetadataResult?: {
      title: string
      contextBlock: string
      sourceType: Link['sourceType']
      repoKey: string | null
      matchedProjectId: number | null
    } | null
    fetchMetadataError?: boolean
    extraTasks?: Task[]
  } = {}
) {
  allInvokes = []

  mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
    allInvokes.push([channel, data])

    if (channel === 'projects:list') return Promise.resolve([mockProject])

    if (channel === 'tasks:list') {
      // Return the created task if it's in extraTasks, else empty
      return Promise.resolve(opts.extraTasks ?? [])
    }

    if (channel === 'tasks:create') {
      return Promise.resolve({ ...baseTask, id: 10 })
    }

    if (channel === 'tasks:update') return Promise.resolve(baseTask)
    if (channel === 'tasks:archive') return Promise.resolve(baseTask)
    if (channel === 'links:create') {
      return Promise.resolve({
        id: 99,
        taskId: 10,
        url: '',
        label: null,
        sourceType: 'other',
        isPrimary: true,
        createdAt: ''
      })
    }
    if (channel === 'links:list') return Promise.resolve([])

    if (channel === 'intake:fetchMetadata') {
      if (opts.fetchMetadataError) {
        return Promise.reject(new Error('LLM failed'))
      }
      return Promise.resolve(
        opts.fetchMetadataResult !== undefined
          ? opts.fetchMetadataResult
          : {
              title: 'Fix the bug',
              contextBlock: 'Some context',
              sourceType: 'github_issue',
              repoKey: 'myorg/myrepo',
              matchedProjectId: null
            }
      )
    }

    return Promise.resolve(undefined)
  })
}

describe('BoardView URL auto-population', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    allInvokes = []
    Object.defineProperty(window, 'api', {
      value: mockApi,
      writable: true,
      configurable: true
    })
  })

  it('URL paste triggers intake:fetchMetadata and creates task immediately', async () => {
    setupDefaultMocks()
    render(<BoardView />)

    // Wait for board to load
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    // Click the "+ Add" button in the first column (Backlog)
    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    // Type a GitHub issue URL
    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    // tasks:create should be called with the URL as title
    await waitFor(() => {
      const createCall = allInvokes.find(([ch]) => ch === 'tasks:create')
      expect(createCall).toBeDefined()
      expect((createCall![1] as { title: string }).title).toBe(
        'https://github.com/myorg/myrepo/issues/42'
      )
    })

    // intake:fetchMetadata should be called
    await waitFor(() => {
      const fetchCall = allInvokes.find(([ch]) => ch === 'intake:fetchMetadata')
      expect(fetchCall).toBeDefined()
      expect((fetchCall![1] as { url: string }).url).toBe(
        'https://github.com/myorg/myrepo/issues/42'
      )
    })
  })

  it('shows loading indicator on card while fetching', async () => {
    // Make intake:fetchMetadata pend indefinitely so loading state is visible
    let resolveFetch!: (v: unknown) => void
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'tasks:update') return Promise.resolve(baseTask)
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:fetchMetadata')
        return new Promise((r) => {
          resolveFetch = r
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
      resolveFetch(null)
    })
  })

  it('cancel archives the task and removes loading state', async () => {
    let resolveFetch!: (v: unknown) => void
    const invokes: Array<[string, unknown]> = []

    mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
      invokes.push([channel, data])
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'tasks:archive') return Promise.resolve(baseTask)
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:fetchMetadata')
        return new Promise((r) => {
          resolveFetch = r
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

    // Click the cancel button
    const cancelBtn = screen.getByRole('button', { name: /Cancel fetch/i })
    await user.click(cancelBtn)

    await waitFor(() => {
      const archiveCall = invokes.find(([ch]) => ch === 'tasks:archive')
      expect(archiveCall).toBeDefined()
      expect((archiveCall![1] as { id: number }).id).toBe(10)
    })

    // Loading state clears
    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })

    // Resolve to clean up (result should be dropped since task was cancelled)
    act(() => {
      resolveFetch(null)
    })
  })

  it('on success: tasks:update called with title and contextBlock, links:create called', async () => {
    mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
      allInvokes.push([channel, data])
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([baseTask])
      if (channel === 'tasks:create') return Promise.resolve({ ...baseTask, id: 10 })
      if (channel === 'tasks:update') return Promise.resolve(baseTask)
      if (channel === 'links:create') return Promise.resolve({ id: 99 })
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:fetchMetadata') {
        return Promise.resolve({
          title: 'Fix the bug',
          contextBlock: 'Context summary',
          sourceType: 'github_issue',
          repoKey: 'myorg/myrepo',
          matchedProjectId: null
        })
      }
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

    await waitFor(() => {
      const updateCall = allInvokes.find(([ch]) => ch === 'tasks:update')
      expect(updateCall).toBeDefined()
      const updateData = updateCall![1] as {
        id: number
        title: string
        contextBlock: string
      }
      expect(updateData.title).toBe('Fix the bug')
      expect(updateData.contextBlock).toBe('Context summary')
    })

    await waitFor(() => {
      const linkCall = allInvokes.find(([ch]) => ch === 'links:create')
      expect(linkCall).toBeDefined()
      const linkData = linkCall![1] as {
        url: string
        sourceType: string
        isPrimary: boolean
      }
      expect(linkData.url).toBe('https://github.com/myorg/myrepo/issues/42')
      expect(linkData.sourceType).toBe('github_issue')
      expect(linkData.isPrimary).toBe(true)
    })
  })

  it('on failure (null result): tasks:update NOT called, loading state clears', async () => {
    setupDefaultMocks({ fetchMetadataResult: null })

    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://github.com/myorg/myrepo/issues/42')
    await user.keyboard('{Enter}')

    // Wait for fetch to complete
    await waitFor(() => {
      const fetchCall = allInvokes.find(([ch]) => ch === 'intake:fetchMetadata')
      expect(fetchCall).toBeDefined()
    })

    // tasks:update should NOT be called
    await waitFor(() => {
      const updateCall = allInvokes.find(([ch]) => ch === 'tasks:update')
      expect(updateCall).toBeUndefined()
    })

    // Loading state should clear
    await waitFor(() => {
      expect(screen.queryByText('Fetching metadata…')).toBeNull()
    })
  })

  it('generic URL: intake:fetchMetadata is called but returns immediately with URL as title', async () => {
    mockApi.invoke.mockImplementation((channel: string, data?: unknown) => {
      allInvokes.push([channel, data])
      if (channel === 'projects:list') return Promise.resolve([mockProject])
      if (channel === 'tasks:list') return Promise.resolve([])
      if (channel === 'tasks:create')
        return Promise.resolve({ ...baseTask, id: 10, title: 'https://example.com/foo' })
      if (channel === 'tasks:update') return Promise.resolve(baseTask)
      if (channel === 'links:create') return Promise.resolve({ id: 99 })
      if (channel === 'links:list') return Promise.resolve([])
      if (channel === 'intake:fetchMetadata') {
        return Promise.resolve({
          title: 'https://example.com/foo',
          contextBlock: '',
          sourceType: 'other',
          repoKey: null,
          matchedProjectId: null
        })
      }
      return Promise.resolve(undefined)
    })

    render(<BoardView />)
    await waitFor(() => expect(screen.getByText('Test Project')).toBeVisible())

    const addBtn = screen.getByRole('button', {
      name: /Add task to Test Project Backlog/i
    })
    await user.click(addBtn)

    const input = screen.getByRole('textbox', { name: /New task title/i })
    await user.type(input, 'https://example.com/foo')
    await user.keyboard('{Enter}')

    // intake:fetchMetadata IS called for generic URLs
    await waitFor(() => {
      const fetchCall = allInvokes.find(([ch]) => ch === 'intake:fetchMetadata')
      expect(fetchCall).toBeDefined()
    })

    // tasks:create was called with URL as title
    const createCall = allInvokes.find(([ch]) => ch === 'tasks:create')
    expect(createCall).toBeDefined()
    expect((createCall![1] as { title: string }).title).toBe('https://example.com/foo')
  })
})

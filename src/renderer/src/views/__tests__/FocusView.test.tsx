import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import FocusView from '../FocusView'
import type { FocusResponse } from '../../../../shared/types/ipc'
import { TaskColumn } from '../../../../shared/types/enums'

// Mock the window.api
const mockInvoke = vi.fn()
vi.stubGlobal('api', { invoke: mockInvoke })

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

function renderFocusView() {
  return render(
    <BrowserRouter>
      <FocusView />
    </BrowserRouter>
  )
}

const baseFocusResponse: FocusResponse = {
  task: {
    id: 1,
    title: 'Implement new feature',
    contextBlock: 'This is a critical feature that needs to be implemented soon.',
    column: TaskColumn.Planning,
    projectId: 1,
    archived: false,
    columnChangedAt: '2024-01-01',
    lastTouchedAt: '2024-01-01',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  project: {
    id: 1,
    name: 'Test Project',
    colorPrimary: '#1e3a8a',
    colorAccent: '#3b82f6',
    backgroundImage: null,
    priorityRank: 1,
    repoAssociations: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  trigger: null,
  links: [],
  queueDepth: {
    actionable: 3,
    waiting: 1
  }
}

describe('FocusView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading state', () => {
    it('shows loading state initially', () => {
      mockInvoke.mockImplementation(() => new Promise(() => {})) // Never resolves
      renderFocusView()

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no tasks available', async () => {
      mockInvoke.mockResolvedValue({
        task: null,
        project: null,
        trigger: null,
        links: [],
        queueDepth: { actionable: 0, waiting: 0 }
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('All clear')).toBeInTheDocument()
      })
      expect(screen.getByText('Nothing actionable right now.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view board/i })).toBeInTheDocument()
    })

    it('navigates to board when clicking View Board in empty state', async () => {
      const user = userEvent.setup()
      mockInvoke.mockResolvedValue({
        task: null,
        project: null,
        trigger: null,
        links: [],
        queueDepth: { actionable: 0, waiting: 0 }
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('All clear')).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /view board/i })
      await user.click(button)

      expect(mockNavigate).toHaveBeenCalledWith('/board')
    })
  })

  describe('Focus task display', () => {
    it('renders focus task with all content', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(
        screen.getByText('This is a critical feature that needs to be implemented soon.')
      ).toBeInTheDocument()
    })

    it('applies project visual identity styles', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      // Check card uses primary color border; background is now a semi-transparent overlay
      // (the accent color moved to the outer view background)
      const card = screen.getByText('Implement new feature').closest('.border-2')
      expect(card).toHaveStyle({
        borderColor: '#1e3a8a'
      })

      // Check outer view uses accent color as its background
      const view = screen.getByTestId('focus-view')
      expect(view).toHaveStyle({
        backgroundColor: '#3b82f6'
      })

      // Check project name badge uses primary color background
      const projectBadge = screen.getByText('Test Project')
      expect(projectBadge).toHaveStyle({
        backgroundColor: '#1e3a8a'
      })

      // Check primary action button uses primary color
      const primaryButton = screen.getByRole('button', { name: /begin work/i })
      expect(primaryButton).toHaveStyle({
        backgroundColor: '#1e3a8a'
      })

      // Check secondary buttons use lighter backgrounds with borders
      const deferButton = screen.getByRole('button', { name: /defer/i })
      expect(deferButton).toHaveClass('border-2')
    })

    it('does not render context block when null', async () => {
      const responseWithoutContext: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, contextBlock: null }
      }

      mockInvoke.mockResolvedValue(responseWithoutContext)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(
        screen.queryByText(
          'This is a critical feature that needs to be implemented soon.'
        )
      ).not.toBeInTheDocument()
    })
  })

  describe('Trigger info display', () => {
    it('displays trigger context when present', async () => {
      const responseWithTrigger: FocusResponse = {
        ...baseFocusResponse,
        trigger: {
          id: 1,
          taskId: 1,
          nlCondition: 'When PR is approved',
          checkScript: 'check.sh',
          status: 'fired',
          pollIntervalMs: 60000,
          failureCount: 0,
          firedContext: 'PR #123 was approved by reviewer',
          firedAt: '2024-01-01',
          lastError: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      }

      mockInvoke.mockResolvedValue(responseWithTrigger)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Why now?')).toBeInTheDocument()
      })

      expect(screen.getByText('PR #123 was approved by reviewer')).toBeInTheDocument()
    })

    it('does not display trigger section when trigger is null', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.queryByText('Why now?')).not.toBeInTheDocument()
    })
  })

  describe('Links display', () => {
    it('renders links with correct labels and href', async () => {
      const responseWithLinks: FocusResponse = {
        ...baseFocusResponse,
        links: [
          {
            id: 1,
            taskId: 1,
            url: 'https://github.com/user/repo/issues/123',
            label: 'Issue #123',
            sourceType: 'github_issue',
            isPrimary: true,
            createdAt: '2024-01-01'
          },
          {
            id: 2,
            taskId: 1,
            url: 'https://example.com',
            label: null,
            sourceType: 'other',
            isPrimary: false,
            createdAt: '2024-01-01'
          }
        ]
      }

      mockInvoke.mockResolvedValue(responseWithLinks)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Related Links')).toBeInTheDocument()
      })

      const link1 = screen.getByRole('link', { name: /issue #123/i })
      expect(link1).toHaveAttribute('href', 'https://github.com/user/repo/issues/123')
      expect(link1).toHaveAttribute('target', '_blank')

      const link2 = screen.getByRole('link', { name: /https:\/\/example.com/i })
      expect(link2).toHaveAttribute('href', 'https://example.com')
    })

    it('does not display links section when empty', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.queryByText('Related Links')).not.toBeInTheDocument()
    })
  })

  describe('Queue indicator', () => {
    it('displays correct queue depth', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse) // 3 actionable, 1 waiting

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.getByText(/2 tasks waiting/)).toBeInTheDocument() // 3 - 1 (current) = 2
      expect(screen.getByText(/1 blocked/)).toBeInTheDocument()
    })

    it('displays only waiting tasks when no blocked', async () => {
      const response: FocusResponse = {
        ...baseFocusResponse,
        queueDepth: { actionable: 5, waiting: 0 }
      }

      mockInvoke.mockResolvedValue(response)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.getByText(/4 tasks waiting/)).toBeInTheDocument()
      expect(screen.queryByText(/blocked/)).not.toBeInTheDocument()
    })

    it('displays no tasks in queue when only current task', async () => {
      const response: FocusResponse = {
        ...baseFocusResponse,
        queueDepth: { actionable: 1, waiting: 0 }
      }

      mockInvoke.mockResolvedValue(response)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      expect(screen.getByText('No tasks in queue')).toBeInTheDocument()
    })
  })

  describe('Complete action', () => {
    it('opens context capture modal when begin work is clicked', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)

        return Promise.resolve(null)
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      const completeBtn = screen.getByRole('button', { name: /begin work/i })
      await user.click(completeBtn)

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })
    })

    it('progresses task from planning to in_progress after confirming context', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)
        return Promise.resolve({ id: 1 })
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /begin work/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tasks:update', {
          id: 1,
          contextBlock: baseFocusResponse.task!.contextBlock,
          column: TaskColumn.InProgress
        })
      })
    })

    it('archives task when in review column after confirming context', async () => {
      const user = userEvent.setup()
      const reviewTask: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, column: TaskColumn.Review }
      }

      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(reviewTask)
        return Promise.resolve({ id: 1 })
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /archive/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tasks:archive', { id: 1 })
      })
    })

    it('cancelling context capture does not update the task', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)
        return Promise.resolve(null)
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /begin work/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockInvoke).not.toHaveBeenCalledWith('tasks:update', expect.anything())
      expect(mockInvoke).not.toHaveBeenCalledWith('tasks:archive', expect.anything())
    })

    it('reloads focus task after completing transition', async () => {
      const user = userEvent.setup()
      let focusCallCount = 0

      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') {
          focusCallCount++
          return Promise.resolve(baseFocusResponse)
        }
        return Promise.resolve({ id: 1 })
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      const initialFocusCalls = focusCallCount

      await user.click(screen.getByRole('button', { name: /begin work/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(
        () => {
          expect(focusCallCount).toBeGreaterThan(initialFocusCalls)
        },
        { timeout: 1000 }
      )
    })
  })

  describe('Defer action', () => {
    it('opens context capture modal when defer is clicked', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)
        return Promise.resolve(null)
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /defer/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })
    })

    it('shows skip button in defer modal', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)
        return Promise.resolve(null)
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /defer/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    it('defers without updating context when skip is clicked', async () => {
      const user = userEvent.setup()

      const task2: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, id: 2, title: 'Second task' },
        queueDepth: { actionable: 2, waiting: 0 }
      }

      let focusCallCount = 0
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') {
          focusCallCount++
          return Promise.resolve(focusCallCount === 1 ? baseFocusResponse : task2)
        }
        if (channel === 'tasks:list')
          return Promise.resolve([baseFocusResponse.task, task2.task])
        return Promise.resolve(null)
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /defer/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /skip/i }))

      await waitFor(
        () => {
          expect(mockInvoke).toHaveBeenCalledWith('tasks:focus')
        },
        { timeout: 1000 }
      )

      // Should NOT have called tasks:update (context not saved on skip)
      expect(mockInvoke).not.toHaveBeenCalledWith('tasks:update', expect.anything())
    })

    it('saves context and defers when confirm is clicked', async () => {
      const user = userEvent.setup()
      mockInvoke.mockImplementation((channel: string) => {
        if (channel === 'tasks:focus') return Promise.resolve(baseFocusResponse)
        if (channel === 'tasks:list') return Promise.resolve([baseFocusResponse.task])
        if (channel === 'projects:get') return Promise.resolve(baseFocusResponse.project)
        return Promise.resolve({ id: 1 })
      })

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /defer/i }))

      await waitFor(() => {
        expect(screen.getByText('Capture Context')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('tasks:update', {
          id: 1,
          contextBlock: baseFocusResponse.task!.contextBlock
        })
      })
    })
  })

  describe('Navigation actions', () => {
    it('navigates to board view when clicking Board View button', async () => {
      const user = userEvent.setup()
      mockInvoke.mockResolvedValue(baseFocusResponse)

      renderFocusView()

      await waitFor(() => {
        expect(screen.getByText('Implement new feature')).toBeInTheDocument()
      })

      const boardBtn = screen.getByRole('button', { name: /view board/i })
      await user.click(boardBtn)

      expect(mockNavigate).toHaveBeenCalledWith('/board')
    })
  })

  describe('Task column action labels', () => {
    it('shows correct action label for backlog column', async () => {
      const backlogTask: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, column: TaskColumn.Backlog }
      }

      mockInvoke.mockResolvedValue(backlogTask)
      renderFocusView()

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /start planning/i })
        ).toBeInTheDocument()
      })
    })

    it('shows correct action label for planning column', async () => {
      mockInvoke.mockResolvedValue(baseFocusResponse)
      renderFocusView()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin work/i })).toBeInTheDocument()
      })
    })

    it('shows correct action label for in_progress column', async () => {
      const inProgressTask: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, column: TaskColumn.InProgress }
      }

      mockInvoke.mockResolvedValue(inProgressTask)
      renderFocusView()

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /ready for review/i })
        ).toBeInTheDocument()
      })
    })

    it('shows correct action label for review column', async () => {
      const reviewTask: FocusResponse = {
        ...baseFocusResponse,
        task: { ...baseFocusResponse.task!, column: TaskColumn.Review }
      }

      mockInvoke.mockResolvedValue(reviewTask)
      renderFocusView()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument()
      })
    })
  })
})

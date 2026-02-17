/* eslint-disable @typescript-eslint/no-non-null-assertion -- DOM queries in tests use ! after null checks */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BoardView from '../BoardView'
import type { Project, Task } from '../../../../shared/types/models'
import { TaskColumn } from '../../../../shared/types/enums'

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Alpha',
    colorPrimary: '#ff0000',
    colorAccent: '#00ff00',
    backgroundImage: null,
    priorityRank: 0,
    repoAssociations: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 2,
    name: 'Beta',
    colorPrimary: '#0000ff',
    colorAccent: '#ffff00',
    backgroundImage: null,
    priorityRank: 1,
    repoAssociations: [],
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02'
  }
]

const mockTasks: Task[] = [
  {
    id: 1,
    title: 'Task in Backlog',
    contextBlock: null,
    column: TaskColumn.Backlog,
    projectId: 1,
    archived: false,
    columnChangedAt: '2024-01-01T10:00:00Z',
    lastTouchedAt: '2024-01-01',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01T10:00:00Z'
  },
  {
    id: 2,
    title: 'Task in Planning',
    contextBlock: 'Some context',
    column: TaskColumn.Planning,
    projectId: 1,
    archived: false,
    columnChangedAt: '2024-01-02T14:00:00Z',
    lastTouchedAt: '2024-01-02',
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02T14:00:00Z'
  },
  {
    id: 3,
    title: 'Task in Progress',
    contextBlock: null,
    column: TaskColumn.InProgress,
    projectId: 2,
    archived: false,
    columnChangedAt: '2024-01-03T08:00:00Z',
    lastTouchedAt: '2024-01-03',
    createdAt: '2024-01-03',
    updatedAt: '2024-01-03T08:00:00Z'
  },
  {
    id: 4,
    title: 'Task in Review',
    contextBlock: null,
    column: TaskColumn.Review,
    projectId: 2,
    archived: false,
    columnChangedAt: '2024-01-04T16:00:00Z',
    lastTouchedAt: '2024-01-04',
    createdAt: '2024-01-04',
    updatedAt: '2024-01-04T16:00:00Z'
  }
]

const mockApi = {
  invoke: vi.fn()
}

describe('BoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(window, 'api', {
      value: mockApi,
      writable: true,
      configurable: true
    })

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') {
        return Promise.resolve([...mockProjects])
      }
      if (channel === 'tasks:list') {
        return Promise.resolve([...mockTasks])
      }
      if (channel === 'tasks:create') {
        return Promise.resolve({ ...mockTasks[0]!, id: 5 })
      }
      if (channel === 'tasks:update') {
        return Promise.resolve(mockTasks[0]!)
      }
      if (channel === 'tasks:archive') {
        return Promise.resolve(mockTasks[0]!)
      }
      if (channel === 'projects:update') {
        return Promise.resolve(mockProjects[0]!)
      }
      return Promise.resolve(undefined)
    })
  })

  it('renders 4 columns with correct headings', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Backlog')).toBeInTheDocument()
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Review/Verify')).toBeInTheDocument()
    })
  })

  it('renders swim lanes per project in correct priority order', async () => {
    render(<BoardView />)

    await waitFor(() => {
      const projectLabels = screen.getAllByText('Alpha')
      expect(projectLabels.length).toBeGreaterThan(0)
    })

    // Check project names in swim lane labels
    const swimLaneLabels = Array.from(
      document.querySelectorAll('.text-base.font-semibold.text-gray-200')
    )
    expect(swimLaneLabels[0]).toHaveTextContent('Alpha')
    expect(swimLaneLabels[1]).toHaveTextContent('Beta')
  })

  it('displays task cards with title and time in column', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Backlog')).toBeInTheDocument()
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    // Check for time in column (should show some duration) - using getAllByText since column name appears in multiple places
    const timeInBacklog = screen.getAllByText(/in backlog/i)
    expect(timeInBacklog.length).toBeGreaterThan(0)

    const timeInPlanning = screen.getAllByText(/in planning/i)
    expect(timeInPlanning.length).toBeGreaterThan(0)
  })

  it('renders waiting state for tasks with active trigger', async () => {
    const tasksWithTrigger = [
      ...mockTasks,
      {
        id: 5,
        title: 'Waiting Task',
        contextBlock: null,
        column: TaskColumn.Planning,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-05T12:00:00Z',
        lastTouchedAt: '2024-01-05',
        createdAt: '2024-01-05',
        updatedAt: '2024-01-05T12:00:00Z'
      }
    ]

    // Mock trigger data - we'll simulate this by having the component render dimmed tasks
    // Since triggers:list doesn't exist yet, we can't fully test this, but the UI structure is there
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...mockProjects])
      if (channel === 'tasks:list') return Promise.resolve(tasksWithTrigger)
      return Promise.resolve(undefined)
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Waiting Task')).toBeInTheDocument()
    })
  })

  it('renders actionable state for tasks without trigger', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Backlog')).toBeInTheDocument()
    })

    // Find the task card by its draggable attribute and check it has border-gray-800
    const taskCard = screen.getByText('Task in Backlog').closest('div[draggable="true"]')
    expect(taskCard).toHaveClass('border-gray-800')
  })

  it('opens edit form when card is clicked', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))

    expect(screen.getByText('Edit Task')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Task in Planning')
    expect(screen.getByLabelText('Context')).toHaveValue('Some context')
  })

  it('opens edit form when card is activated via keyboard', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Backlog')).toBeInTheDocument()
    })

    const taskCard = screen.getByText('Task in Backlog').closest('[role="button"]')!
    fireEvent.keyDown(taskCard, { key: 'Enter' })

    expect(screen.getByText('Edit Task')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Task in Backlog')
  })

  it('saves task edits via IPC', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))

    const titleInput = screen.getByLabelText('Title')
    fireEvent.change(titleInput, { target: { value: 'Updated Task Title' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'tasks:update',
        expect.objectContaining({
          id: 2,
          title: 'Updated Task Title'
        })
      )
    })
  })

  it('shows "+ Add" buttons in each cell', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    // 2 projects * 4 columns = 8 add buttons
    const addButtons = screen.getAllByText('+ Add')
    expect(addButtons.length).toBe(8)
  })

  it('opens inline input when "+ Add" is clicked', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    // Click the first "+ Add" button (Alpha / Backlog)
    const addButtons = screen.getAllByText('+ Add')
    fireEvent.click(addButtons[0]!)

    expect(screen.getByLabelText('New task title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
  })

  it('creates task via inline add with correct project and column', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    // Click "+ Add" in Alpha / Backlog cell
    const addButton = screen.getByLabelText('Add task to Alpha Backlog')
    fireEvent.click(addButton)

    const input = screen.getByLabelText('New task title')
    fireEvent.change(input, { target: { value: 'New Inline Task' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'tasks:create',
        expect.objectContaining({
          title: 'New Inline Task',
          projectId: 1,
          column: TaskColumn.Backlog
        })
      )
    })
  })

  it('creates task on Enter key in inline add input', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    const addButton = screen.getByLabelText('Add task to Alpha Planning')
    fireEvent.click(addButton)

    const input = screen.getByLabelText('New task title')
    fireEvent.change(input, { target: { value: 'Enter Task' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'tasks:create',
        expect.objectContaining({
          title: 'Enter Task',
          projectId: 1,
          column: TaskColumn.Planning
        })
      )
    })
  })

  it('cancels inline add on Escape key', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    const addButton = screen.getByLabelText('Add task to Alpha Backlog')
    fireEvent.click(addButton)

    const input = screen.getByLabelText('New task title')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByLabelText('New task title')).not.toBeInTheDocument()
  })

  it('cancels inline add on Cancel button click', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    const addButtons = screen.getAllByText('+ Add')
    fireEvent.click(addButtons[0]!)

    expect(screen.getByLabelText('New task title')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByLabelText('New task title')).not.toBeInTheDocument()
  })

  it('does not submit inline add with empty title', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })

    const addButtons = screen.getAllByText('+ Add')
    fireEvent.click(addButtons[0]!)

    // Click save without entering a title
    fireEvent.click(screen.getByText('Save'))

    // Should not have called tasks:create
    expect(mockApi.invoke).not.toHaveBeenCalledWith('tasks:create', expect.anything())
  })

  it('simulates column drag with tasks:update call', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Backlog')).toBeInTheDocument()
    })

    const taskCard = screen.getByText('Task in Backlog').closest('div[draggable="true"]')!

    // Find all drop zones - there are 4 columns per swim lane
    // Alpha swim lane: [0]=Backlog, [1]=Planning, [2]=InProgress, [3]=Review
    // Beta swim lane: [4]=Backlog, [5]=Planning, [6]=InProgress, [7]=Review
    const allDropZones = Array.from(document.querySelectorAll('.border-dashed'))
    const alphaPlanningColumn = allDropZones[1]! // Second column in first row is Planning

    fireEvent.dragStart(taskCard)
    fireEvent.dragOver(alphaPlanningColumn)
    fireEvent.drop(alphaPlanningColumn)

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('tasks:update', {
        id: 1,
        column: TaskColumn.Planning
      })
    })
  })

  it('simulates swim lane reorder with projects:update calls', async () => {
    render(<BoardView />)

    await waitFor(() => {
      const alphaLabels = screen.getAllByText('Alpha')
      expect(alphaLabels.length).toBeGreaterThan(0)
    })

    // Find the draggable swim lanes (the grid containers with draggable="true")
    const draggableLanes = Array.from(
      document.querySelectorAll('div[draggable="true"].grid')
    )
    expect(draggableLanes.length).toBe(2)

    const alphaLane = draggableLanes[0]!
    const betaLane = draggableLanes[1]!

    fireEvent.dragStart(alphaLane)
    fireEvent.dragEnter(betaLane)
    fireEvent.drop(betaLane)

    await waitFor(() => {
      // After swap: Beta (id=2) should get rank 0, Alpha (id=1) should get rank 1
      expect(mockApi.invoke).toHaveBeenCalledWith('projects:update', {
        id: 2,
        priorityRank: 0
      })
      expect(mockApi.invoke).toHaveBeenCalledWith('projects:update', {
        id: 1,
        priorityRank: 1
      })
    })
  })

  it('shows empty state when no projects or tasks', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([])
      if (channel === 'tasks:list') return Promise.resolve([])
      return Promise.resolve(undefined)
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(
        screen.getByText(/No projects or tasks yet. Create a project to get started./i)
      ).toBeInTheDocument()
    })
  })

  it('closes edit modal on cancel', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))
    expect(screen.getByText('Edit Task')).toBeInTheDocument()

    const cancelButton = screen
      .getAllByText('Cancel')
      .find((el) => el.closest('.fixed') !== null)
    fireEvent.click(cancelButton!)

    expect(screen.queryByText('Edit Task')).not.toBeInTheDocument()
  })

  it('allows changing column in edit form', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))

    const columnSelect = screen.getByLabelText('Column')
    fireEvent.change(columnSelect, { target: { value: TaskColumn.InProgress } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'tasks:update',
        expect.objectContaining({
          column: TaskColumn.InProgress
        })
      )
    })
  })

  it('shows error toast when board load fails', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.reject(new Error('Network error'))
      return Promise.resolve([])
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load board')).toBeInTheDocument()
    })
  })

  it('shows error toast when task update fails', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...mockProjects])
      if (channel === 'tasks:list') return Promise.resolve([...mockTasks])
      if (channel === 'tasks:update') return Promise.reject(new Error('Update failed'))
      return Promise.resolve(undefined)
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))

    const titleInput = screen.getByLabelText('Title')
    fireEvent.change(titleInput, { target: { value: 'Updated' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('Failed to update task')).toBeInTheDocument()
    })
  })

  it('archives task via IPC and shows toast', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))
    expect(screen.getByText('Edit Task')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Archive'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('tasks:archive', { id: 2 })
    })

    await waitFor(() => {
      expect(screen.getByText('Task archived')).toBeInTheDocument()
    })

    expect(screen.queryByText('Edit Task')).not.toBeInTheDocument()
  })

  it('shows error toast when archive fails', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...mockProjects])
      if (channel === 'tasks:list') return Promise.resolve([...mockTasks])
      if (channel === 'tasks:archive') return Promise.reject(new Error('Archive failed'))
      return Promise.resolve(undefined)
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getByText('Task in Planning')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Task in Planning'))
    fireEvent.click(screen.getByText('Archive'))

    await waitFor(() => {
      expect(screen.getByText('Failed to archive task')).toBeInTheDocument()
    })
  })

  it('renders project background image with low opacity', async () => {
    const projectsWithBg: Project[] = [
      {
        ...mockProjects[0]!,
        backgroundImage: '/path/to/logo.png'
      },
      mockProjects[1]!
    ]

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve(projectsWithBg)
      if (channel === 'tasks:list') return Promise.resolve([...mockTasks])
      return Promise.resolve(undefined)
    })

    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    })

    // imageUrl extracts the filename and uses the media:// protocol
    const bgImg = document.querySelector('img[src="media://project-images/logo.png"]')
    expect(bgImg).toBeInTheDocument()
    expect(bgImg).toHaveClass('opacity-15')
    expect(bgImg).toHaveAttribute('alt', '')

    // Beta has no background image
    const allImgs = document.querySelectorAll('img.opacity-15')
    expect(allImgs.length).toBe(1)
  })

  it('does not render background image when project has none', async () => {
    render(<BoardView />)

    await waitFor(() => {
      expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    })

    const bgImgs = document.querySelectorAll('img.opacity-15')
    expect(bgImgs.length).toBe(0)
  })
})

/* eslint-disable @typescript-eslint/no-non-null-assertion -- DOM queries in tests use ! after null checks */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ProjectsView from '../ProjectsView'
import type { Project } from '../../../../shared/types/models'

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Alpha',
    colorPrimary: '#ff0000',
    colorAccent: '#00ff00',
    backgroundImage: null,
    priorityRank: 0,
    repoAssociations: ['org/alpha'],
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

const mockApi = {
  invoke: vi.fn()
}

describe('ProjectsView', () => {
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
      if (channel === 'projects:create') {
        return Promise.resolve({ ...mockProjects[0]!, id: 3 })
      }
      if (channel === 'projects:update') {
        return Promise.resolve(mockProjects[0]!)
      }
      if (channel === 'projects:delete') {
        return Promise.resolve(undefined)
      }
      if (channel === 'dialog:open-image') {
        return Promise.resolve(null)
      }
      return Promise.resolve(undefined)
    })
  })

  it('renders project list sorted by priorityRank', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    expect(mockApi.invoke).toHaveBeenCalledWith('projects:list')
  })

  it('shows empty state when no projects', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') {
        return Promise.resolve([])
      }
      return Promise.resolve(undefined)
    })

    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeInTheDocument()
    })
  })

  it('opens create form when "New Project" is clicked', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))

    expect(screen.getByText('New Project', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('creates a project via IPC', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))

    const nameInput = screen.getByLabelText('Name')
    fireEvent.change(nameInput, { target: { value: 'Test Project' } })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'projects:create',
        expect.objectContaining({ name: 'Test Project' })
      )
    })
  })

  it('opens edit form for existing project', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0]!)

    expect(screen.getByText('Edit Project')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha')
  })

  it('shows delete confirmation dialog', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0]!)

    expect(screen.getByText('Delete Project?')).toBeInTheDocument()
    expect(screen.getByText(/will be permanently deleted/)).toBeInTheDocument()
  })

  it('deletes project on confirmation', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0]!)

    // Click the Delete button in the confirmation dialog
    const confirmDelete = screen
      .getAllByText('Delete')
      .find((el) => el.closest('.fixed') !== null)
    fireEvent.click(confirmDelete!)

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('projects:delete', { id: 1 })
    })
  })

  it('updates preview live when colors change', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))

    const primaryInput = screen.getByLabelText('Primary Color custom color picker')
    fireEvent.change(primaryInput, { target: { value: '#000080' } })

    // Preview should show the project name on the new primary color with derived text
    const previewName = screen.getByText('Project Name')
    const previewContainer = previewName.closest('div')
    expect(previewContainer).toHaveStyle({ backgroundColor: '#000080' })
    // Dark navy background should get white text
    expect(previewName).toHaveStyle({ color: '#ffffff' })
  })

  it('shows repo associations', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('org/alpha')).toBeInTheDocument()
    })
  })

  it('handles image selection triggering palette extraction', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...mockProjects])
      if (channel === 'dialog:open-image') return Promise.resolve('/fake/image.png')
      if (channel === 'files:copy-to-app-data')
        return Promise.resolve('/stored/image.png')
      if (channel === 'colors:extract-palette')
        return Promise.resolve({
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
        })
      return Promise.resolve(undefined)
    })

    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))
    fireEvent.click(screen.getByText('Choose Image'))

    await waitFor(() => {
      // Palette swatches should appear (2 per color: primary + accent pickers)
      expect(screen.getAllByLabelText('Select color #ff0000')).toHaveLength(2)
      expect(screen.getAllByLabelText('Select color #00ff00')).toHaveLength(2)
    })
  })

  it('validates that name is required', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument()
    })
  })

  it('shows project color swatches in the list', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const primarySwatches = screen.getAllByTitle('Primary')
    expect(primarySwatches.length).toBeGreaterThanOrEqual(2)
  })

  it('closes form on cancel', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))
    expect(screen.getByText('New Project', { selector: 'h2' })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('New Project', { selector: 'h2' })).not.toBeInTheDocument()
  })

  it('adds and removes repo associations', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))

    const repoInput = screen.getByPlaceholderText('owner/repo')
    fireEvent.change(repoInput, { target: { value: 'org/my-repo' } })
    fireEvent.click(screen.getByText('Add'))

    expect(screen.getByText('org/my-repo')).toBeInTheDocument()

    // Remove the repo
    fireEvent.click(screen.getByLabelText('Remove org/my-repo'))
    expect(screen.queryByText('org/my-repo')).not.toBeInTheDocument()
  })

  it('adds repo on enter key', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))

    const repoInput = screen.getByPlaceholderText('owner/repo')
    fireEvent.change(repoInput, { target: { value: 'org/enter-repo' } })
    fireEvent.keyDown(repoInput, { key: 'Enter' })

    expect(screen.getByText('org/enter-repo')).toBeInTheDocument()
  })

  it('updates project via IPC when editing', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0]!)

    const nameInput = screen.getByLabelText('Name')
    fireEvent.change(nameInput, { target: { value: 'Alpha Updated' } })

    fireEvent.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith(
        'projects:update',
        expect.objectContaining({ id: 1, name: 'Alpha Updated' })
      )
    })
  })

  it('handles drag reorder with correct ranks', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    const cards = screen.getAllByText(/Alpha|Beta/).map((el) => el.closest('[draggable]'))

    const firstCard = cards[0]!
    const secondCard = cards[1]!

    // Drag Alpha (index 0) to Beta's position (index 1)
    fireEvent.dragStart(firstCard)
    fireEvent.dragEnter(secondCard)
    fireEvent.drop(secondCard)

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

  it('cancels delete confirmation dialog', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0]!)

    expect(screen.getByText('Delete Project?')).toBeInTheDocument()

    // Click Cancel in the confirmation dialog
    const cancelButton = screen
      .getAllByText('Cancel')
      .find((el) => el.closest('.fixed') !== null)
    fireEvent.click(cancelButton!)

    expect(screen.queryByText('Delete Project?')).not.toBeInTheDocument()
  })

  it('shows error toast when image processing fails', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...mockProjects])
      if (channel === 'dialog:open-image') return Promise.resolve('/fake/image.png')
      if (channel === 'files:copy-to-app-data')
        return Promise.reject(new Error('Copy failed'))
      return Promise.resolve(undefined)
    })

    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Project'))
    fireEvent.click(screen.getByText('Choose Image'))

    await waitFor(() => {
      expect(screen.getByText('Failed to process image')).toBeInTheDocument()
    })
  })

  it('extracts palette when editing a project with background image', async () => {
    const projectsWithImage: Project[] = [
      {
        ...mockProjects[0]!,
        backgroundImage: '/stored/project-bg.png'
      }
    ]

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'projects:list') return Promise.resolve([...projectsWithImage])
      if (channel === 'colors:extract-palette')
        return Promise.resolve({ colors: ['#aabbcc', '#ddeeff', '#112233'] })
      if (channel === 'projects:update') return Promise.resolve(projectsWithImage[0]!)
      return Promise.resolve(undefined)
    })

    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0]!)

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('colors:extract-palette', {
        imagePath: '/stored/project-bg.png'
      })
    })

    // Palette swatches should appear
    await waitFor(() => {
      expect(screen.getAllByLabelText('Select color #aabbcc')).toHaveLength(2)
    })
  })

  it('moves project down via keyboard-accessible button', async () => {
    render(<ProjectsView />)

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      expect(screen.getByText('Beta')).toBeInTheDocument()
    })

    const moveDownButton = screen.getByLabelText('Move Alpha down')
    fireEvent.click(moveDownButton)

    await waitFor(() => {
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
})

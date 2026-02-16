import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'

// Mock window.api
const mockApi = {
  invoke: vi.fn()
}

describe('App', () => {
  beforeEach(() => {
    // Set up window.api mock
    Object.defineProperty(window, 'api', {
      value: mockApi,
      writable: true,
      configurable: true
    })

    // Default: LLM is configured
    mockApi.invoke.mockResolvedValue({ configured: true })
  })

  it('renders the layout with navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/focus']}>
        <App />
      </MemoryRouter>
    )

    // Wait for health check to complete
    await waitFor(() => {
      expect(screen.getByText('Chaos Coordinator')).toBeInTheDocument()
    })

    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows Focus View by default', async () => {
    // Mock empty focus response
    mockApi.invoke.mockImplementation((channel) => {
      if (channel === 'llm:checkHealth') {
        return Promise.resolve({ configured: true })
      }
      if (channel === 'tasks:focus') {
        return Promise.resolve({
          task: null,
          project: null,
          trigger: null,
          links: [],
          queueDepth: { actionable: 0, waiting: 0 }
        })
      }
      return Promise.resolve(null)
    })

    render(
      <MemoryRouter initialEntries={['/focus']}>
        <App />
      </MemoryRouter>
    )

    // Focus View now shows "All clear" when there are no tasks
    await waitFor(() => {
      expect(screen.getByText('All clear')).toBeInTheDocument()
    })
  })

  it('navigates to Board View', async () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Board' })).toBeInTheDocument()
    })
  })

  it('navigates to Archive View', async () => {
    render(
      <MemoryRouter initialEntries={['/archive']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Archive View')).toBeInTheDocument()
    })
  })
})

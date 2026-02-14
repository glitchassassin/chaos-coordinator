import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('App', () => {
  it('renders the layout with navigation', () => {
    render(
      <MemoryRouter initialEntries={['/focus']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Chaos Coordinator')).toBeInTheDocument()
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('Board')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('shows Focus View by default', () => {
    render(
      <MemoryRouter initialEntries={['/focus']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Focus View')).toBeInTheDocument()
  })

  it('navigates to Board View', () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Board View')).toBeInTheDocument()
  })

  it('navigates to Archive View', () => {
    render(
      <MemoryRouter initialEntries={['/archive']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Archive View')).toBeInTheDocument()
  })
})

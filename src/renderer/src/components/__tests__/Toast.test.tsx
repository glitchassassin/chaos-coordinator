import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ToastNotification from '../Toast'
import { useToast } from '../../hooks/useToast'

describe('ToastNotification', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(<ToastNotification toast={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders success toast with role="status"', () => {
    render(<ToastNotification toast={{ message: 'Saved', type: 'success' }} />)
    const el = screen.getByText('Saved')
    expect(el.closest('[role="status"]')).toBeInTheDocument()
  })

  it('renders error toast with role="alert"', () => {
    render(<ToastNotification toast={{ message: 'Failed', type: 'error' }} />)
    const el = screen.getByText('Failed')
    expect(el.closest('[role="alert"]')).toBeInTheDocument()
  })

  it('is fixed-position to avoid layout shift', () => {
    render(<ToastNotification toast={{ message: 'Test', type: 'success' }} />)
    const el = screen.getByRole('status')
    expect(el.className).toContain('fixed')
  })
})

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function TestHarness({ duration }: { duration?: number }) {
    const { toast, showToast } = useToast(duration)
    return (
      <div>
        <button
          onClick={() => {
            showToast('Hello', 'success')
          }}
        >
          Show Success
        </button>
        <button
          onClick={() => {
            showToast('Oops', 'error')
          }}
        >
          Show Error
        </button>
        <ToastNotification toast={toast} />
      </div>
    )
  }

  it('shows toast and auto-dismisses after duration', () => {
    render(<TestHarness duration={1000} />)

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()

    act(() => {
      screen.getByText('Show Success').click()
    })

    expect(screen.getByText('Hello')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('replaces previous toast when showing a new one', () => {
    render(<TestHarness />)

    act(() => {
      screen.getByText('Show Success').click()
    })
    expect(screen.getByText('Hello')).toBeInTheDocument()

    act(() => {
      screen.getByText('Show Error').click()
    })
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByText('Oops')).toBeInTheDocument()
  })

  it('defaults type to success', () => {
    function Minimal() {
      const { toast, showToast } = useToast()
      return (
        <div>
          <button
            onClick={() => {
              showToast('Done')
            }}
          >
            Show
          </button>
          <ToastNotification toast={toast} />
        </div>
      )
    }

    render(<Minimal />)
    act(() => {
      screen.getByText('Show').click()
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

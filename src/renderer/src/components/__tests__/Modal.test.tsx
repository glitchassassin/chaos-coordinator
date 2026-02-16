import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Modal from '../Modal'

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when inner content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    )
    fireEvent.click(screen.getByText('Content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps focus within the modal', () => {
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>
    )

    const first = screen.getByText('First')
    const last = screen.getByText('Last')

    // Focus last, then Tab — should wrap to first
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    // Focus first, then Shift+Tab — should wrap to last
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('focuses first focusable element on open', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <button type="button">Focusable</button>
      </Modal>
    )
    expect(document.activeElement).toBe(screen.getByText('Focusable'))
  })

  it('applies custom className to inner container', () => {
    render(
      <Modal open={true} onClose={vi.fn()} className="w-96 p-6">
        <p>Content</p>
      </Modal>
    )
    const inner = screen.getByText('Content').closest('.w-96')
    expect(inner).toBeInTheDocument()
  })
})

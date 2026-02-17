import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextCapture, { type TransitionType } from '../ContextCapture'
import type { Task } from '../../../../shared/types/models'
import { TaskColumn } from '../../../../shared/types/enums'

const mockInvoke = vi.fn()
vi.stubGlobal('api', { invoke: mockInvoke })

const baseTask: Task = {
  id: 1,
  title: 'Fix authentication bug',
  contextBlock: 'Started investigating the JWT token expiry issue.',
  column: TaskColumn.Planning,
  projectId: 1,
  archived: false,
  columnChangedAt: '2024-01-01',
  lastTouchedAt: '2024-01-01',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}

const defaultProps = {
  open: true,
  task: baseTask,
  fromColumn: TaskColumn.Planning as TaskColumn,
  toColumn: TaskColumn.InProgress as TaskColumn | 'archive',
  transitionType: 'phase' as TransitionType,
  onConfirm: vi.fn(),
  onSkip: vi.fn(),
  onCancel: vi.fn()
}

function renderContextCapture(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<ContextCapture {...props} />)
}

describe('ContextCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal renders', () => {
    it('shows the modal with task title when open', () => {
      renderContextCapture()

      expect(screen.getByText('Capture Context')).toBeInTheDocument()
      expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      renderContextCapture({ open: false })

      expect(screen.queryByText('Capture Context')).not.toBeInTheDocument()
    })

    it('pre-fills textarea with existing context block', () => {
      renderContextCapture()

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Started investigating the JWT token expiry issue.')
    })

    it('shows empty textarea when task has no context block', () => {
      const taskWithoutContext: Task = { ...baseTask, contextBlock: null }
      renderContextCapture({ task: taskWithoutContext })

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('')
    })

    it('shows phase transition label for phase type', () => {
      renderContextCapture({ transitionType: 'phase' })

      expect(screen.getByText(/Moving to next phase/)).toBeInTheDocument()
    })

    it('shows defer label for defer type', () => {
      renderContextCapture({ transitionType: 'defer' })

      expect(screen.getByText(/Deferring task/)).toBeInTheDocument()
    })
  })

  describe('Confirm action', () => {
    it('calls onConfirm with the existing context when confirm is clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderContextCapture({ onConfirm })

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      expect(onConfirm).toHaveBeenCalledWith(
        'Started investigating the JWT token expiry issue.'
      )
    })

    it('calls onConfirm with edited text after user modifies it', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderContextCapture({ onConfirm })

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'My custom context note.')

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      expect(onConfirm).toHaveBeenCalledWith('My custom context note.')
    })
  })

  describe('Phase transition', () => {
    it('does not show skip button for phase transition', () => {
      renderContextCapture({ transitionType: 'phase' })

      expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
    })

    it('shows confirm and cancel buttons', () => {
      renderContextCapture({ transitionType: 'phase' })

      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('Defer transition', () => {
    it('shows skip button for defer transition', () => {
      renderContextCapture({ transitionType: 'defer' })

      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    it('calls onSkip when skip is clicked', async () => {
      const user = userEvent.setup()
      const onSkip = vi.fn()
      renderContextCapture({ transitionType: 'defer', onSkip })

      await user.click(screen.getByRole('button', { name: /skip/i }))

      expect(onSkip).toHaveBeenCalled()
    })

    it('does not call onConfirm when skip is clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      renderContextCapture({ transitionType: 'defer', onConfirm })

      await user.click(screen.getByRole('button', { name: /skip/i }))

      expect(onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Cancel action', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      renderContextCapture({ onCancel })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('calls onCancel when Escape key is pressed', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      renderContextCapture({ onCancel })

      await user.keyboard('{Escape}')

      expect(onCancel).toHaveBeenCalled()
    })
  })
})

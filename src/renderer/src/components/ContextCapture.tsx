import { useEffect, useState } from 'react'
import Modal from './Modal'
import type { Task } from '../../../shared/types/models'
import type { TaskColumn } from '../../../shared/types/enums'

export type TransitionType = 'phase' | 'defer' | 'preempt'

interface ContextCaptureProps {
  open: boolean
  task: Task
  fromColumn: TaskColumn
  toColumn: TaskColumn | 'archive'
  transitionType: TransitionType
  /** Called with the (possibly edited) context text. Caller proceeds with the transition. */
  onConfirm: (contextBlock: string) => void
  /** Defer only: skip capturing context and proceed with defer unchanged. */
  onSkip: () => void
  /** Abort the transition entirely. */
  onCancel: () => void
}

const TRANSITION_LABELS: Record<TransitionType, string> = {
  phase: 'Moving to next phase',
  defer: 'Deferring task',
  preempt: 'Switching tasks'
}

export default function ContextCapture({
  open,
  task,
  transitionType,
  onConfirm,
  onSkip,
  onCancel
}: ContextCaptureProps) {
  const [contextText, setContextText] = useState('')

  // Pre-fill with existing context whenever the modal opens
  useEffect(() => {
    if (!open) return
    setContextText(task.contextBlock ?? '')
  }, [open, task.contextBlock])

  const label = TRANSITION_LABELS[transitionType]

  return (
    <Modal open={open} onClose={onCancel} className="w-[36rem] p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Capture Context</h2>
          <p className="mt-1 text-sm text-gray-400">
            {label} — update your context snapshot before continuing.
          </p>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
          <div className="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Task
          </div>
          <div className="text-sm font-medium text-gray-200">{task.title}</div>
        </div>

        <div>
          <label
            htmlFor="context-capture-text"
            className="mb-1 block text-sm font-medium text-gray-300"
          >
            Context snapshot
          </label>
          <textarea
            id="context-capture-text"
            value={contextText}
            onChange={(e) => {
              setContextText(e.target.value)
            }}
            rows={6}
            placeholder="Describe where you left off…"
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {transitionType === 'defer' && (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onConfirm(contextText)
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

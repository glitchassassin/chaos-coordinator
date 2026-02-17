import { useEffect, useState } from 'react'
import Modal from './Modal'
import type { Task, Project } from '../../../shared/types/models'
import type { TaskColumn } from '../../../shared/types/enums'
import { textColorOn } from '../../../shared/lib/color-utils'

export type TransitionType = 'phase' | 'defer' | 'preempt'

interface ContextCaptureProps {
  open: boolean
  task: Task
  fromColumn: TaskColumn
  toColumn: TaskColumn | 'archive'
  transitionType: TransitionType
  /** When provided, styles the dialog to match the project's color scheme. */
  project?: Project
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
  project,
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

  // Project-derived color tokens (fall back to neutral grays when no project)
  const accentTextColor = project ? textColorOn(project.colorAccent) : '#e5e7eb'
  const primaryTextColor = project ? textColorOn(project.colorPrimary) : '#ffffff'
  const tintedBg = accentTextColor === '#ffffff' ? '#00000020' : '#ffffff20'
  const tintedBorder = accentTextColor === '#ffffff' ? '#ffffff40' : '#00000040'

  const modalStyle = project
    ? {
        backgroundColor: project.colorAccent + 'e6',
        borderWidth: '2px',
        borderStyle: 'solid' as const,
        borderColor: project.colorPrimary,
        color: accentTextColor
      }
    : undefined

  return (
    <Modal
      open={open}
      onClose={onCancel}
      className="w-[36rem] p-6"
      style={modalStyle ?? {}}
    >
      <div className="space-y-4">
        <div>
          <h2
            className="text-lg font-semibold"
            style={project ? { color: accentTextColor } : { color: '#e5e7eb' }}
          >
            Capture Context
          </h2>
          <p
            className="mt-1 text-sm"
            style={
              project ? { color: accentTextColor, opacity: 0.7 } : { color: '#9ca3af' }
            }
          >
            {label} — update your context snapshot before continuing.
          </p>
        </div>

        <div
          className="rounded-lg p-3"
          style={
            project
              ? { backgroundColor: tintedBg }
              : { backgroundColor: '#1f2937', border: '1px solid #374151' }
          }
        >
          <div
            className="mb-1 text-xs font-medium tracking-wide uppercase"
            style={
              project ? { color: accentTextColor, opacity: 0.6 } : { color: '#6b7280' }
            }
          >
            Task
          </div>
          <div
            className="text-sm font-medium"
            style={project ? { color: accentTextColor } : { color: '#e5e7eb' }}
          >
            {task.title}
          </div>
        </div>

        <div>
          <label
            htmlFor="context-capture-text"
            className="mb-1 block text-sm font-medium"
            style={project ? { color: accentTextColor } : { color: '#d1d5db' }}
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
            className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${project ? 'placeholder:opacity-40' : 'placeholder-gray-600'}`}
            style={
              project
                ? {
                    backgroundColor: tintedBg,
                    border: `1px solid ${tintedBorder}`,
                    color: accentTextColor
                  }
                : {
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    color: '#f3f4f6'
                  }
            }
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-70"
            style={project ? { color: accentTextColor } : { color: '#9ca3af' }}
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {transitionType === 'defer' && (
              <button
                type="button"
                onClick={onSkip}
                className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={
                  project
                    ? {
                        borderColor: tintedBorder,
                        backgroundColor: tintedBg,
                        color: accentTextColor
                      }
                    : { borderColor: '#374151', color: '#d1d5db' }
                }
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onConfirm(contextText)
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={
                project
                  ? { backgroundColor: project.colorPrimary, color: primaryTextColor }
                  : { backgroundColor: '#4f46e5', color: '#ffffff' }
              }
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

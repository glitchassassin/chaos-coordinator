import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { Task, Project, Trigger, Link } from '../../../shared/types/models'
import { TaskColumn } from '../../../shared/types/enums'
import { textColorOn } from '../../../shared/lib/color-utils'
import ContextCapture from '../components/ContextCapture'
import LinkIcon from '../components/LinkIcon'

interface FocusData {
  task: Task | null
  project: Project | null
  trigger: Trigger | null
  links: Link[]
  queueDepth: {
    actionable: number
    waiting: number
  }
}

const COLUMN_PROGRESSION: Record<string, TaskColumn | 'archive'> = {
  [TaskColumn.Backlog]: TaskColumn.Planning,
  [TaskColumn.Planning]: TaskColumn.InProgress,
  [TaskColumn.InProgress]: TaskColumn.Review,
  [TaskColumn.Review]: 'archive'
}

const COLUMN_ACTION_LABELS: Record<string, string> = {
  [TaskColumn.Backlog]: 'Start Planning',
  [TaskColumn.Planning]: 'Begin Work',
  [TaskColumn.InProgress]: 'Ready for Review',
  [TaskColumn.Review]: 'Archive'
}

// Simple column weights for client-side priority when defer filtering
const COLUMN_WEIGHTS: Record<string, number> = {
  [TaskColumn.Backlog]: 0,
  [TaskColumn.Planning]: 1,
  [TaskColumn.InProgress]: 2,
  [TaskColumn.Review]: 3
}

interface DeferredTask {
  taskId: number
  deferredAt: number // timestamp
}

const DEFER_DURATION_MS = 30 * 60 * 1000 // 30 minutes

interface CaptureState {
  type: 'phase' | 'defer'
  toColumn: TaskColumn | 'archive'
}

/** Convert a stored image path to a media:// URL served by the main process */
function imageUrl(storedPath: string): string {
  const filename = storedPath.split(/[/\\]/).pop() ?? storedPath
  return `media://project-images/${filename}`
}

export default function FocusView() {
  const navigate = useNavigate()
  const [focusData, setFocusData] = useState<FocusData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [captureState, setCaptureState] = useState<CaptureState | null>(null)
  const deferredTasksRef = useRef<DeferredTask[]>([])

  const loadFocusTask = useCallback(async () => {
    try {
      // Clean up expired deferrals
      const now = Date.now()
      const activeDeferrals = deferredTasksRef.current.filter(
        (d) => now - d.deferredAt < DEFER_DURATION_MS
      )
      if (activeDeferrals.length !== deferredTasksRef.current.length) {
        deferredTasksRef.current = activeDeferrals
      }

      // Get focus task from priority engine
      const data = await window.api.invoke('tasks:focus')

      // Check if the focus task is deferred and not expired
      const focusedTaskId = data.task?.id
      const isDeferredAndActive =
        focusedTaskId != null &&
        activeDeferrals.some(
          (d) => d.taskId === focusedTaskId && now - d.deferredAt < DEFER_DURATION_MS
        )

      if (isDeferredAndActive) {
        // Task is deferred - we need to find the next non-deferred task
        // Get all non-archived tasks
        const tasks = await window.api.invoke('tasks:list', { archived: false })

        // Filter out deferred tasks and backlog (backlog is never actionable per engine rules)
        // TODO: Also filter trigger-blocked tasks (taskId in triggers with status pending/polling/awaiting_approval)
        // Currently this requires a separate IPC call to fetch triggers, so we accept the small risk
        // that a deferred top task could be replaced by a trigger-blocked task in the fallback logic
        const nonDeferredTasks = tasks.filter(
          (t) =>
            !activeDeferrals.some((d) => d.taskId === t.id) &&
            t.column !== TaskColumn.Backlog
        )

        if (nonDeferredTasks.length > 0) {
          // Show the highest priority non-deferred task
          // Sort by column weight (desc), then by lastTouchedAt (desc)
          const sortedTasks = nonDeferredTasks.sort((a, b) => {
            const aWeight = COLUMN_WEIGHTS[a.column] ?? 0
            const bWeight = COLUMN_WEIGHTS[b.column] ?? 0
            const weightDiff = bWeight - aWeight
            if (weightDiff !== 0) return weightDiff
            return (
              new Date(b.lastTouchedAt).getTime() - new Date(a.lastTouchedAt).getTime()
            )
          })

          const nextTask = sortedTasks[0]
          if (nextTask) {
            const project =
              nextTask.projectId !== null
                ? await window.api.invoke('projects:get', { id: nextTask.projectId })
                : null

            setFocusData({
              ...data,
              task: nextTask,
              project: project,
              trigger: null, // Replacement task doesn't have trigger info
              links: [] // Simplified for v1 - would need separate fetch
            })
          } else {
            setFocusData(data)
          }
        } else if (activeDeferrals.length > 0) {
          // All tasks are deferred - show oldest deferred
          const oldestDeferred = [...activeDeferrals].sort(
            (a, b) => a.deferredAt - b.deferredAt
          )[0]
          const oldestDeferredTask = oldestDeferred
            ? tasks.find((t) => t.id === oldestDeferred.taskId)
            : null

          if (oldestDeferredTask) {
            const project =
              oldestDeferredTask.projectId !== null
                ? await window.api.invoke('projects:get', {
                    id: oldestDeferredTask.projectId
                  })
                : null

            setFocusData({
              ...data,
              task: oldestDeferredTask,
              project: project,
              trigger: null, // Replacement task doesn't have trigger info
              links: [] // Simplified for v1
            })
          } else {
            setFocusData(data)
          }
        } else {
          setFocusData(data)
        }
      } else {
        // Task is not deferred or has expired - show it
        setFocusData(data)
      }
    } catch (error) {
      console.error('Failed to load focus task:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFocusTask()
  }, [loadFocusTask])

  const handleComplete = () => {
    if (!focusData?.task) return
    const nextColumn = COLUMN_PROGRESSION[focusData.task.column]
    if (!nextColumn) return
    setCaptureState({ type: 'phase', toColumn: nextColumn })
  }

  const handleDefer = () => {
    if (!focusData?.task) return
    setCaptureState({ type: 'defer', toColumn: focusData.task.column })
  }

  const executeDeferTransition = () => {
    if (!focusData?.task) return
    const taskId = focusData.task.id
    setIsTransitioning(true)
    deferredTasksRef.current = [
      ...deferredTasksRef.current.filter((d) => d.taskId !== taskId),
      { taskId, deferredAt: Date.now() }
    ]
    setTimeout(() => {
      void loadFocusTask().then(() => {
        setIsTransitioning(false)
      })
    }, 400)
  }

  const handleCaptureConfirm = async (contextBlock: string) => {
    if (!focusData?.task || !captureState) return
    const normalizedContext: string | null = contextBlock || null
    setCaptureState(null)
    setIsTransitioning(true)

    const task = focusData.task
    const { type, toColumn } = captureState

    try {
      if (type === 'phase') {
        if (toColumn === 'archive') {
          // Save context then archive. No columnHistory record — 'archive' is not a
          // valid column in the schema enum, so we skip history for the terminal state.
          await window.api.invoke('tasks:update', {
            id: task.id,
            contextBlock: normalizedContext
          })
          await window.api.invoke('tasks:archive', { id: task.id })
        } else {
          // Save context + new column in one call, then record history
          await window.api.invoke('tasks:update', {
            id: task.id,
            contextBlock: normalizedContext,
            column: toColumn
          })
          await window.api.invoke('columnHistory:create', {
            taskId: task.id,
            fromColumn: task.column,
            toColumn,
            contextSnapshot: normalizedContext
          })
        }
        setTimeout(() => {
          void loadFocusTask().then(() => {
            setIsTransitioning(false)
          })
        }, 400)
      } else {
        // Defer: save updated context, then let executeDeferTransition own the
        // full transition lifecycle (including clearing isTransitioning after 400ms)
        await window.api.invoke('tasks:update', {
          id: task.id,
          contextBlock: normalizedContext
        })
        executeDeferTransition()
      }
    } catch (error) {
      console.error('Failed to save context:', error)
      setIsTransitioning(false)
    }
  }

  const handleCaptureSkip = () => {
    // Defer only — skip saving context and proceed
    setCaptureState(null)
    executeDeferTransition()
  }

  const handleCaptureCancel = () => {
    setCaptureState(null)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  // Empty state: no tasks available
  if (!focusData?.task || !focusData.project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-200">All clear</h1>
          <p className="mt-2 text-gray-500">Nothing actionable right now.</p>
          <button
            onClick={() => {
              void navigate('/board')
            }}
            className="mt-6 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600"
          >
            View Board
          </button>
        </div>
      </div>
    )
  }

  const { task, project, trigger, links, queueDepth } = focusData

  const actionLabel = COLUMN_ACTION_LABELS[task.column] || 'Complete'

  // Compute text colors based on background luminance
  const primaryTextColor = textColorOn(project.colorPrimary)
  const accentTextColor = textColorOn(project.colorAccent)

  return (
    <div
      data-testid="focus-view"
      className={`relative flex h-full flex-col transition-opacity duration-400 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundColor: project.colorAccent }}
    >
      {/* Background image */}
      {project.backgroundImage && (
        <img
          src={imageUrl(project.backgroundImage)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      {/* Main content - centered with generous whitespace */}
      <div className="relative flex flex-1 items-center justify-center px-16 py-12">
        <div
          className="max-w-3xl space-y-6 rounded-xl border-2 p-8"
          style={{
            borderColor: project.colorPrimary,
            backgroundColor: project.colorAccent + 'e6',
            color: accentTextColor
          }}
        >
          {/* Project name */}
          <div
            className="inline-block rounded-md px-3 py-1 text-sm font-medium tracking-wide uppercase"
            style={{
              backgroundColor: project.colorPrimary,
              color: primaryTextColor
            }}
          >
            {project.name}
          </div>

          {/* Task title */}
          <h1 className="text-4xl font-bold" style={{ color: accentTextColor }}>
            {task.title}
          </h1>

          {/* Context block */}
          {task.contextBlock && (
            <div
              tabIndex={0}
              role="region"
              aria-label="Task context"
              className="max-h-64 overflow-y-auto rounded-lg p-6 text-lg leading-relaxed opacity-90"
              style={{
                backgroundColor:
                  accentTextColor === '#ffffff' ? '#00000020' : '#ffffff20',
                color: accentTextColor
              }}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>
                  ),
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  h1: ({ children }) => (
                    <h1 className="mb-2 text-2xl font-bold">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 text-xl font-bold">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-2 text-lg font-semibold">{children}</h3>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline opacity-80 hover:opacity-100"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children, className }) =>
                    className ? (
                      <code className={className}>{children}</code>
                    ) : (
                      <code
                        className="rounded px-1 py-0.5 font-mono text-base opacity-80"
                        style={{
                          backgroundColor:
                            accentTextColor === '#ffffff' ? '#00000030' : '#ffffff30'
                        }}
                      >
                        {children}
                      </code>
                    ),
                  pre: ({ children }) => (
                    <pre
                      className="mb-3 overflow-x-auto rounded p-3 font-mono text-base last:mb-0"
                      style={{
                        backgroundColor:
                          accentTextColor === '#ffffff' ? '#00000030' : '#ffffff30'
                      }}
                    >
                      {children}
                    </pre>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>
                }}
              >
                {task.contextBlock}
              </ReactMarkdown>
            </div>
          )}

          {/* Trigger info (if applicable) */}
          {trigger?.firedContext && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="text-sm font-medium text-yellow-200">Why now?</div>
              <div className="mt-1 text-sm text-yellow-100">{trigger.firedContext}</div>
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="space-y-2">
              <div
                className="text-sm font-medium opacity-80"
                style={{ color: accentTextColor }}
              >
                Related Links
              </div>
              <div className="space-y-2">
                {links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor:
                        accentTextColor === '#ffffff' ? '#00000020' : '#ffffff20',
                      color: accentTextColor
                    }}
                  >
                    <LinkIcon sourceType={link.sourceType} />
                    <span>{link.label || link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleComplete}
              disabled={isTransitioning}
              className="rounded-lg px-6 py-3 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: project.colorPrimary,
                color: primaryTextColor
              }}
            >
              {actionLabel}
            </button>
            <button
              onClick={handleDefer}
              disabled={isTransitioning}
              className="rounded-lg border-2 px-6 py-3 font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                borderColor: accentTextColor === '#ffffff' ? '#ffffff40' : '#00000040',
                backgroundColor:
                  accentTextColor === '#ffffff' ? '#ffffff20' : '#00000020',
                color: accentTextColor
              }}
            >
              Defer
            </button>
            <button
              onClick={() => {
                void navigate('/board')
              }}
              className="rounded-lg border-2 px-6 py-3 font-medium transition-opacity hover:opacity-80"
              style={{
                borderColor: accentTextColor === '#ffffff' ? '#ffffff40' : '#00000040',
                backgroundColor:
                  accentTextColor === '#ffffff' ? '#ffffff20' : '#00000020',
                color: accentTextColor
              }}
            >
              View Board
            </button>
          </div>
        </div>
      </div>

      {/* Ambient queue indicator */}
      <div
        className="relative border-t px-8 py-4 text-center text-sm"
        style={{
          borderColor: accentTextColor === '#ffffff' ? '#ffffff20' : '#00000020',
          backgroundColor: accentTextColor === '#ffffff' ? '#00000030' : '#ffffff30',
          color: accentTextColor === '#ffffff' ? '#ffffffaa' : '#000000aa'
        }}
      >
        {queueDepth.actionable > 1 && (
          <span>{queueDepth.actionable - 1} tasks waiting</span>
        )}
        {queueDepth.actionable > 1 && queueDepth.waiting > 0 && <span> · </span>}
        {queueDepth.waiting > 0 && <span>{queueDepth.waiting} blocked</span>}
        {queueDepth.actionable <= 1 && queueDepth.waiting === 0 && (
          <span>No tasks in queue</span>
        )}
      </div>

      {captureState && (
        <ContextCapture
          open={true}
          task={task}
          fromColumn={task.column}
          toColumn={captureState.toColumn}
          transitionType={captureState.type}
          project={project}
          onConfirm={(contextBlock) => {
            void handleCaptureConfirm(contextBlock)
          }}
          onSkip={handleCaptureSkip}
          onCancel={handleCaptureCancel}
        />
      )}
    </div>
  )
}

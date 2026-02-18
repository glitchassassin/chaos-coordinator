import { useCallback, useEffect, useRef, useState } from 'react'
import { BOARD_PUSH_CHANNEL } from '@shared/types/ipc'
import type { Project, Task, Trigger, InsertTask, Link } from '@shared/types/models'
import { TaskColumn, TriggerStatus } from '@shared/types/enums'
import { timeElapsed } from '@shared/lib/time-utils'
import Modal from '../components/Modal'
import ContextCapture from '../components/ContextCapture'
import ToastNotification from '../components/Toast'
import { useToast } from '../hooks/useToast'
import LinkIcon from '../components/LinkIcon'

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/** Convert a stored image path to a media:// URL served by the main process */
function imageUrl(storedPath: string): string {
  const filename = storedPath.split(/[/\\]/).pop() ?? storedPath
  return `media://project-images/${filename}`
}

interface TaskWithTrigger {
  task: Task
  trigger: Trigger | null
}

interface SwimLane {
  project: Project
  tasks: {
    [TaskColumn.Backlog]: TaskWithTrigger[]
    [TaskColumn.Planning]: TaskWithTrigger[]
    [TaskColumn.InProgress]: TaskWithTrigger[]
    [TaskColumn.Review]: TaskWithTrigger[]
  }
}

const COLUMNS = [
  { key: TaskColumn.Backlog, label: 'Backlog' },
  { key: TaskColumn.Planning, label: 'Planning' },
  { key: TaskColumn.InProgress, label: 'In Progress' },
  { key: TaskColumn.Review, label: 'Review/Verify' }
] as const

/** Derive waiting label from trigger condition (first ~30 chars) */
function waitingLabel(nlCondition: string): string {
  const truncated = nlCondition.slice(0, 30)
  return truncated.length < nlCondition.length ? `${truncated}...` : truncated
}

/** Check if a trigger recently fired (within the last hour) */
function isRecentlyFired(trigger: Trigger | null): boolean {
  if (!trigger || trigger.status !== TriggerStatus.Fired || !trigger.firedAt) {
    return false
  }
  const firedTime = new Date(trigger.firedAt).getTime()
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  return now - firedTime < oneHour
}

export default function BoardView() {
  const [swimLanes, setSwimLanes] = useState<SwimLane[]>([])
  const [editingTask, setEditingTask] = useState<TaskWithTrigger | null>(null)
  const [editingLinks, setEditingLinks] = useState<Link[]>([])
  const [removedLinkIds, setRemovedLinkIds] = useState<number[]>([])
  const [pendingLinks, setPendingLinks] = useState<{ url: string; label: string }[]>([])
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const lastUrlInputRef = useRef<HTMLInputElement>(null)
  const [addingIn, setAddingIn] = useState<{
    projectId: number
    column: TaskColumn
  } | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const { toast, showToast } = useToast()

  // Loading state for URL auto-population (renderer-only, no DB column needed)
  const [fetchingTaskIds, setFetchingTaskIds] = useState<Set<number>>(new Set())
  // Tracks tasks cancelled by the user so stale push events don't show misleading toasts
  const cancelledTaskIdsRef = useRef(new Set<number>())

  const startFetching = useCallback((id: number) => {
    setFetchingTaskIds((prev) => new Set([...prev, id]))
  }, [])

  const stopFetching = useCallback((id: number) => {
    setFetchingTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Drag state for cards
  const draggedCard = useRef<{ taskId: number } | null>(null)
  const dragOverColumn = useRef<TaskColumn | null>(null)

  // Drag state for swim lanes
  const draggedLane = useRef<number | null>(null)
  const dragOverLane = useRef<number | null>(null)

  // Context capture state for drag transitions
  const [dragCapture, setDragCapture] = useState<{
    task: Task
    fromColumn: TaskColumn
    toColumn: TaskColumn
  } | null>(null)

  const loadBoard = useCallback(async () => {
    try {
      const [projects, tasks] = await Promise.all([
        window.api.invoke('projects:list'),
        window.api.invoke('tasks:list', { archived: false })
      ])

      // Sort projects by priorityRank
      projects.sort((a, b) => a.priorityRank - b.priorityRank)

      // Build swim lanes (triggers will be populated when T-010 is implemented)
      const lanes: SwimLane[] = projects.map((project) => {
        const projectTasks = tasks.filter((t) => t.projectId === project.id)
        return {
          project,
          tasks: {
            [TaskColumn.Backlog]: projectTasks
              .filter((t) => t.column === TaskColumn.Backlog)
              .map((task) => ({ task, trigger: null })),
            [TaskColumn.Planning]: projectTasks
              .filter((t) => t.column === TaskColumn.Planning)
              .map((task) => ({ task, trigger: null })),
            [TaskColumn.InProgress]: projectTasks
              .filter((t) => t.column === TaskColumn.InProgress)
              .map((task) => ({ task, trigger: null })),
            [TaskColumn.Review]: projectTasks
              .filter((t) => t.column === TaskColumn.Review)
              .map((task) => ({ task, trigger: null }))
          }
        }
      })

      setSwimLanes(lanes)
    } catch {
      showToast('Failed to load board', 'error')
    }
  }, [showToast])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    window.api.on(BOARD_PUSH_CHANNEL, ({ taskId, success }) => {
      if (cancelledTaskIdsRef.current.has(taskId)) {
        cancelledTaskIdsRef.current.delete(taskId)
        return
      }
      stopFetching(taskId)
      if (success) showToast('Task populated from URL', 'success')
      void loadBoard()
    })
    return () => {
      window.api.off(BOARD_PUSH_CHANNEL)
    }
  }, [loadBoard, showToast, stopFetching])

  useEffect(() => {
    if (editingTask) {
      void window.api
        .invoke('links:list', { taskId: editingTask.task.id })
        .then((result) => {
          setEditingLinks(result)
        })
        .catch(() => {
          // silently ignore — links section shows empty
        })
      setRemovedLinkIds([])
      setPendingLinks([])
      setCopiedLinkId(null)
    } else {
      setEditingLinks([])
      setRemovedLinkIds([])
      setPendingLinks([])
      setCopiedLinkId(null)
    }
  }, [editingTask])

  useEffect(() => {
    if (pendingLinks.length > 0) {
      lastUrlInputRef.current?.focus()
    }
  }, [pendingLinks.length])

  const handleRemoveLink = (linkId: number) => {
    setEditingLinks((prev) => prev.filter((l) => l.id !== linkId))
    setRemovedLinkIds((prev) => [...prev, linkId])
  }

  const handleCopyLink = (link: Link) => {
    void navigator.clipboard
      .writeText(link.url)
      .then(() => {
        setCopiedLinkId(link.id)
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => {
          setCopiedLinkId(null)
        }, 1500)
      })
      .catch(() => {
        // clipboard access denied — silently ignore
      })
  }

  const handleCardDragStart = (e: React.DragEvent, taskId: number) => {
    e.stopPropagation()
    draggedCard.current = { taskId }
  }

  const handleCardDragOver = (e: React.DragEvent, column: TaskColumn) => {
    e.preventDefault()
    dragOverColumn.current = column
  }

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedCard.current || !dragOverColumn.current) return

    const { taskId } = draggedCard.current
    const toColumn = dragOverColumn.current

    draggedCard.current = null
    dragOverColumn.current = null

    // Find the task in swim lanes to get its current column
    let foundTask: Task | null = null
    for (const lane of swimLanes) {
      for (const tasks of Object.values(lane.tasks)) {
        const match = tasks.find((twt) => twt.task.id === taskId)
        if (match) {
          foundTask = match.task
          break
        }
      }
      if (foundTask) break
    }

    if (!foundTask) return

    // If column didn't change, no-op
    if (foundTask.column === toColumn) return

    // Prompt for context capture before moving
    setDragCapture({ task: foundTask, fromColumn: foundTask.column, toColumn })
  }

  const executeDragTransition = async (
    task: Task,
    fromColumn: TaskColumn,
    toColumn: TaskColumn,
    contextBlock: string
  ) => {
    const normalizedContext: string | null = contextBlock || null
    try {
      await window.api.invoke('tasks:update', {
        id: task.id,
        contextBlock: normalizedContext,
        column: toColumn
      })
      await window.api.invoke('columnHistory:create', {
        taskId: task.id,
        fromColumn,
        toColumn,
        contextSnapshot: normalizedContext
      })
      await loadBoard()
    } catch {
      showToast('Failed to move task', 'error')
    }
  }

  const handleCardDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    draggedCard.current = null
    dragOverColumn.current = null
  }

  const handleLaneDragStart = (index: number) => {
    draggedLane.current = index
  }

  const handleLaneDragEnter = (index: number) => {
    dragOverLane.current = index
  }

  const handleLaneDragEnd = () => {
    draggedLane.current = null
    dragOverLane.current = null
  }

  const handleLaneDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedLane.current === null || dragOverLane.current === null) return
    if (draggedLane.current === dragOverLane.current) return

    const reordered = [...swimLanes]
    const [dragged] = reordered.splice(draggedLane.current, 1)
    if (!dragged) return
    reordered.splice(dragOverLane.current, 0, dragged)

    draggedLane.current = null
    dragOverLane.current = null

    setSwimLanes(reordered)

    // Update priorityRank for all affected projects
    const updates = reordered
      .map((lane, i) => ({ lane, rank: i }))
      .filter(({ lane, rank }) => lane.project.priorityRank !== rank)
      .map(({ lane, rank }) =>
        window.api.invoke('projects:update', { id: lane.project.id, priorityRank: rank })
      )

    const results = await Promise.allSettled(updates)
    const failed = results.some((r) => r.status === 'rejected')
    if (failed) {
      showToast('Failed to reorder projects', 'error')
    }
    await loadBoard()
  }

  const handleCardClick = (taskWithTrigger: TaskWithTrigger) => {
    setEditingTask(taskWithTrigger)
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return

    try {
      await Promise.all(
        removedLinkIds.map((id) => window.api.invoke('links:delete', { id }))
      )
      await Promise.all(
        pendingLinks
          .filter((l) => l.url.trim())
          .map((l) =>
            window.api.invoke('links:create', {
              taskId: editingTask.task.id,
              url: l.url.trim(),
              label: l.label.trim() || null,
              sourceType: 'other'
            })
          )
      )
      await window.api.invoke('tasks:update', {
        id: editingTask.task.id,
        title: editingTask.task.title,
        contextBlock: editingTask.task.contextBlock,
        column: editingTask.task.column,
        projectId: editingTask.task.projectId
      })
      showToast('Task updated', 'success')
      setEditingTask(null)
      await loadBoard()
    } catch {
      showToast('Failed to update task', 'error')
    }
  }

  const handleArchiveTask = async () => {
    if (!editingTask) return

    try {
      await window.api.invoke('tasks:archive', { id: editingTask.task.id })
      showToast('Task archived', 'success')
      setEditingTask(null)
      await loadBoard()
    } catch {
      showToast('Failed to archive task', 'error')
    }
  }

  const openInlineAdd = (projectId: number, column: TaskColumn) => {
    setAddingIn({ projectId, column })
    setAddTitle('')
  }

  useEffect(() => {
    if (addingIn) {
      addInputRef.current?.focus()
    }
  }, [addingIn])

  const handleInlineAdd = async () => {
    if (!addTitle.trim() || !addingIn) return

    const title = addTitle.trim()
    const { projectId, column } = addingIn

    setAddingIn(null)
    setAddTitle('')

    if (isUrl(title)) {
      await handleUrlAutoPopulate(title, projectId, column)
    } else {
      try {
        const data: InsertTask = { title, projectId, column }
        await window.api.invoke('tasks:create', data)
        showToast('Task created', 'success')
        await loadBoard()
      } catch {
        showToast('Failed to create task', 'error')
      }
    }
  }

  const handleUrlAutoPopulate = async (
    url: string,
    projectId: number,
    column: TaskColumn
  ) => {
    // Create task immediately with URL as title
    let task: Task
    try {
      task = await window.api.invoke('tasks:create', { title: url, projectId, column })
    } catch {
      showToast('Failed to create task', 'error')
      return
    }

    // Show loading state and reload so card appears immediately
    startFetching(task.id)
    await loadBoard()

    // Fire-and-forget: main process handles CLI fetch + DB updates.
    // board:taskUpdated push event triggers stopFetching + loadBoard when done.
    void window.api.invoke('intake:processTask', { url, taskId: task.id, projectId })
  }

  const handleCancelFetch = async (taskId: number) => {
    cancelledTaskIdsRef.current.add(taskId)
    stopFetching(taskId)
    try {
      await window.api.invoke('tasks:archive', { id: taskId })
      await loadBoard()
    } catch {
      showToast('Failed to cancel', 'error')
    }
  }

  const cancelInlineAdd = () => {
    setAddingIn(null)
    setAddTitle('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-200">Board</h1>
      </div>

      {/* Board grid */}
      <div className="flex-1 overflow-auto p-6">
        {swimLanes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>No projects or tasks yet. Create a project to get started.</p>
          </div>
        ) : (
          <div className="min-w-[1000px]">
            {/* Column headers */}
            <div className="mb-4 grid grid-cols-[200px_repeat(4,1fr)] gap-4">
              <div className="font-semibold text-gray-400">Project</div>
              {COLUMNS.map((col) => (
                <div key={col.key} className="font-semibold text-gray-400">
                  {col.label}
                </div>
              ))}
            </div>

            {/* Swim lanes */}
            {swimLanes.map((lane, index) => (
              <div
                key={lane.project.id}
                draggable
                onDragStart={() => {
                  handleLaneDragStart(index)
                }}
                onDragEnter={() => {
                  handleLaneDragEnter(index)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                }}
                onDragEnd={handleLaneDragEnd}
                onDrop={(e) => void handleLaneDrop(e)}
                className="mb-4 grid grid-cols-[200px_repeat(4,1fr)] gap-4"
              >
                {/* Project label */}
                <div
                  className="relative flex cursor-grab items-end overflow-hidden rounded-lg border-2 px-3 py-2 active:cursor-grabbing"
                  style={{ borderColor: lane.project.colorPrimary }}
                >
                  {lane.project.backgroundImage && (
                    <img
                      src={imageUrl(lane.project.backgroundImage)}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span className="relative text-base font-semibold text-gray-200">
                    {lane.project.name}
                  </span>
                </div>

                {/* Columns */}
                {COLUMNS.map((col) => {
                  const isAdding =
                    addingIn !== null &&
                    addingIn.projectId === lane.project.id &&
                    addingIn.column === col.key
                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => {
                        handleCardDragOver(e, col.key)
                      }}
                      onDrop={(e) => {
                        handleCardDrop(e)
                      }}
                      className="flex min-h-[60px] min-w-0 flex-col rounded-lg border border-dashed border-gray-800 p-2"
                    >
                      <div className="flex-1 space-y-2">
                        {lane.tasks[col.key].map((taskWithTrigger) => (
                          <TaskCard
                            key={taskWithTrigger.task.id}
                            taskWithTrigger={taskWithTrigger}
                            isLoading={fetchingTaskIds.has(taskWithTrigger.task.id)}
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                            onClick={handleCardClick}
                            onCancel={(taskId) => {
                              void handleCancelFetch(taskId)
                            }}
                          />
                        ))}
                      </div>
                      {isAdding ? (
                        <div className="mt-2 flex flex-col gap-1">
                          <input
                            ref={addInputRef}
                            type="text"
                            value={addTitle}
                            onChange={(e) => {
                              setAddTitle(e.target.value)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleInlineAdd()
                              if (e.key === 'Escape') cancelInlineAdd()
                            }}
                            placeholder="Task title"
                            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                            aria-label="New task title"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void handleInlineAdd()}
                              className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelInlineAdd}
                              className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            openInlineAdd(lane.project.id, col.key)
                          }}
                          className="mt-2 w-full rounded py-1 text-center text-xs text-gray-600 transition-colors hover:bg-gray-800 hover:text-gray-400"
                          aria-label={`Add task to ${lane.project.name} ${col.label}`}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit task modal */}
      <Modal
        open={editingTask !== null}
        onClose={() => {
          setEditingTask(null)
        }}
        className="w-[32rem] p-6"
      >
        {editingTask && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-200">Edit Task</h2>

            <div>
              <label
                htmlFor="edit-title"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Title
              </label>
              <input
                id="edit-title"
                type="text"
                value={editingTask.task.title}
                onChange={(e) => {
                  setEditingTask({
                    ...editingTask,
                    task: { ...editingTask.task, title: e.target.value }
                  })
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-context"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Context
              </label>
              <textarea
                id="edit-context"
                value={editingTask.task.contextBlock ?? ''}
                onChange={(e) => {
                  setEditingTask({
                    ...editingTask,
                    task: { ...editingTask.task, contextBlock: e.target.value || null }
                  })
                }}
                rows={4}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-column"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Column
              </label>
              <select
                id="edit-column"
                value={editingTask.task.column}
                onChange={(e) => {
                  setEditingTask({
                    ...editingTask,
                    task: { ...editingTask.task, column: e.target.value as TaskColumn }
                  })
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              >
                {COLUMNS.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Links */}
            <div>
              <div className="mb-2 text-sm font-medium text-gray-300">Links</div>
              <div className="space-y-2">
                {editingLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <span className="text-gray-500">
                      <LinkIcon sourceType={link.sourceType} />
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {link.label ?? link.url}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyLink(link)
                      }}
                      aria-label={`Copy link ${link.label ?? link.url}`}
                      className="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
                    >
                      {copiedLinkId === link.id ? (
                        <svg
                          className="h-3.5 w-3.5 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveLink(link.id)
                      }}
                      aria-label={`Remove link ${link.label ?? link.url}`}
                      className="shrink-0 text-gray-500 transition-colors hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pendingLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={i === pendingLinks.length - 1 ? lastUrlInputRef : null}
                      type="url"
                      value={link.url}
                      onChange={(e) => {
                        setPendingLinks((prev) =>
                          prev.map((l, j) =>
                            j === i ? { ...l, url: e.target.value } : l
                          )
                        )
                      }}
                      placeholder="https://..."
                      aria-label="Link URL"
                      className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        setPendingLinks((prev) =>
                          prev.map((l, j) =>
                            j === i ? { ...l, label: e.target.value } : l
                          )
                        )
                      }}
                      placeholder="Label (optional)"
                      aria-label="Link label"
                      className="w-32 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingLinks((prev) => prev.filter((_, j) => j !== i))
                      }}
                      aria-label={`Remove new link ${String(i + 1)}`}
                      className="shrink-0 text-gray-500 transition-colors hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingLinks((prev) => [...prev, { url: '', label: '' }])
                }}
                className="mt-2 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
              >
                + Add link
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => void handleArchiveTask()}
                className="rounded-lg px-4 py-2 text-sm text-red-400 transition-colors hover:text-red-300"
              >
                Archive
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null)
                  }}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {dragCapture && (
        <ContextCapture
          open={true}
          task={dragCapture.task}
          fromColumn={dragCapture.fromColumn}
          toColumn={dragCapture.toColumn}
          transitionType="phase"
          onConfirm={(contextBlock) => {
            const { task, fromColumn, toColumn } = dragCapture
            setDragCapture(null)
            void executeDragTransition(task, fromColumn, toColumn, contextBlock)
          }}
          onSkip={() => {
            setDragCapture(null)
          }}
          onCancel={() => {
            setDragCapture(null)
          }}
        />
      )}

      <ToastNotification toast={toast} />
    </div>
  )
}

interface TaskCardProps {
  taskWithTrigger: TaskWithTrigger
  isLoading: boolean
  onDragStart: (e: React.DragEvent, taskId: number) => void
  onDragEnd: (e: React.DragEvent) => void
  onClick: (taskWithTrigger: TaskWithTrigger) => void
  onCancel: (taskId: number) => void
}

function TaskCard({
  taskWithTrigger,
  isLoading,
  onDragStart,
  onDragEnd,
  onClick,
  onCancel
}: TaskCardProps) {
  const { task, trigger } = taskWithTrigger

  // Loading state: show spinner overlay, disable interaction
  if (isLoading) {
    return (
      <div className="relative rounded-lg border border-gray-700 bg-gray-900 p-3 opacity-60">
        <div className="mb-2 truncate text-sm font-medium text-gray-400">
          {task.title}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400"
              aria-label="Loading"
            />
            <span>Fetching metadata…</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancel(task.id)
            }}
            aria-label="Cancel fetch"
            className="text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Check if task is waiting (has active trigger)
  const isWaiting =
    trigger &&
    (trigger.status === TriggerStatus.Pending || trigger.status === TriggerStatus.Polling)

  const isTriggered = isRecentlyFired(trigger)

  const timeInColumn = timeElapsed(task.columnChangedAt)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        onDragStart(e, task.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        onClick(taskWithTrigger)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(taskWithTrigger)
        }
      }}
      className={`cursor-pointer rounded-lg border bg-gray-900 p-3 transition-all hover:border-gray-600 focus:border-indigo-500 focus:outline-none ${
        isWaiting
          ? 'border-gray-700 opacity-60'
          : isTriggered
            ? 'animate-pulse border-indigo-500'
            : 'border-gray-800'
      }`}
    >
      {/* Title */}
      <div className="mb-2 line-clamp-3 text-sm font-medium [overflow-wrap:anywhere] text-gray-200">
        {task.title}
      </div>

      {/* Waiting indicator */}
      {isWaiting && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-400">
          <span>⏳</span>
          <span>{waitingLabel(trigger.nlCondition)}</span>
        </div>
      )}

      {/* Time in column */}
      <div className="text-xs text-gray-500">
        {timeInColumn} in {task.column}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project, Task, Trigger, InsertTask } from '@shared/types/models'
import { TaskColumn, TriggerStatus } from '@shared/types/enums'
import { timeElapsed } from '@shared/lib/time-utils'
import Modal from '../components/Modal'
import ToastNotification from '../components/Toast'
import { useToast } from '../hooks/useToast'

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
  const [addingIn, setAddingIn] = useState<{
    projectId: number
    column: TaskColumn
  } | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const { toast, showToast } = useToast()

  // Drag state for cards
  const draggedCard = useRef<{ taskId: number } | null>(null)
  const dragOverColumn = useRef<TaskColumn | null>(null)

  // Drag state for swim lanes
  const draggedLane = useRef<number | null>(null)
  const dragOverLane = useRef<number | null>(null)

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

  const handleCardDragStart = (e: React.DragEvent, taskId: number) => {
    e.stopPropagation()
    draggedCard.current = { taskId }
  }

  const handleCardDragOver = (e: React.DragEvent, column: TaskColumn) => {
    e.preventDefault()
    dragOverColumn.current = column
  }

  const handleCardDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedCard.current || !dragOverColumn.current) return

    const { taskId } = draggedCard.current
    const column = dragOverColumn.current

    try {
      await window.api.invoke('tasks:update', { id: taskId, column })
      await loadBoard()
    } catch {
      showToast('Failed to move task', 'error')
    } finally {
      draggedCard.current = null
      dragOverColumn.current = null
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

    try {
      const data: InsertTask = {
        title: addTitle.trim(),
        projectId: addingIn.projectId,
        column: addingIn.column
      }
      await window.api.invoke('tasks:create', data)
      showToast('Task created', 'success')
      setAddingIn(null)
      setAddTitle('')
      await loadBoard()
    } catch {
      showToast('Failed to create task', 'error')
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
                      onDrop={(e) => void handleCardDrop(e)}
                      className="flex min-h-[60px] flex-col rounded-lg border border-dashed border-gray-800 p-2"
                    >
                      <div className="flex-1 space-y-2">
                        {lane.tasks[col.key].map((taskWithTrigger) => (
                          <TaskCard
                            key={taskWithTrigger.task.id}
                            taskWithTrigger={taskWithTrigger}
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                            onClick={handleCardClick}
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

      <ToastNotification toast={toast} />
    </div>
  )
}

interface TaskCardProps {
  taskWithTrigger: TaskWithTrigger
  onDragStart: (e: React.DragEvent, taskId: number) => void
  onDragEnd: (e: React.DragEvent) => void
  onClick: (taskWithTrigger: TaskWithTrigger) => void
}

function TaskCard({ taskWithTrigger, onDragStart, onDragEnd, onClick }: TaskCardProps) {
  const { task, trigger } = taskWithTrigger

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
      <div className="mb-2 text-sm font-medium text-gray-200">{task.title}</div>

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

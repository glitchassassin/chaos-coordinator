import { eq, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../db'
import { tasks, projects, triggers } from '../db/schema'
import { TaskColumn, TriggerStatus } from '../../shared/types/enums'
import type { Task, Project, Trigger } from '../../shared/types/models'

/**
 * Column priority weights (higher number = higher priority)
 */
const COLUMN_WEIGHTS: Record<TaskColumn, number> = {
  [TaskColumn.Backlog]: 0,
  [TaskColumn.Planning]: 1,
  [TaskColumn.InProgress]: 2,
  [TaskColumn.Review]: 3
}

/**
 * Extended task data with project and trigger information for priority calculation
 */
interface TaskWithPriorityData extends Task {
  project: Project
  mostRecentFiredTrigger: Trigger | null
}

/**
 * Result of the focus query
 */
export interface FocusResult {
  task: Task | null
  project: Project | null
  trigger: Trigger | null
  queueDepth: {
    actionable: number
    waiting: number
  }
}

/**
 * Determines if a task is actionable based on triggers
 * A task is not actionable if it has an active waiting trigger (pending or polling)
 */
function isTaskActionable(taskId: number, triggersMap: Map<number, Trigger[]>): boolean {
  const taskTriggers = triggersMap.get(taskId) || []
  const hasWaitingTrigger = taskTriggers.some(
    (t) =>
      t.status === TriggerStatus.Pending ||
      t.status === TriggerStatus.AwaitingApproval ||
      t.status === TriggerStatus.Polling
  )
  return !hasWaitingTrigger
}

/**
 * Gets the most recently fired trigger for a task
 */
function getMostRecentFiredTrigger(
  taskId: number,
  triggersMap: Map<number, Trigger[]>
): Trigger | null {
  const taskTriggers = triggersMap.get(taskId) || []
  const firedTriggers = taskTriggers
    .filter((t) => t.status === TriggerStatus.Fired && t.firedAt)
    .sort((a, b) => {
      // Both have firedAt due to filter above
      if (!a.firedAt || !b.firedAt) return 0
      return b.firedAt > a.firedAt ? 1 : -1
    })

  return firedTriggers[0] || null
}

/**
 * Compares two tasks for priority ordering for Array.sort()
 * Returns negative if a should come before b (a has higher priority)
 * Returns positive if b should come before a (b has higher priority)
 *
 * Priority rules (in order):
 * 1. Column position (review > in_progress > planning > backlog)
 * 2. Trigger recency (recently fired trigger wins)
 * 3. Project rank (lower number = higher priority)
 * 4. Last touched (more recent wins)
 * 5. Time in queue (older wins, to prevent starvation)
 */
function comparePriority(a: TaskWithPriorityData, b: TaskWithPriorityData): number {
  // Rule 1: Column position (higher weight = higher priority, should come first)
  const aWeight = COLUMN_WEIGHTS[a.column]
  const bWeight = COLUMN_WEIGHTS[b.column]
  if (aWeight !== bWeight) {
    return bWeight - aWeight // Higher weight comes first
  }

  // Rule 2: Trigger recency (more recent timestamp = higher priority, should come first)
  const aTriggerTime = a.mostRecentFiredTrigger?.firedAt || ''
  const bTriggerTime = b.mostRecentFiredTrigger?.firedAt || ''
  if (aTriggerTime !== bTriggerTime) {
    // Compare as strings (ISO 8601 format sorts correctly)
    // Later timestamp should come first (higher priority)
    return bTriggerTime.localeCompare(aTriggerTime)
  }

  // Rule 3: Project rank (lower number = higher priority, should come first)
  if (a.project.priorityRank !== b.project.priorityRank) {
    return a.project.priorityRank - b.project.priorityRank
  }

  // Rule 4: Last touched (more recent = higher priority, should come first)
  if (a.lastTouchedAt !== b.lastTouchedAt) {
    return b.lastTouchedAt.localeCompare(a.lastTouchedAt)
  }

  // Rule 5: Time in queue (older = higher priority to prevent starvation, should come first)
  return a.createdAt.localeCompare(b.createdAt)
}

/**
 * Computes the focus task and queue depth summary.
 *
 * The focus task is the single highest-priority actionable task based on the
 * priority rules defined in SPEC.md §3.1–3.2.
 *
 * Actionability rules:
 * - Task must not be archived
 * - Task must not be in backlog column
 * - Task must not have an active waiting trigger (pending, awaiting_approval, or polling status)
 *
 * @param db - Drizzle database instance
 * @returns FocusResult with the focus task (or null), its project and trigger, and queue depth
 */
export function computeFocus(db: AppDatabase): FocusResult {
  // Fetch all non-archived tasks with their projects
  const allTasks = db
    .select()
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.archived, false))
    .all()

  // Fetch all triggers for the tasks
  const taskIds = allTasks.map((row) => row.tasks.id)
  const allTriggers =
    taskIds.length > 0
      ? db.select().from(triggers).where(inArray(triggers.taskId, taskIds)).all()
      : []

  // Build a map of task ID -> triggers
  const triggersMap = new Map<number, Trigger[]>()
  for (const trigger of allTriggers) {
    const existing = triggersMap.get(trigger.taskId) || []
    existing.push(trigger)
    triggersMap.set(trigger.taskId, existing)
  }

  // Separate actionable vs waiting tasks
  const actionableTasks: TaskWithPriorityData[] = []
  let waitingCount = 0

  for (const row of allTasks) {
    const task = row.tasks
    const project = row.projects

    // Backlog tasks are never actionable for focus view
    if (task.column === TaskColumn.Backlog) {
      continue
    }

    const actionable = isTaskActionable(task.id, triggersMap)
    if (actionable) {
      actionableTasks.push({
        ...task,
        project,
        mostRecentFiredTrigger: getMostRecentFiredTrigger(task.id, triggersMap)
      })
    } else {
      waitingCount++
    }
  }

  // Sort by priority and take the top task
  actionableTasks.sort(comparePriority)
  const topTask = actionableTasks[0] || null

  return {
    task: topTask
      ? ({ ...topTask, project: undefined, mostRecentFiredTrigger: undefined } as Task)
      : null,
    project: topTask?.project || null,
    trigger: topTask?.mostRecentFiredTrigger || null,
    queueDepth: {
      actionable: actionableTasks.length,
      waiting: waitingCount
    }
  }
}

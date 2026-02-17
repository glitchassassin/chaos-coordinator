/**
 * Test data seeding utilities.
 *
 * All seeding goes through the IPC bridge (window.api.invoke) so it exercises
 * the same code paths as the real app. Call these from page.evaluate() context
 * after the app is loaded and the window is accessible.
 */

import type { Page } from 'playwright'

// ---------------------------------------------------------------------------
// Shared interfaces (mirror of shared/types/models but kept separate to avoid
// importing from the main/renderer source trees)
// ---------------------------------------------------------------------------

export interface SeededProject {
  id: number
  name: string
  colorPrimary: string
  colorAccent: string
  backgroundImage: string | null
  priorityRank: number
  repoAssociations: string[]
  createdAt: string
  updatedAt: string
}

export interface SeededTask {
  id: number
  title: string
  column: string
  projectId: number | null
  archived: boolean
  contextBlock: string | null
  columnChangedAt: string
  lastTouchedAt: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Create a project via IPC and return the created record.
 */
export async function seedProject(
  window: Page,
  data: {
    name: string
    colorPrimary?: string
    colorAccent?: string
    repoAssociations?: string[]
  }
): Promise<SeededProject> {
  return window.evaluate(async (d) => {
    // window.api is exposed by the preload script in the renderer context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.invoke('projects:create', {
      colorPrimary: '#6366f1',
      colorAccent: '#818cf8',
      repoAssociations: [],
      ...d
    })
  }, data) as Promise<SeededProject>
}

/**
 * Create a task via IPC and return the created record.
 */
export async function seedTask(
  window: Page,
  data: {
    title: string
    projectId?: number | null
    column?: 'backlog' | 'planning' | 'in_progress' | 'review'
    contextBlock?: string
  }
): Promise<SeededTask> {
  return window.evaluate(async (d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).api.invoke('tasks:create', {
      column: 'planning',
      ...d
    })
  }, data) as Promise<SeededTask>
}

/**
 * Delete all projects for a clean slate between tests.
 *
 * Note: tasks with `projectId = null` (orphaned by prior deletions) are NOT
 * removed because there is no `tasks:delete` IPC handler. However, these
 * orphaned tasks are excluded from all current views (Board uses inner join on
 * projectId, Focus uses inner join in computeFocus), so they don't affect
 * test results. If a future view starts showing unassigned tasks, add explicit
 * task cleanup here.
 */
export async function clearAllProjects(window: Page): Promise<void> {
  await window.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    const projects = await api.invoke('projects:list')
    await Promise.all(
      projects.map((p: { id: number }) => api.invoke('projects:delete', { id: p.id }))
    )
  })
}

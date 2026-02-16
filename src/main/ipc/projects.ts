import { ipcMain } from 'electron'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { projects, tasks } from '../db/schema'
import { Channels } from './channels'
import type { InsertProject } from '../../shared/types'

export function registerProjectHandlers(): void {
  ipcMain.handle(Channels.ProjectsList, () => {
    const db = getDb()
    return db.select().from(projects).all()
  })

  ipcMain.handle(Channels.ProjectsGet, (_event, { id }: { id: number }) => {
    const db = getDb()
    const result = db.select().from(projects).where(eq(projects.id, id)).get()
    return result ?? null
  })

  ipcMain.handle(Channels.ProjectsCreate, (_event, data: InsertProject) => {
    const db = getDb()
    const maxRank = db
      .select({ max: sql<number>`coalesce(max(${projects.priorityRank}), -1)` })
      .from(projects)
      .get()
    return db
      .insert(projects)
      .values({ ...data, priorityRank: (maxRank?.max ?? -1) + 1 })
      .returning()
      .get()
  })

  ipcMain.handle(
    Channels.ProjectsUpdate,
    (_event, { id, ...data }: { id: number } & Partial<InsertProject>) => {
      const db = getDb()
      return db
        .update(projects)
        .set({ ...data, updatedAt: sql<string>`datetime('now')` })
        .where(eq(projects.id, id))
        .returning()
        .get()
    }
  )

  ipcMain.handle(Channels.ProjectsDelete, (_event, { id }: { id: number }) => {
    const db = getDb()
    // Delete tasks first (FK dependency), then the project, in a single transaction
    try {
      db.transaction((tx) => {
        tx.delete(tasks).where(eq(tasks.projectId, id)).run()
        tx.delete(projects).where(eq(projects.id, id)).run()
      })
    } catch (err) {
      console.error(`Failed to delete project ${String(id)}:`, err)
      throw err
    }
  })
}

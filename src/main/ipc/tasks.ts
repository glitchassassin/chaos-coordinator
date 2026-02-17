import { ipcMain } from 'electron'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db'
import { tasks } from '../db/schema'
import { Channels } from './channels'
import { computeFocus } from '../priority'
import type { InsertTask } from '../../shared/types'

export function registerTaskHandlers(): void {
  ipcMain.handle(
    Channels.TasksList,
    (
      _event,
      { projectId, archived }: { projectId?: number; archived?: boolean } = {}
    ) => {
      const db = getDb()
      const conditions = []
      if (projectId !== undefined) {
        conditions.push(eq(tasks.projectId, projectId))
      }
      if (archived !== undefined) {
        conditions.push(eq(tasks.archived, archived))
      }
      if (conditions.length === 0) {
        return db.select().from(tasks).all()
      }
      return db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .all()
    }
  )

  ipcMain.handle(Channels.TasksGet, (_event, { id }: { id: number }) => {
    const db = getDb()
    const result = db.select().from(tasks).where(eq(tasks.id, id)).get()
    return result ?? null
  })

  ipcMain.handle(Channels.TasksCreate, (_event, data: InsertTask) => {
    const db = getDb()
    return db.insert(tasks).values(data).returning().get()
  })

  ipcMain.handle(
    Channels.TasksUpdate,
    (_event, { id, ...data }: { id: number } & Partial<InsertTask>) => {
      const db = getDb()
      const existing = db.select().from(tasks).where(eq(tasks.id, id)).get()
      const columnChanged =
        data.column !== undefined && existing && data.column !== existing.column
      const update = columnChanged
        ? { ...data, columnChangedAt: new Date().toISOString() }
        : data
      return db.update(tasks).set(update).where(eq(tasks.id, id)).returning().get()
    }
  )

  ipcMain.handle(Channels.TasksArchive, (_event, { id }: { id: number }) => {
    const db = getDb()
    return db
      .update(tasks)
      .set({ archived: true })
      .where(eq(tasks.id, id))
      .returning()
      .get()
  })

  ipcMain.handle(Channels.TasksFocus, () => {
    const db = getDb()
    return computeFocus(db)
  })
}

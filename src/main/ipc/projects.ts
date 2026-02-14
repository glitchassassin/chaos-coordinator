import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { projects } from '../db/schema'
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
    return db.insert(projects).values(data).returning().get()
  })

  ipcMain.handle(
    Channels.ProjectsUpdate,
    (_event, { id, ...data }: { id: number } & Partial<InsertProject>) => {
      const db = getDb()
      return db.update(projects).set(data).where(eq(projects.id, id)).returning().get()
    }
  )

  ipcMain.handle(Channels.ProjectsDelete, (_event, { id }: { id: number }) => {
    const db = getDb()
    db.delete(projects).where(eq(projects.id, id)).run()
  })
}

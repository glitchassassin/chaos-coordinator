import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { links } from '../db/schema'
import { Channels } from './channels'
import type { InsertLink } from '../../shared/types'

export function registerLinksHandlers(): void {
  ipcMain.handle(Channels.LinksList, (_event, { taskId }: { taskId: number }) => {
    const db = getDb()
    return db.select().from(links).where(eq(links.taskId, taskId)).all()
  })

  ipcMain.handle(Channels.LinksCreate, (_event, data: InsertLink) => {
    const db = getDb()
    return db.insert(links).values(data).returning().get()
  })

  ipcMain.handle(Channels.LinksDelete, (_event, { id }: { id: number }) => {
    const db = getDb()
    db.delete(links).where(eq(links.id, id)).run()
    return undefined
  })
}

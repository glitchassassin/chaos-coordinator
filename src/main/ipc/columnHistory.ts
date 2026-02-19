import { ipcMain } from 'electron'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db'
import { columnHistory } from '../db/schema'
import { Channels } from './channels'
import type { InsertColumnHistory } from '../../shared/types'

export function registerColumnHistoryHandlers(): void {
  ipcMain.handle(Channels.ColumnHistoryCreate, (_event, data: InsertColumnHistory) => {
    const db = getDb()
    return db.insert(columnHistory).values(data).returning().get()
  })

  ipcMain.handle(Channels.ColumnHistoryList, (_event, { taskId }: { taskId: number }) => {
    const db = getDb()
    return db
      .select()
      .from(columnHistory)
      .where(eq(columnHistory.taskId, taskId))
      .orderBy(asc(columnHistory.movedAt))
      .all()
  })
}

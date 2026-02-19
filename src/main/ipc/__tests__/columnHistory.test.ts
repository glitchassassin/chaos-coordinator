/* eslint-disable @typescript-eslint/unbound-method */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerColumnHistoryHandlers } from '../columnHistory'
import { Channels } from '../channels'
import { TaskColumn } from '../../../shared/types'
import type { InsertColumnHistory, ColumnHistory } from '../../../shared/types'

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  app: {
    getPath: vi.fn(() => '/tmp/test')
  }
}))

// Mock database
const mockGet = vi.fn()
const mockAll = vi.fn()
const mockDb = {
  insert: vi.fn(),
  select: vi.fn()
}

vi.mock('../../db', () => ({
  getDb: vi.fn(() => mockDb)
}))

vi.mock('../../db/schema', () => ({
  columnHistory: {}
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  asc: vi.fn()
}))

describe('ColumnHistory IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          get: mockGet
        })
      })
    })

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            all: mockAll
          })
        })
      })
    })
  })

  it('registers the columnHistory:create handler', () => {
    registerColumnHistoryHandlers()
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ColumnHistoryCreate,
      expect.any(Function)
    )
  })

  it('registers the columnHistory:list handler', () => {
    registerColumnHistoryHandlers()
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ColumnHistoryList,
      expect.any(Function)
    )
  })

  it('creates a column history record with the provided data', async () => {
    const mockRecord: ColumnHistory = {
      id: 1,
      taskId: 42,
      fromColumn: TaskColumn.Planning,
      toColumn: TaskColumn.InProgress,
      contextSnapshot: 'Working on the auth module. Next: write tests.',
      movedAt: '2024-01-15T10:00:00Z'
    }

    mockGet.mockReturnValue(mockRecord)
    registerColumnHistoryHandlers()

    // Extract the handler registered with ipcMain.handle
    const calls = vi.mocked(ipcMain.handle).mock.calls
    const handler = calls.find((call) => call[0] === Channels.ColumnHistoryCreate)?.[1]

    const input: InsertColumnHistory = {
      taskId: 42,
      fromColumn: TaskColumn.Planning,
      toColumn: TaskColumn.InProgress,
      contextSnapshot: 'Working on the auth module. Next: write tests.'
    }

    const result = (await handler?.(
      {} as Electron.IpcMainInvokeEvent,
      input
    )) as ColumnHistory

    expect(result).toEqual(mockRecord)
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('creates a column history record with null fromColumn', async () => {
    const mockRecord: ColumnHistory = {
      id: 2,
      taskId: 10,
      fromColumn: null,
      toColumn: TaskColumn.Planning,
      contextSnapshot: null,
      movedAt: '2024-01-15T11:00:00Z'
    }

    mockGet.mockReturnValue(mockRecord)
    registerColumnHistoryHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const handler = calls.find((call) => call[0] === Channels.ColumnHistoryCreate)?.[1]

    const input: InsertColumnHistory = {
      taskId: 10,
      toColumn: TaskColumn.Planning
    }

    const result = (await handler?.(
      {} as Electron.IpcMainInvokeEvent,
      input
    )) as ColumnHistory

    expect(result).toEqual(mockRecord)
  })

  it('lists column history for a given taskId in chronological order', async () => {
    const mockRecords: ColumnHistory[] = [
      {
        id: 1,
        taskId: 42,
        fromColumn: null,
        toColumn: TaskColumn.Planning,
        contextSnapshot: null,
        movedAt: '2024-01-01T10:00:00Z'
      },
      {
        id: 2,
        taskId: 42,
        fromColumn: TaskColumn.Planning,
        toColumn: TaskColumn.InProgress,
        contextSnapshot: 'Started work.',
        movedAt: '2024-01-02T10:00:00Z'
      }
    ]

    mockAll.mockReturnValue(mockRecords)
    registerColumnHistoryHandlers()

    const calls = vi.mocked(ipcMain.handle).mock.calls
    const handler = calls.find((call) => call[0] === Channels.ColumnHistoryList)?.[1]

    const result = (await handler?.({} as Electron.IpcMainInvokeEvent, {
      taskId: 42
    })) as ColumnHistory[]

    expect(result).toEqual(mockRecords)
    expect(mockDb.select).toHaveBeenCalled()
  })
})

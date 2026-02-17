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
const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        get: mockGet
      })
    })
  })
}

vi.mock('../../db', () => ({
  getDb: vi.fn(() => mockDb)
}))

vi.mock('../../db/schema', () => ({
  columnHistory: {}
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
  })

  it('registers the columnHistory:create handler', () => {
    registerColumnHistoryHandlers()
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ColumnHistoryCreate,
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
})

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerLinksHandlers } from '../links'
import { Channels } from '../channels'
import type { Link } from '../../../shared/types'

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
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn()
}

vi.mock('../../db', () => ({
  getDb: vi.fn(() => mockDb)
}))

describe('Links IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn()
        })
      })
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          get: vi.fn()
        })
      })
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        run: vi.fn()
      })
    })
  })

  it('registers all link handlers', () => {
    registerLinksHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(Channels.LinksList, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.LinksCreate,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.LinksDelete,
      expect.any(Function)
    )
  })

  describe('links:list', () => {
    it('returns all links for a given taskId', () => {
      registerLinksHandlers()

      const mockLinks: Link[] = [
        {
          id: 1,
          taskId: 42,
          url: 'https://github.com/org/repo/issues/1',
          label: 'Issue #1',
          sourceType: 'github_issue',
          isPrimary: false,
          createdAt: '2024-01-01'
        },
        {
          id: 2,
          taskId: 42,
          url: 'https://github.com/org/repo/pull/5',
          label: null,
          sourceType: 'github_pr',
          isPrimary: false,
          createdAt: '2024-01-02'
        }
      ]

      const allMock = vi.fn().mockReturnValue(mockLinks)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ all: allMock })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.LinksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { taskId: 42 })

      expect(result).toEqual(mockLinks)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('returns empty array when task has no links', () => {
      registerLinksHandlers()

      const allMock = vi.fn().mockReturnValue([])
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ all: allMock })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.LinksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { taskId: 99 })

      expect(result).toEqual([])
    })
  })

  describe('links:create', () => {
    it('inserts a link row and returns the new link', () => {
      registerLinksHandlers()

      const newLink: Link = {
        id: 10,
        taskId: 42,
        url: 'https://example.com',
        label: 'Example',
        sourceType: 'other',
        isPrimary: false,
        createdAt: '2024-01-01'
      }

      const getMock = vi.fn().mockReturnValue(newLink)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({ get: getMock })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.LinksCreate)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        taskId: 42,
        url: 'https://example.com',
        label: 'Example',
        sourceType: 'other'
      })

      expect(result).toEqual(newLink)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('links:delete', () => {
    it('deletes the link by id and returns undefined', () => {
      registerLinksHandlers()

      const runMock = vi.fn()
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({ run: runMock })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.LinksDelete)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 10 })

      expect(result).toBeUndefined()
      expect(mockDb.delete).toHaveBeenCalled()
      expect(runMock).toHaveBeenCalled()
    })
  })
})

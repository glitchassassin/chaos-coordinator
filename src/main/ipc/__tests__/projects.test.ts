/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerProjectHandlers } from '../projects'
import { Channels } from '../channels'
import type { InsertProject, Project } from '../../../shared/types'

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
  update: vi.fn(),
  delete: vi.fn()
}

vi.mock('../../db', () => ({
  getDb: vi.fn(() => mockDb)
}))

describe('Projects IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock chains
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn()
        }),
        all: vi.fn()
      })
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue({
          get: vi.fn()
        })
      })
    })

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: vi.fn()
          })
        })
      })
    })

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        run: vi.fn()
      })
    })
  })

  it('registers all project handlers', () => {
    registerProjectHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ProjectsList,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ProjectsGet,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ProjectsCreate,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ProjectsUpdate,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ProjectsDelete,
      expect.any(Function)
    )
  })

  describe('projects:list', () => {
    it('returns all projects', () => {
      registerProjectHandlers()

      const mockProjects: Project[] = [
        {
          id: 1,
          name: 'Project 1',
          colorPrimary: '#000000',
          colorAccent: '#ffffff',
          backgroundImage: null,
          priorityRank: 1,
          repoAssociations: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      ]

      const allMock = vi.fn().mockReturnValue(mockProjects)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          all: allMock
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent)

      expect(result).toEqual(mockProjects)
      expect(mockDb.select).toHaveBeenCalled()
    })
  })

  describe('projects:get', () => {
    it('returns a project by id', () => {
      registerProjectHandlers()

      const mockProject: Project = {
        id: 1,
        name: 'Test Project',
        colorPrimary: '#000000',
        colorAccent: '#ffffff',
        backgroundImage: null,
        priorityRank: 1,
        repoAssociations: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      const getMock = vi.fn().mockReturnValue(mockProject)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsGet)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 1 })

      expect(result).toEqual(mockProject)
    })

    it('returns null when project not found', () => {
      registerProjectHandlers()

      const getMock = vi.fn().mockReturnValue(undefined)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsGet)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 999 })

      expect(result).toBeNull()
    })
  })

  describe('projects:create', () => {
    it('creates a new project', () => {
      registerProjectHandlers()

      const insertData: InsertProject = {
        name: 'New Project',
        colorPrimary: '#000000'
      }

      const createdProject: Project = {
        id: 1,
        name: 'New Project',
        colorPrimary: '#000000',
        colorAccent: '#ffffff',
        backgroundImage: null,
        priorityRank: 0,
        repoAssociations: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      const getMock = vi.fn().mockReturnValue(createdProject)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsCreate)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, insertData)

      expect(result).toEqual(createdProject)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('projects:update', () => {
    it('updates an existing project', () => {
      registerProjectHandlers()

      const updatedProject: Project = {
        id: 1,
        name: 'Updated Project',
        colorPrimary: '#000000',
        colorAccent: '#ffffff',
        backgroundImage: null,
        priorityRank: 1,
        repoAssociations: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      }

      const getMock = vi.fn().mockReturnValue(updatedProject)
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              get: getMock
            })
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsUpdate)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        id: 1,
        name: 'Updated Project'
      })

      expect(result).toEqual(updatedProject)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('projects:delete', () => {
    it('deletes a project', () => {
      registerProjectHandlers()

      const runMock = vi.fn()
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: runMock
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.ProjectsDelete)?.[1]

      handler?.({} as Electron.IpcMainInvokeEvent, { id: 1 })

      expect(mockDb.delete).toHaveBeenCalled()
      expect(runMock).toHaveBeenCalled()
    })
  })
})

/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerTaskHandlers } from '../tasks'
import { Channels } from '../channels'
import { TaskColumn } from '../../../shared/types'
import type { InsertTask, Task } from '../../../shared/types'
import { computeFocus, type FocusResult } from '../../priority'

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
  update: vi.fn()
}

vi.mock('../../db', () => ({
  getDb: vi.fn(() => mockDb)
}))

vi.mock('../../priority', () => ({
  computeFocus: vi.fn()
}))

describe('Tasks IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock chains
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn(),
          all: vi.fn()
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
  })

  it('registers all task handlers', () => {
    registerTaskHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(Channels.TasksList, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(Channels.TasksGet, expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.TasksCreate,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.TasksUpdate,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.TasksArchive,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(Channels.TasksFocus, expect.any(Function))
  })

  describe('tasks:list', () => {
    it('returns all tasks when no filters provided', () => {
      registerTaskHandlers()

      const mockTasks: Task[] = [
        {
          id: 1,
          title: 'Task 1',
          contextBlock: null,
          column: TaskColumn.Backlog,
          projectId: 1,
          archived: false,
          columnChangedAt: '2024-01-01',
          lastTouchedAt: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      ]

      const allMock = vi.fn().mockReturnValue(mockTasks)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          all: allMock
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {})

      expect(result).toEqual(mockTasks)
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('filters tasks by projectId', () => {
      registerTaskHandlers()

      const mockTasks: Task[] = [
        {
          id: 1,
          title: 'Task 1',
          contextBlock: null,
          column: TaskColumn.Backlog,
          projectId: 1,
          archived: false,
          columnChangedAt: '2024-01-01',
          lastTouchedAt: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      ]

      const allMock = vi.fn().mockReturnValue(mockTasks)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: allMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { projectId: 1 })

      expect(result).toEqual(mockTasks)
    })

    it('filters tasks by archived status', () => {
      registerTaskHandlers()

      const mockTasks: Task[] = []

      const allMock = vi.fn().mockReturnValue(mockTasks)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: allMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { archived: false })

      expect(result).toEqual(mockTasks)
    })

    it('filters tasks by both projectId and archived', () => {
      registerTaskHandlers()

      const mockTasks: Task[] = []

      const allMock = vi.fn().mockReturnValue(mockTasks)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: allMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksList)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        projectId: 1,
        archived: false
      })

      expect(result).toEqual(mockTasks)
    })
  })

  describe('tasks:get', () => {
    it('returns a task by id', () => {
      registerTaskHandlers()

      const mockTask: Task = {
        id: 1,
        title: 'Test Task',
        contextBlock: null,
        column: TaskColumn.Backlog,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-01',
        lastTouchedAt: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      const getMock = vi.fn().mockReturnValue(mockTask)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksGet)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 1 })

      expect(result).toEqual(mockTask)
    })

    it('returns null when task not found', () => {
      registerTaskHandlers()

      const getMock = vi.fn().mockReturnValue(undefined)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksGet)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 999 })

      expect(result).toBeNull()
    })
  })

  describe('tasks:create', () => {
    it('creates a new task', () => {
      registerTaskHandlers()

      const insertData: InsertTask = {
        title: 'New Task',
        projectId: 1
      }

      const createdTask: Task = {
        id: 1,
        title: 'New Task',
        contextBlock: null,
        column: TaskColumn.Backlog,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-01',
        lastTouchedAt: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      const getMock = vi.fn().mockReturnValue(createdTask)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: getMock
          })
        })
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksCreate)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, insertData)

      expect(result).toEqual(createdTask)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('tasks:update', () => {
    it('updates an existing task', () => {
      registerTaskHandlers()

      const updatedTask: Task = {
        id: 1,
        title: 'Updated Task',
        contextBlock: null,
        column: TaskColumn.InProgress,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-02',
        lastTouchedAt: '2024-01-02',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      }

      const getMock = vi.fn().mockReturnValue(updatedTask)
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
      const handler = calls.find((call) => call[0] === Channels.TasksUpdate)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        id: 1,
        title: 'Updated Task',
        column: TaskColumn.InProgress
      })

      expect(result).toEqual(updatedTask)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('sets columnChangedAt when column actually changes', () => {
      registerTaskHandlers()

      const existingTask: Task = {
        id: 1,
        title: 'Task',
        contextBlock: null,
        column: TaskColumn.Backlog,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-01',
        lastTouchedAt: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(existingTask),
            all: vi.fn()
          }),
          all: vi.fn()
        })
      })

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(existingTask)
          })
        })
      })
      mockDb.update.mockReturnValue({ set: setMock })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksUpdate)?.[1]

      handler?.({} as Electron.IpcMainInvokeEvent, {
        id: 1,
        column: TaskColumn.Planning
      })

      expect(setMock).toHaveBeenCalledOnce()
      const [firstCall] = setMock.mock.calls
      const calledWith = firstCall?.[0] as Record<string, unknown>
      expect(calledWith).toHaveProperty('column', TaskColumn.Planning)
      expect(calledWith).toHaveProperty('columnChangedAt')
    })

    it('does not set columnChangedAt when column is unchanged', () => {
      registerTaskHandlers()

      const existingTask: Task = {
        id: 1,
        title: 'Task',
        contextBlock: null,
        column: TaskColumn.Planning,
        projectId: 1,
        archived: false,
        columnChangedAt: '2024-01-01',
        lastTouchedAt: '2024-01-01',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(existingTask),
            all: vi.fn()
          }),
          all: vi.fn()
        })
      })

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(existingTask)
          })
        })
      })
      mockDb.update.mockReturnValue({ set: setMock })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksUpdate)?.[1]

      handler?.({} as Electron.IpcMainInvokeEvent, {
        id: 1,
        title: 'Updated title',
        column: TaskColumn.Planning
      })

      expect(setMock).toHaveBeenCalledOnce()
      const [firstCall] = setMock.mock.calls
      const calledWith = firstCall?.[0] as Record<string, unknown>
      expect(calledWith).not.toHaveProperty('columnChangedAt')
    })
  })

  describe('tasks:archive', () => {
    it('archives a task', () => {
      registerTaskHandlers()

      const archivedTask: Task = {
        id: 1,
        title: 'Task',
        contextBlock: null,
        column: TaskColumn.Review,
        projectId: 1,
        archived: true,
        columnChangedAt: '2024-01-02',
        lastTouchedAt: '2024-01-02',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02'
      }

      const getMock = vi.fn().mockReturnValue(archivedTask)
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
      const handler = calls.find((call) => call[0] === Channels.TasksArchive)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, { id: 1 })

      expect(result).toEqual(archivedTask)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('tasks:focus', () => {
    it('computes focus using priority engine', () => {
      registerTaskHandlers()

      const mockFocusResult: FocusResult = {
        task: {
          id: 1,
          title: 'Focus Task',
          contextBlock: null,
          column: TaskColumn.Backlog,
          projectId: 1,
          archived: false,
          columnChangedAt: '2024-01-01',
          lastTouchedAt: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        },
        project: {
          id: 1,
          name: 'Test Project',
          colorPrimary: '#000000',
          colorAccent: '#ffffff',
          backgroundImage: null,
          priorityRank: 1,
          repoAssociations: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        },
        trigger: null,
        links: [],
        queueDepth: {
          actionable: 5,
          waiting: 2
        }
      }

      vi.mocked(computeFocus).mockReturnValue(mockFocusResult)

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((call) => call[0] === Channels.TasksFocus)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent)

      expect(result).toEqual(mockFocusResult)
      expect(computeFocus).toHaveBeenCalledWith(mockDb)
    })
  })
})

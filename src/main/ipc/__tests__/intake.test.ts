import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron ipcMain before importing intake
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../../db', () => ({
  getDb: vi.fn()
}))

vi.mock('../../db/schema', () => ({
  projects: {},
  tasks: {},
  links: {}
}))

vi.mock('../../cli/urlParser', () => ({
  parseUrl: vi.fn(),
  getRepoKey: vi.fn()
}))

vi.mock('../../cli/executor', () => ({
  execCli: vi.fn()
}))

vi.mock('../../llm', () => ({
  generate: vi.fn()
}))

import { ipcMain } from 'electron'
import { getDb } from '../../db'
import { parseUrl, getRepoKey } from '../../cli/urlParser'
import { execCli } from '../../cli/executor'
import { generate } from '../../llm'
import { registerIntakeHandlers } from '../intake'
import { BOARD_PUSH_CHANNEL } from '../../../shared/types/ipc'

const mockIpcMain = vi.mocked(ipcMain)
const mockGetDb = vi.mocked(getDb)
const mockParseUrl = vi.mocked(parseUrl)
const mockGetRepoKey = vi.mocked(getRepoKey)
const mockExecCli = vi.mocked(execCli)
const mockGenerate = vi.mocked(generate)

// Capture registered handlers by channel name
type AnyHandler = (_event: unknown, args: unknown) => Promise<unknown>
const capturedHandlers = new Map<string, AnyHandler>()

describe('intake:fetchMetadata IPC handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandlers.clear()

    mockIpcMain.handle.mockImplementation((channel: unknown, fn: unknown) => {
      capturedHandlers.set(channel as string, fn as AnyHandler)
      return ipcMain
    })

    registerIntakeHandlers()
    expect(capturedHandlers.has('intake:fetchMetadata')).toBe(true)
  })

  const call = (url: string) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified by expect above
    return capturedHandlers.get('intake:fetchMetadata')!(null, { url })
  }

  it('returns URL as title immediately for "other" type URLs', async () => {
    mockParseUrl.mockReturnValue({ type: 'other' })

    const result = await call('https://example.com/foo')

    expect(result).toEqual({
      title: 'https://example.com/foo',
      contextBlock: '',
      sourceType: 'other',
      repoKey: null,
      matchedProjectId: null
    })
    expect(mockExecCli).not.toHaveBeenCalled()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('returns null when CLI fails (ENOENT or auth failure)', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 42
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      })
    } as unknown as ReturnType<typeof getDb>)
    mockExecCli.mockResolvedValue(null)

    const result = await call('https://github.com/org/repo/issues/42')
    expect(result).toBeNull()
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('project auto-association: matches repoKey against repoAssociations', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('org/repo')

    const mockProject = { id: 99, repoAssociations: ['org/repo'] }
    const mockSelect = {
      from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([mockProject]) })
    }
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue(mockSelect)
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue(
      '{"title":"Fix bug","body":"details","state":"open","labels":[],"assignees":[]}'
    )
    mockGenerate.mockResolvedValue('Context summary here.')

    const result = await call('https://github.com/org/repo/issues/1')
    expect(result).toMatchObject({ matchedProjectId: 99, repoKey: 'org/repo' })
  })

  it('project auto-association: unmatched repo returns matchedProjectId null', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'other',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('other/repo')

    const mockProject = { id: 5, repoAssociations: ['org/repo'] }
    const mockSelect = {
      from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([mockProject]) })
    }
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue(mockSelect)
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue(
      '{"title":"Unrelated","body":"","state":"open","labels":[],"assignees":[]}'
    )
    mockGenerate.mockResolvedValue('Some context.')

    const result = await call('https://github.com/other/repo/issues/1')
    expect(result).toMatchObject({ matchedProjectId: null })
  })

  it('happy path: returns title, contextBlock, sourceType, repoKey on success', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_pr',
      owner: 'org',
      repo: 'repo',
      number: 5
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      })
    } as unknown as ReturnType<typeof getDb>)

    const metadataJson =
      '{"title":"Add feature X","body":"implements X","state":"open","labels":[]}'
    mockExecCli.mockResolvedValue(metadataJson)
    mockGenerate.mockResolvedValue(
      'This PR adds feature X. Key constraint: must not break Y. Next action: review the diff.'
    )

    const result = (await call('https://github.com/org/repo/pull/5')) as {
      title: string
      contextBlock: string
      sourceType: string
      repoKey: string | null
    }

    expect(result.title).toBe('Add feature X')
    expect(result.contextBlock).toBe(
      'This PR adds feature X. Key constraint: must not break Y. Next action: review the diff.'
    )
    expect(result.sourceType).toBe('github_pr')
    expect(result.repoKey).toBe('org/repo')
  })

  it('LLM failure: still returns extracted title with empty contextBlock', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 10
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      })
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue(
      '{"title":"Crash on startup","body":"steps...","state":"open","labels":[],"assignees":[]}'
    )
    mockGenerate.mockRejectedValue(new Error('LLM unavailable'))

    const result = (await call('https://github.com/org/repo/issues/10')) as {
      title: string
      contextBlock: string
    }

    // Should still return result (not null) with extracted title
    expect(result).not.toBeNull()
    expect(result.title).toBe('Crash on startup')
    expect(result.contextBlock).toBe('')
  })

  it('Azure DevOps: uses full org URL in CLI args', async () => {
    mockParseUrl.mockReturnValue({
      type: 'azure_devops',
      org: 'myorg',
      project: 'myproject',
      id: 42
    })
    mockGetRepoKey.mockReturnValue('myorg/myproject')
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      })
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue(
      '{"id":42,"fields":{"System.Title":"Deploy new service"}}'
    )
    mockGenerate.mockResolvedValue('Context about deploying the service.')

    await call('https://dev.azure.com/myorg/myproject/_workitems/edit/42')

    expect(mockExecCli).toHaveBeenCalledWith('az', [
      'boards',
      'work-item',
      'show',
      '--id',
      '42',
      '--org',
      'https://dev.azure.com/myorg'
    ])
  })

  it('Azure DevOps: extracts title from System.Title field', async () => {
    mockParseUrl.mockReturnValue({
      type: 'azure_devops',
      org: 'myorg',
      project: 'myproject',
      id: 7
    })
    mockGetRepoKey.mockReturnValue('myorg/myproject')
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      })
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue('{"id":7,"fields":{"System.Title":"Onboard new team"}}')
    mockGenerate.mockResolvedValue('Onboarding context.')

    const result = (await call(
      'https://dev.azure.com/myorg/myproject/_workitems/edit/7'
    )) as { title: string }
    expect(result.title).toBe('Onboard new team')
  })
})

describe('intake:processTask IPC handler', () => {
  const mockSend = vi.fn()
  const mockEvent = { sender: { send: mockSend } }

  const mockRun = vi.fn()
  const mockWhere = vi.fn().mockReturnValue({ run: mockRun })
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
  const mockValuesRun = vi.fn()
  const mockValues = vi.fn().mockReturnValue({ run: mockValuesRun })
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandlers.clear()

    mockIpcMain.handle.mockImplementation((channel: unknown, fn: unknown) => {
      capturedHandlers.set(channel as string, fn as AnyHandler)
      return ipcMain
    })

    registerIntakeHandlers()
    expect(capturedHandlers.has('intake:processTask')).toBe(true)

    // Default DB mock supports both select (project lookup) and write operations
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) })
      }),
      update: mockUpdate,
      insert: mockInsert
    } as unknown as ReturnType<typeof getDb>)
  })

  const call = (url: string, taskId = 10, projectId = 1) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified by expect above
    return capturedHandlers.get('intake:processTask')!(mockEvent, {
      url,
      taskId,
      projectId
    })
  }

  it('success: updates task and creates link, sends success push event', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockExecCli.mockResolvedValue(
      '{"title":"Fix bug","body":"details","state":"open","labels":[],"assignees":[]}'
    )
    mockGenerate.mockResolvedValue('Summary context.')

    await call('https://github.com/org/repo/issues/1', 10, 1)

    // DB writes should have occurred
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fix bug', contextBlock: 'Summary context.' })
    )
    expect(mockInsert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 10,
        url: 'https://github.com/org/repo/issues/1',
        sourceType: 'github_issue',
        isPrimary: true
      })
    )

    // Push event should report success
    expect(mockSend).toHaveBeenCalledWith(BOARD_PUSH_CHANNEL, {
      taskId: 10,
      success: true
    })
  })

  it('null result (CLI unavailable): no DB writes, sends failure push event', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockExecCli.mockResolvedValue(null) // CLI not installed or failed

    await call('https://github.com/org/repo/issues/1', 10, 1)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledWith(BOARD_PUSH_CHANNEL, {
      taskId: 10,
      success: false
    })
  })

  it('unexpected error: sends failure push event (graceful degradation)', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('org/repo')
    mockExecCli.mockRejectedValue(new Error('Network error'))

    await call('https://github.com/org/repo/issues/1', 10, 1)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledWith(BOARD_PUSH_CHANNEL, {
      taskId: 10,
      success: false
    })
  })

  it('uses matchedProjectId from repo auto-association when available', async () => {
    mockParseUrl.mockReturnValue({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 1
    })
    mockGetRepoKey.mockReturnValue('org/repo')

    // Override DB mock to return a matched project
    const matchedProject = { id: 99, repoAssociations: ['org/repo'] }
    mockGetDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([matchedProject]) })
      }),
      update: mockUpdate,
      insert: mockInsert
    } as unknown as ReturnType<typeof getDb>)

    mockExecCli.mockResolvedValue(
      '{"title":"Matched","body":"","state":"open","labels":[]}'
    )
    mockGenerate.mockResolvedValue('Context.')

    await call('https://github.com/org/repo/issues/1', 10, 1)

    // projectId should be the matched project (99), not the original (1)
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ projectId: 99 }))
  })
})

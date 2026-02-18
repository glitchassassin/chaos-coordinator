import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron ipcMain before importing intake
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../../db', () => ({
  getDb: vi.fn()
}))

vi.mock('../../db/schema', () => ({
  projects: {}
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

const mockIpcMain = vi.mocked(ipcMain)
const mockGetDb = vi.mocked(getDb)
const mockParseUrl = vi.mocked(parseUrl)
const mockGetRepoKey = vi.mocked(getRepoKey)
const mockExecCli = vi.mocked(execCli)
const mockGenerate = vi.mocked(generate)

// Capture the registered IPC handler so tests can invoke it directly
let handler: ((_event: unknown, args: { url: string }) => Promise<unknown>) | null = null

describe('intake:fetchMetadata IPC handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handler = null

    mockIpcMain.handle.mockImplementation((_channel: unknown, fn: unknown) => {
      handler = fn as typeof handler
      return ipcMain
    })

    registerIntakeHandlers()
    expect(handler).not.toBeNull()
  })

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified non-null by expect above
  const call = (url: string) => handler!(null, { url })

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

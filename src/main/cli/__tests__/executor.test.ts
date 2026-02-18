import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChildProcess } from 'child_process'

// vi.mock is hoisted before imports, so child_process is mocked before executor.ts loads.
// executor.ts calls promisify(execFile) at module init — the real promisify wraps the vi.fn(),
// so changing mockImplementation between tests controls the async behavior correctly.
vi.mock('child_process', () => ({
  execFile: vi.fn()
}))

import { execCli } from '../executor'
import { execFile } from 'child_process'

const mockExecFile = vi.mocked(execFile)
// Stub ChildProcess returned by the mock (promisify ignores the return value)
const stubProcess = {} as ChildProcess

describe('execCli', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns stdout on success', async () => {
    mockExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
        ;(callback as (err: null, res: { stdout: string; stderr: string }) => void)(
          null,
          {
            stdout: '{"title":"Fix bug #42"}',
            stderr: ''
          }
        )
        return stubProcess
      }
    )

    const result = await execCli('gh', ['issue', 'view', '42'])
    expect(result).toBe('{"title":"Fix bug #42"}')
    expect(mockExecFile).toHaveBeenCalledWith(
      'gh',
      ['issue', 'view', '42'],
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('returns null when CLI is not installed (ENOENT)', async () => {
    const enoentError = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' })
    mockExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
        ;(callback as (err: Error) => void)(enoentError)
        return stubProcess
      }
    )

    const result = await execCli('gh', ['issue', 'view', '42'])
    expect(result).toBeNull()
  })

  it('returns null on non-zero exit (auth failure, network error, etc.)', async () => {
    const authError = Object.assign(new Error('Command failed: gh issue view 42'), {
      code: 1
    })
    mockExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
        ;(callback as (err: Error) => void)(authError)
        return stubProcess
      }
    )

    const result = await execCli('gh', ['issue', 'view', '42'])
    expect(result).toBeNull()
  })
})

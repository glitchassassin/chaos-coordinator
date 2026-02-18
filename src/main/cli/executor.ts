import { execFile } from 'child_process'
import { promisify } from 'util'
import { trackAsync } from '../debug'

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_MS = 15_000

async function execCliImpl(
  command: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      encoding: 'utf-8'
    })
    return stdout
  } catch {
    return null
  }
}

/**
 * Execute a CLI command and return its stdout, or null on failure.
 * Returns null for graceful degradation cases:
 *   - ENOENT: CLI not installed
 *   - non-zero exit: auth failure, not found, network error, etc.
 */
export const execCli = trackAsync(
  'cli:exec',
  (command: string, args: string[]) => `${command} ${args.join(' ')}`.slice(0, 80),
  execCliImpl
)

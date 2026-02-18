import { useState, useEffect } from 'react'
import type { AsyncTaskEvent, AsyncTaskStatus } from '../../../../shared/types/debug'

interface AsyncTaskPanelProps {
  events: AsyncTaskEvent[]
}

interface Operation {
  operationId: string
  taskType: string
  label: string
  startedAt: number
  status: AsyncTaskStatus
  elapsedMs?: number
  error?: string
}

function buildOperations(events: AsyncTaskEvent[]): Operation[] {
  const ops = new Map<string, Operation>()

  for (const event of events) {
    if (event.status === 'started') {
      ops.set(event.operationId, {
        operationId: event.operationId,
        taskType: event.taskType,
        label: event.label,
        startedAt: event.timestamp,
        status: 'started'
      })
    } else {
      const op = ops.get(event.operationId)
      if (op) {
        op.status = event.status
        if (event.elapsedMs !== undefined) op.elapsedMs = event.elapsedMs
        if (event.error !== undefined) op.error = event.error
      }
    }
  }

  const all = Array.from(ops.values())
  const inFlight = all
    .filter((o) => o.status === 'started')
    .sort((a, b) => b.startedAt - a.startedAt)
  const done = all
    .filter((o) => o.status !== 'started')
    .sort((a, b) => b.startedAt - a.startedAt)
  return [...inFlight, ...done]
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 100)
    return () => {
      clearInterval(interval)
    }
  }, [startedAt])

  return <span>{(elapsed / 1000).toFixed(1)}s</span>
}

const statusColors: Record<AsyncTaskStatus, string> = {
  started: 'text-blue-400 animate-pulse',
  completed: 'text-green-400',
  failed: 'text-red-400'
}

const statusLabels: Record<AsyncTaskStatus, string> = {
  started: '⟳ running',
  completed: '✓ done',
  failed: '✗ failed'
}

export default function AsyncTaskPanel({ events }: AsyncTaskPanelProps) {
  const operations = buildOperations(events)

  return (
    <div className="h-full overflow-auto">
      {operations.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          No async tasks recorded
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-700 text-left text-gray-400">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Started</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr
                key={op.operationId}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className={`px-3 py-1.5 font-medium ${statusColors[op.status]}`}>
                  {statusLabels[op.status]}
                </td>
                <td className="px-3 py-1.5 text-gray-400">{op.taskType}</td>
                <td
                  className="max-w-xs truncate px-3 py-1.5 text-gray-200"
                  title={op.label}
                >
                  {op.label}
                  {op.error && (
                    <span className="ml-2 text-red-400" title={op.error}>
                      ({op.error.slice(0, 40)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-400 tabular-nums">
                  {op.status === 'started' ? (
                    <ElapsedTimer startedAt={op.startedAt} />
                  ) : op.elapsedMs !== undefined ? (
                    <>{op.elapsedMs}ms</>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-1.5 text-gray-500 tabular-nums">
                  {new Date(op.startedAt).toLocaleTimeString('en', { hour12: false })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import type { LogEvent, LogLevel, LogSource } from '../../../../shared/types/debug'

interface LogStreamPanelProps {
  events: LogEvent[]
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const SOURCES: LogSource[] = ['llm', 'ipc', 'db', 'cli', 'config', 'app']

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const levelColors: Record<LogLevel, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400'
}

const levelBg: Record<LogLevel, string> = {
  debug: 'bg-gray-800',
  info: 'bg-blue-900/20',
  warn: 'bg-yellow-900/20',
  error: 'bg-red-900/20'
}

export default function LogStreamPanel({ events }: LogStreamPanelProps) {
  const [minLevel, setMinLevel] = useState<LogLevel>('debug')
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = events.filter((e) => {
    if (levelOrder[e.level] < levelOrder[minLevel]) return false
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false
    return true
  })

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered.length, autoScroll])

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-800 p-3">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-400">Min level:</label>
          <select
            value={minLevel}
            onChange={(e) => {
              setMinLevel(e.target.value as LogLevel)
            }}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-100"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-400">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as LogSource | 'all')
            }}
            className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-100"
          >
            <option value="all">all</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setAutoScroll((v) => !v)
          }}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            autoScroll ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-300'
          }`}
        >
          {autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        </button>
        <span className="ml-auto text-xs text-gray-500">{filtered.length} entries</span>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            No log entries
          </div>
        ) : (
          filtered.map((event) => (
            <div
              key={event.id}
              className={`border-b border-gray-800/50 px-3 py-1 ${levelBg[event.level]}`}
            >
              <div className="flex items-start gap-2">
                <span className="w-14 shrink-0 text-gray-500">
                  {new Date(event.timestamp).toLocaleTimeString('en', { hour12: false })}
                </span>
                <span className={`w-10 shrink-0 font-bold ${levelColors[event.level]}`}>
                  {event.level.toUpperCase().slice(0, 4)}
                </span>
                <span className="w-12 shrink-0 text-gray-500">[{event.source}]</span>
                <span className="flex-1 break-all text-gray-200">{event.message}</span>
                {event.data !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleExpand(event.id)
                    }}
                    className="shrink-0 text-gray-500 hover:text-gray-300"
                    aria-label="Toggle data"
                  >
                    {expandedIds.has(event.id) ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {event.data !== undefined && expandedIds.has(event.id) && (
                <pre className="mt-1 ml-36 overflow-auto rounded bg-gray-900 p-2 text-gray-300">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

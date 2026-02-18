import { useState } from 'react'
import type { IpcTrafficEvent } from '../../../../shared/types/debug'

interface IpcTrafficPanelProps {
  events: IpcTrafficEvent[]
}

type SortKey = 'timestamp' | 'durationMs'

export default function IpcTrafficPanel({ events }: IpcTrafficPanelProps) {
  const [channelFilter, setChannelFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('timestamp')
  const [sortDesc, setSortDesc] = useState(true)

  const filtered = events.filter((e) =>
    channelFilter ? e.channel.includes(channelFilter) : true
  )

  const sorted = [...filtered].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDesc ? -diff : diff
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc((v) => !v)
    } else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  function SortHeader({ label, sk }: { label: string; sk: SortKey }) {
    const active = sortKey === sk
    return (
      <button
        type="button"
        onClick={() => {
          toggleSort(sk)
        }}
        className={`flex items-center gap-1 text-left ${active ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
      >
        {label}
        {active && <span>{sortDesc ? '↓' : '↑'}</span>}
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-800 p-3">
        <input
          type="text"
          placeholder="Filter by channel..."
          value={channelFilter}
          onChange={(e) => {
            setChannelFilter(e.target.value)
          }}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <span className="ml-auto text-xs text-gray-500">{sorted.length} requests</span>
      </div>

      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            No IPC traffic recorded
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="border-b border-gray-700 text-left">
                <th className="px-3 py-2">
                  <SortHeader label="Time" sk="timestamp" />
                </th>
                <th className="px-3 py-2 text-gray-400">Channel</th>
                <th className="px-3 py-2">
                  <SortHeader label="Duration" sk="durationMs" />
                </th>
                <th className="px-3 py-2 text-gray-400">Req</th>
                <th className="px-3 py-2 text-gray-400">Res</th>
                <th className="px-3 py-2 text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  title={event.error}
                >
                  <td className="px-3 py-1.5 text-gray-500 tabular-nums">
                    {new Date(event.timestamp).toLocaleTimeString('en', {
                      hour12: false
                    })}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-gray-200">{event.channel}</td>
                  <td
                    className={`px-3 py-1.5 tabular-nums ${
                      event.durationMs > 1000
                        ? 'text-red-400'
                        : event.durationMs > 200
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                    }`}
                  >
                    {event.durationMs}ms
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 tabular-nums">
                    {event.requestSize}b
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 tabular-nums">
                    {event.responseSize}b
                  </td>
                  <td className="px-3 py-1.5">
                    {event.success ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-red-400" title={event.error}>
                        ✗
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

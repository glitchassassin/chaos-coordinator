import { useState } from 'react'
import { useDebugEvents } from '../hooks/useDebugEvents'
import LogStreamPanel from './debug/LogStreamPanel'
import AsyncTaskPanel from './debug/AsyncTaskPanel'
import IpcTrafficPanel from './debug/IpcTrafficPanel'
import type {
  LogEvent,
  AsyncTaskEvent,
  IpcTrafficEvent
} from '../../../shared/types/debug'

type Panel = 'logs' | 'async' | 'ipc'

export default function DebugView() {
  const [activePanel, setActivePanel] = useState<Panel>('ipc')
  const events = useDebugEvents()

  const logEvents = events.filter((e): e is LogEvent => e.type === 'log')
  const asyncEvents = events.filter((e): e is AsyncTaskEvent => e.type === 'async-task')
  const ipcEvents = events.filter((e): e is IpcTrafficEvent => e.type === 'ipc-traffic')

  function handleClear() {
    // Reload to get a fresh subscription from the ring buffer
    window.location.reload()
  }

  const asyncOpCount = new Set(asyncEvents.map((e) => e.operationId)).size

  const tabs: { id: Panel; label: string; count: number }[] = [
    { id: 'logs', label: 'Logs', count: logEvents.length },
    { id: 'async', label: 'Async Tasks', count: asyncOpCount },
    { id: 'ipc', label: 'IPC Traffic', count: ipcEvents.length }
  ]

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center border-b border-gray-800 px-4 py-2">
        <h1 className="text-sm font-semibold text-gray-300">Debug</h1>
        <div className="ml-4 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActivePanel(tab.id)
              }}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                activePanel === tab.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-gray-500">({tab.count})</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="ml-auto text-xs text-gray-500 transition-colors hover:text-gray-300"
          aria-label="Clear debug log"
        >
          Clear
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'logs' && <LogStreamPanel events={logEvents} />}
        {activePanel === 'async' && <AsyncTaskPanel events={asyncEvents} />}
        {activePanel === 'ipc' && <IpcTrafficPanel events={ipcEvents} />}
      </div>
    </div>
  )
}

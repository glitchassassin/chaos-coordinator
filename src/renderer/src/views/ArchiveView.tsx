import { useCallback, useEffect, useState } from 'react'
import type { Task, Project, Link, ColumnHistory } from '@shared/types/models'
import { formatTimestamp } from '@shared/lib/time-utils'
import LinkIcon from '../components/LinkIcon'

interface ArchivedTaskRecord {
  task: Task
  project: Project | null
  links: Link[]
  history: ColumnHistory[]
}

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  planning: 'Planning',
  in_progress: 'In Progress',
  review: 'Review/Verify'
}

/** Get the completion timestamp: last history movedAt, or task updatedAt */
function completedAt(record: ArchivedTaskRecord): string {
  return record.history.at(-1)?.movedAt ?? record.task.updatedAt
}

export default function ArchiveView() {
  const [records, setRecords] = useState<ArchivedTaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const loadArchive = useCallback(async () => {
    try {
      const [archivedTasks, allProjects] = await Promise.all([
        window.api.invoke('tasks:list', { archived: true }),
        window.api.invoke('projects:list')
      ])

      const projectMap = new Map(allProjects.map((p) => [p.id, p]))

      const enriched = await Promise.all(
        archivedTasks.map(async (task) => {
          const [links, history] = await Promise.all([
            window.api.invoke('links:list', { taskId: task.id }),
            window.api.invoke('columnHistory:list', { taskId: task.id })
          ])
          return {
            task,
            project:
              task.projectId !== null ? (projectMap.get(task.projectId) ?? null) : null,
            links,
            history
          }
        })
      )

      // Sort by completion time, most recent first
      enriched.sort((a, b) => {
        const dateA = new Date(completedAt(a)).getTime()
        const dateB = new Date(completedAt(b)).getTime()
        return dateB - dateA
      })

      setRecords(enriched)
    } catch {
      // silently fail — empty state shown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  const toggleExpand = (taskId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const filtered = records.filter((r) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      r.task.title.toLowerCase().includes(term) ||
      (r.task.contextBlock?.toLowerCase().includes(term) ?? false)
    )
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-200">Archive</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          placeholder="Search tasks…"
          aria-label="Search archived tasks"
          className="w-64 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            <p>Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">
              {search.trim() ? 'No tasks match your search.' : 'No completed tasks yet.'}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {filtered.map((record) => (
              <ArchivedTaskCard
                key={record.task.id}
                record={record}
                expanded={expandedIds.has(record.task.id)}
                onToggle={() => {
                  toggleExpand(record.task.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ArchivedTaskCardProps {
  record: ArchivedTaskRecord
  expanded: boolean
  onToggle: () => void
}

function ArchivedTaskCard({ record, expanded, onToggle }: ArchivedTaskCardProps) {
  const { task, project, links, history } = record
  const completedDate = completedAt(record)

  return (
    <div
      className="rounded-lg border border-gray-800 bg-gray-900"
      data-testid="archived-task-card"
    >
      {/* Compact header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-gray-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {project && (
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.colorPrimary }}
                aria-hidden="true"
              />
            )}
            <span className="truncate text-sm font-medium text-gray-200">
              {task.title}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {project && <span>{project.name}</span>}
            <span>
              Completed{' '}
              <time dateTime={completedDate}>{formatTimestamp(completedDate)}</time>
            </span>
            <span>
              Created{' '}
              <time dateTime={task.createdAt}>{formatTimestamp(task.createdAt)}</time>
            </span>
          </div>
        </div>
        <svg
          className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-4 border-t border-gray-800 px-4 py-3">
          {/* Context block */}
          {task.contextBlock && (
            <div>
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Context
              </h3>
              <p className="text-sm whitespace-pre-wrap text-gray-300">
                {task.contextBlock}
              </p>
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Links
              </h3>
              <div className="space-y-1.5">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center gap-2">
                    <span className="text-gray-500">
                      <LinkIcon sourceType={link.sourceType} />
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-sm text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      {link.label ?? link.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column history timeline */}
          {history.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                History
              </h3>
              <ol className="space-y-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-600" />
                    <div className="min-w-0">
                      <div className="text-gray-300">
                        {entry.fromColumn ? (
                          <>
                            <span>
                              {COLUMN_LABELS[entry.fromColumn] ?? entry.fromColumn}
                            </span>
                            <span className="mx-1 text-gray-500">→</span>
                            <span>{COLUMN_LABELS[entry.toColumn] ?? entry.toColumn}</span>
                          </>
                        ) : (
                          <span>
                            Created in {COLUMN_LABELS[entry.toColumn] ?? entry.toColumn}
                          </span>
                        )}
                      </div>
                      <time dateTime={entry.movedAt} className="text-xs text-gray-500">
                        {formatTimestamp(entry.movedAt)}
                      </time>
                      {entry.contextSnapshot && (
                        <p className="mt-1 text-xs whitespace-pre-wrap text-gray-400">
                          {entry.contextSnapshot}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

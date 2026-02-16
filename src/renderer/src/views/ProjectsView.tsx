import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project, InsertProject } from '@shared/types/models'
import { textColorOn } from '@shared/lib/color-utils'
import PalettePicker from '../components/PalettePicker'
import Modal from '../components/Modal'
import ToastNotification from '../components/Toast'
import { useToast } from '../hooks/useToast'

const DEFAULT_PRIMARY = '#6366f1'
const DEFAULT_ACCENT = '#818cf8'

/** Convert a stored image path to a media:// URL served by the main process */
function imageUrl(storedPath: string): string {
  const filename = storedPath.split(/[/\\]/).pop() ?? storedPath
  return `media://project-images/${filename}`
}

interface ProjectFormData {
  name: string
  colorPrimary: string
  colorAccent: string
  backgroundImage: string | null
  repoAssociations: string[]
}

function emptyForm(): ProjectFormData {
  return {
    name: '',
    colorPrimary: DEFAULT_PRIMARY,
    colorAccent: DEFAULT_ACCENT,
    backgroundImage: null,
    repoAssociations: []
  }
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProjectFormData>(emptyForm())
  const [palette, setPalette] = useState<string[]>([])
  const { toast, showToast } = useToast()
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [repoInput, setRepoInput] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const loadProjects = useCallback(async () => {
    const result = await window.api.invoke('projects:list')
    result.sort((a, b) => a.priorityRank - b.priorityRank)
    setProjects(result)
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setPalette([])
    setShowForm(true)
  }

  const openEdit = (project: Project) => {
    setEditingId(project.id)
    setForm({
      name: project.name,
      colorPrimary: project.colorPrimary,
      colorAccent: project.colorAccent,
      backgroundImage: project.backgroundImage,
      repoAssociations: [...project.repoAssociations]
    })
    setPalette([])
    setShowForm(true)

    if (project.backgroundImage) {
      void window.api
        .invoke('colors:extract-palette', { imagePath: project.backgroundImage })
        .then((result) => {
          setPalette(result.colors)
        })
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    setPalette([])
    setRepoInput('')
  }

  const handleChooseImage = async () => {
    try {
      const filePath = await window.api.invoke('dialog:open-image')
      if (!filePath) return

      const storedPath = await window.api.invoke('files:copy-to-app-data', {
        sourcePath: filePath
      })

      setForm((f) => ({ ...f, backgroundImage: storedPath }))

      const result = await window.api.invoke('colors:extract-palette', {
        imagePath: storedPath
      })
      setPalette(result.colors)

      if (result.colors.length >= 2) {
        setForm((f) => ({
          ...f,
          colorPrimary: result.colors[0] ?? f.colorPrimary,
          colorAccent: result.colors[1] ?? f.colorAccent
        }))
      } else if (result.colors.length === 1) {
        setForm((f) => ({ ...f, colorPrimary: result.colors[0] ?? f.colorPrimary }))
      }
    } catch {
      showToast('Failed to process image', 'error')
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Project name is required', 'error')
      return
    }

    try {
      const data: InsertProject = {
        name: form.name.trim(),
        colorPrimary: form.colorPrimary,
        colorAccent: form.colorAccent,
        backgroundImage: form.backgroundImage,
        repoAssociations: form.repoAssociations
      }

      if (editingId !== null) {
        await window.api.invoke('projects:update', { id: editingId, ...data })
        showToast('Project updated', 'success')
      } else {
        await window.api.invoke('projects:create', data)
        showToast('Project created', 'success')
      }

      closeForm()
      await loadProjects()
    } catch {
      showToast('Failed to save project', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.invoke('projects:delete', { id })
      showToast('Project deleted', 'success')
      setDeleteConfirm(null)
      await loadProjects()
    } catch {
      showToast('Failed to delete project', 'error')
    }
  }

  const addRepo = () => {
    const trimmed = repoInput.trim()
    if (trimmed && !form.repoAssociations.includes(trimmed)) {
      setForm((f) => ({
        ...f,
        repoAssociations: [...f.repoAssociations, trimmed]
      }))
    }
    setRepoInput('')
  }

  const removeRepo = (repo: string) => {
    setForm((f) => ({
      ...f,
      repoAssociations: f.repoAssociations.filter((r) => r !== repo)
    }))
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    dragOver.current = index
  }

  const handleDragEnd = () => {
    dragItem.current = null
    dragOver.current = null
  }

  const handleDrop = async () => {
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) return

    const reordered = [...projects]
    const [dragged] = reordered.splice(dragItem.current, 1)
    if (!dragged) return
    reordered.splice(dragOver.current, 0, dragged)

    dragItem.current = null
    dragOver.current = null

    setProjects(reordered)

    const updates = reordered
      .map((project, i) => ({ project, rank: i }))
      .filter(({ project, rank }) => project.priorityRank !== rank)
      .map(({ project, rank }) =>
        window.api.invoke('projects:update', { id: project.id, priorityRank: rank })
      )

    const results = await Promise.allSettled(updates)
    const failed = results.some((r) => r.status === 'rejected')
    if (failed) {
      showToast('Failed to reorder projects', 'error')
    }
    // Always reload from DB to ensure UI matches persisted state
    await loadProjects()
  }

  const moveProject = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= projects.length) return

    const reordered = [...projects]
    const current = reordered[index]
    const target = reordered[targetIndex]
    if (!current || !target) return
    reordered[index] = target
    reordered[targetIndex] = current

    setProjects(reordered)

    try {
      await Promise.all([
        window.api.invoke('projects:update', {
          id: target.id,
          priorityRank: index
        }),
        window.api.invoke('projects:update', {
          id: current.id,
          priorityRank: targetIndex
        })
      ])
    } catch {
      showToast('Failed to reorder projects', 'error')
      await loadProjects()
    }
  }

  const primaryTextColor = textColorOn(form.colorPrimary)
  const accentTextColor = textColorOn(form.colorAccent)

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-200">Projects</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          New Project
        </button>
      </div>

      {/* Delete confirmation dialog */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => {
          setDeleteConfirm(null)
        }}
        className="w-96 p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-gray-200">Delete Project?</h2>
        <p className="mb-4 text-sm text-gray-400">
          This project and all its tasks will be permanently deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setDeleteConfirm(null)
            }}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (deleteConfirm !== null) void handleDelete(deleteConfirm)
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        className="max-h-[90vh] w-[32rem] overflow-y-auto p-6"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          {editingId !== null ? 'Edit Project' : 'New Project'}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
              placeholder="Project name"
            />
          </div>

          {/* Image */}
          <div>
            <button
              type="button"
              onClick={() => void handleChooseImage()}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100"
            >
              Choose Image
            </button>
            {form.backgroundImage && (
              <div className="mt-2 overflow-hidden rounded-lg">
                <img
                  src={imageUrl(form.backgroundImage)}
                  alt="Project background"
                  className="h-32 w-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Color pickers */}
          <PalettePicker
            palette={palette}
            selectedColor={form.colorPrimary}
            onSelect={(hex) => {
              setForm((f) => ({ ...f, colorPrimary: hex }))
            }}
            label="Primary Color"
          />

          <PalettePicker
            palette={palette}
            selectedColor={form.colorAccent}
            onSelect={(hex) => {
              setForm((f) => ({ ...f, colorAccent: hex }))
            }}
            label="Accent Color"
          />

          {/* Repo associations */}
          <div>
            <label
              htmlFor="repo-input"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Repo Associations
            </label>
            <div className="flex gap-2">
              <input
                id="repo-input"
                type="text"
                value={repoInput}
                onChange={(e) => {
                  setRepoInput(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addRepo()
                  }
                }}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                placeholder="owner/repo"
              />
              <button
                type="button"
                onClick={addRepo}
                className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
              >
                Add
              </button>
            </div>
            {form.repoAssociations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.repoAssociations.map((repo) => (
                  <span
                    key={repo}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300"
                  >
                    {repo}
                    <button
                      type="button"
                      onClick={() => {
                        removeRepo(repo)
                      }}
                      className="ml-1 text-gray-500 hover:text-gray-200"
                      aria-label={`Remove ${repo}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Live preview */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-300">Preview</span>
            <div className="overflow-hidden rounded-lg border border-gray-700">
              {form.backgroundImage && (
                <div
                  className="h-16 bg-cover bg-center"
                  style={{ backgroundImage: `url("${imageUrl(form.backgroundImage)}")` }}
                />
              )}
              <div className="px-3 py-2" style={{ backgroundColor: form.colorPrimary }}>
                <span
                  className="text-sm font-semibold"
                  style={{ color: primaryTextColor }}
                >
                  {form.name || 'Project Name'}
                </span>
              </div>
              <div className="px-3 py-1" style={{ backgroundColor: form.colorAccent }}>
                <span className="text-xs" style={{ color: accentTextColor }}>
                  Accent highlight
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {editingId !== null ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Project list */}
      {projects.length === 0 && !showForm && (
        <div className="text-center text-gray-500">
          <p>No projects yet. Create one to get started.</p>
        </div>
      )}

      <ToastNotification toast={toast} />

      <div className="space-y-3">
        {projects.map((project, index) => (
          <div
            key={project.id}
            draggable
            onDragStart={() => {
              handleDragStart(index)
            }}
            onDragEnter={() => {
              handleDragEnter(index)
            }}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDragEnd={handleDragEnd}
            onDrop={() => void handleDrop()}
            className="group flex cursor-grab items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700 active:cursor-grabbing"
          >
            {/* Color swatches */}
            <div className="flex gap-1">
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: project.colorPrimary }}
                title="Primary"
              />
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: project.colorAccent }}
                title="Accent"
              />
            </div>

            {/* Project info */}
            <div className="flex-1">
              <h3 className="font-medium text-gray-200">{project.name}</h3>
              {project.repoAssociations.length > 0 && (
                <p className="text-xs text-gray-500">
                  {project.repoAssociations.join(', ')}
                </p>
              )}
            </div>

            {/* Thumbnail */}
            {project.backgroundImage && (
              <div className="h-10 w-16 overflow-hidden rounded">
                <img
                  src={imageUrl(project.backgroundImage)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => void moveProject(index, 'up')}
                  className="rounded px-2 py-1 text-sm text-gray-400 transition-colors hover:text-gray-200"
                  aria-label={`Move ${project.name} up`}
                >
                  ↑
                </button>
              )}
              {index < projects.length - 1 && (
                <button
                  type="button"
                  onClick={() => void moveProject(index, 'down')}
                  className="rounded px-2 py-1 text-sm text-gray-400 transition-colors hover:text-gray-200"
                  aria-label={`Move ${project.name} down`}
                >
                  ↓
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  openEdit(project)
                }}
                className="rounded px-2 py-1 text-sm text-gray-400 transition-colors hover:text-gray-200"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(project.id)
                }}
                className="rounded px-2 py-1 text-sm text-red-400 transition-colors hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

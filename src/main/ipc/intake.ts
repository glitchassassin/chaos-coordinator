import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { projects, tasks, links } from '../db/schema'
import { parseUrl, getRepoKey } from '../cli/urlParser'
import { execCli } from '../cli/executor'
import { generate } from '../llm'
import { Channels } from './channels'
import { BOARD_PUSH_CHANNEL } from '../../shared/types/ipc'
import type { Link } from '../../shared/types/models'

export interface FetchMetadataResult {
  title: string
  contextBlock: string
  sourceType: Link['sourceType']
  repoKey: string | null
  matchedProjectId: number | null
}

async function fetchMetadata(url: string): Promise<FetchMetadataResult | null> {
  const parsed = parseUrl(url)

  // For "other" type, skip everything — return URL as title immediately
  if (parsed.type === 'other') {
    return {
      title: url,
      contextBlock: '',
      sourceType: 'other',
      repoKey: null,
      matchedProjectId: null
    }
  }

  // Find matched project via repoAssociations (only for recognized source types)
  const repoKey = getRepoKey(parsed)
  let matchedProjectId: number | null = null
  if (repoKey) {
    const db = getDb()
    const allProjects = db.select().from(projects).all()
    for (const project of allProjects) {
      if (project.repoAssociations.includes(repoKey)) {
        matchedProjectId = project.id
        break
      }
    }
  }

  // Run the appropriate CLI command
  let metadataJson: string | null = null

  if (parsed.type === 'github_issue') {
    metadataJson = await execCli('gh', [
      'issue',
      'view',
      String(parsed.number),
      '--repo',
      `${parsed.owner}/${parsed.repo}`,
      '--json',
      'title,body,state,labels,assignees'
    ])
  } else if (parsed.type === 'github_pr') {
    metadataJson = await execCli('gh', [
      'pr',
      'view',
      String(parsed.number),
      '--repo',
      `${parsed.owner}/${parsed.repo}`,
      '--json',
      'title,body,state,labels,reviewDecision,statusCheckRollup'
    ])
  } else {
    // azure_devops: --org requires the full organization URL
    metadataJson = await execCli('az', [
      'boards',
      'work-item',
      'show',
      '--id',
      String(parsed.id),
      '--org',
      `https://dev.azure.com/${parsed.org}`
    ])
  }

  // CLI failed or not installed — graceful degradation
  if (metadataJson === null) {
    return null
  }

  // Extract title from metadata JSON
  let title = url
  try {
    const metadata = JSON.parse(metadataJson) as {
      title?: string
      fields?: { 'System.Title'?: string }
    }
    if (parsed.type === 'azure_devops' && metadata.fields?.['System.Title']) {
      title = metadata.fields['System.Title']
    } else if (typeof metadata.title === 'string' && metadata.title) {
      title = metadata.title
    }
  } catch {
    // Keep URL as title if JSON parsing fails
  }

  // Generate LLM context summary — on failure, still return the extracted title
  let contextBlock = ''
  try {
    const typeLabel = parsed.type.replace(/_/g, ' ')
    contextBlock = await generate({
      system:
        'You are a developer assistant. Given metadata from an external source, generate a context summary in exactly two paragraphs separated by a blank line. Return only the summary text with no preamble or formatting.',
      prompt: `Summarize this ${typeLabel} from ${url}:\n\n${metadataJson}\n\nWrite two paragraphs separated by a blank line. First paragraph: one sentence stating the next concrete action. Second paragraph: three sentences describing what the task is about.`
    })
  } catch {
    // LLM failed — still return the extracted title and create the link
  }

  return { title, contextBlock, sourceType: parsed.type, repoKey, matchedProjectId }
}

export function registerIntakeHandlers(): void {
  ipcMain.handle(Channels.IntakeFetchMetadata, (_event, { url }: { url: string }) =>
    fetchMetadata(url)
  )

  ipcMain.handle(
    Channels.IntakeProcessTask,
    async (
      event,
      { url, taskId, projectId }: { url: string; taskId: number; projectId: number }
    ): Promise<undefined> => {
      let success = false
      try {
        const result = await fetchMetadata(url)
        if (result !== null) {
          const db = getDb()
          const finalProjectId = result.matchedProjectId ?? projectId
          db.update(tasks)
            .set({
              title: result.title,
              contextBlock: result.contextBlock || null,
              projectId: finalProjectId
            })
            .where(eq(tasks.id, taskId))
            .run()
          db.insert(links)
            .values({ taskId, url, sourceType: result.sourceType, isPrimary: true })
            .run()
          success = true
        }
        // result === null: CLI unavailable — task keeps URL as title, no toast
      } catch {
        // Unexpected error — graceful degradation
      }
      event.sender.send(BOARD_PUSH_CHANNEL, { taskId, success })
      return undefined
    }
  )
}

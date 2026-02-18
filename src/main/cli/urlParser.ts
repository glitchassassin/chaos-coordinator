export type ParsedUrl =
  | { type: 'github_issue'; owner: string; repo: string; number: number }
  | { type: 'github_pr'; owner: string; repo: string; number: number }
  | { type: 'azure_devops'; org: string; project: string; id: number }
  | { type: 'other' }

/* eslint-disable @typescript-eslint/no-non-null-assertion -- regex capture groups are guaranteed
   non-null inside the enclosing `if (match)` guard that checks the exec result */

/**
 * Parse a URL to detect its source type and extract relevant identifiers.
 * Supports GitHub issues/PRs and Azure DevOps work items.
 */
export function parseUrl(url: string): ParsedUrl {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { type: 'other' }
  }

  const { hostname, pathname } = parsed

  if (hostname === 'github.com') {
    const issueMatch = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/|$)/.exec(pathname)
    if (issueMatch) {
      return {
        type: 'github_issue',
        owner: issueMatch[1]!,
        repo: issueMatch[2]!,
        number: parseInt(issueMatch[3]!, 10)
      }
    }

    const prMatch = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/.exec(pathname)
    if (prMatch) {
      return {
        type: 'github_pr',
        owner: prMatch[1]!,
        repo: prMatch[2]!,
        number: parseInt(prMatch[3]!, 10)
      }
    }
  }

  if (hostname === 'dev.azure.com') {
    const azureMatch = /^\/([^/]+)\/([^/]+)\/_workitems\/edit\/(\d+)(?:\/|$)/.exec(
      pathname
    )
    if (azureMatch) {
      return {
        type: 'azure_devops',
        org: azureMatch[1]!,
        project: azureMatch[2]!,
        id: parseInt(azureMatch[3]!, 10)
      }
    }
  }

  return { type: 'other' }
}

/**
 * Get the repo/project key for matching against project repoAssociations.
 * Returns "owner/repo" for GitHub, "org/project" for Azure DevOps, null for other.
 */
export function getRepoKey(parsed: ParsedUrl): string | null {
  if (parsed.type === 'github_issue' || parsed.type === 'github_pr') {
    return `${parsed.owner}/${parsed.repo}`
  }
  if (parsed.type === 'azure_devops') {
    return `${parsed.org}/${parsed.project}`
  }
  return null
}

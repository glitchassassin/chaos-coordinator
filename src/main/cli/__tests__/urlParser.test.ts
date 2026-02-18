import { describe, it, expect } from 'vitest'
import { parseUrl, getRepoKey } from '../urlParser'

describe('parseUrl', () => {
  it('detects a GitHub issue URL', () => {
    const result = parseUrl('https://github.com/org/repo/issues/42')
    expect(result).toEqual({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 42
    })
  })

  it('detects a GitHub issue URL with trailing path', () => {
    const result = parseUrl('https://github.com/org/repo/issues/42/some-title')
    expect(result).toEqual({
      type: 'github_issue',
      owner: 'org',
      repo: 'repo',
      number: 42
    })
  })

  it('detects a GitHub PR URL', () => {
    const result = parseUrl('https://github.com/org/repo/pull/99')
    expect(result).toEqual({ type: 'github_pr', owner: 'org', repo: 'repo', number: 99 })
  })

  it('detects an Azure DevOps work item URL', () => {
    const result = parseUrl('https://dev.azure.com/myorg/myproject/_workitems/edit/123')
    expect(result).toEqual({
      type: 'azure_devops',
      org: 'myorg',
      project: 'myproject',
      id: 123
    })
  })

  it('returns "other" for generic URLs', () => {
    expect(parseUrl('https://example.com/foo')).toEqual({ type: 'other' })
    expect(parseUrl('https://github.com/org/repo')).toEqual({ type: 'other' })
    expect(parseUrl('https://github.com/org/repo/blob/main/file.ts')).toEqual({
      type: 'other'
    })
  })

  it('returns "other" for invalid URLs', () => {
    expect(parseUrl('not-a-url')).toEqual({ type: 'other' })
    expect(parseUrl('')).toEqual({ type: 'other' })
  })
})

describe('getRepoKey', () => {
  it('returns owner/repo for GitHub issues', () => {
    expect(
      getRepoKey({ type: 'github_issue', owner: 'org', repo: 'repo', number: 1 })
    ).toBe('org/repo')
  })

  it('returns owner/repo for GitHub PRs', () => {
    expect(getRepoKey({ type: 'github_pr', owner: 'org', repo: 'repo', number: 1 })).toBe(
      'org/repo'
    )
  })

  it('returns org/project for Azure DevOps', () => {
    expect(
      getRepoKey({ type: 'azure_devops', org: 'myorg', project: 'myproject', id: 1 })
    ).toBe('myorg/myproject')
  })

  it('returns null for other type', () => {
    expect(getRepoKey({ type: 'other' })).toBeNull()
  })
})

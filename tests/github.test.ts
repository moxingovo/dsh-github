/** dsh-github plugin tests against the published @deepseek-ai peer deps. */
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GithubApiProvider, mapFileData, mapIssueData, mapRepoData, mapSearchData } from '../src/provider.ts'
import { GithubError } from '../src/types.ts'
import { formatFileOutput, formatIssueOutput, formatRepoOutput, formatSearchOutput, githubFileOutput, parseGetArgs, parseSearchArgs } from '../src/tools.ts'
import * as plugin from '../src/index.ts'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => { vi.restoreAllMocks() })

describe('mappers', () => {
  it('maps repository and issue search rows', () => {
    const result = mapSearchData({
      total_count: 10,
      items: [
        { full_name: 'a/b', html_url: 'https://github.com/a/b', description: 'd', owner: { login: 'a' }, stargazers_count: 5, created_at: 'c' },
        { number: 1, title: 't', html_url: 'https://github.com/a/b/issues/1', state: 'open', user: { login: 'u' }, body: 'b', comments: 2, created_at: 'c' },
        { bad: true },
      ],
    }, 'repositories', 1, 10)
    expect(result.totalCount).toBe(10)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('a/b')
  })

  it('maps repo, issue, and file details with defaults', () => {
    expect(mapRepoData({ full_name: 'a/b', license: { spdx_id: 'MIT' }, topics: ['x', 5] })).toMatchObject({ fullName: 'a/b', license: 'MIT', topics: ['x'], archived: false })
    expect(mapIssueData({ number: 1, pull_request: { url: 'x' } })).toMatchObject({ number: 1, pullRequest: true, labels: [] })
    expect(mapFileData({ path: 'x.md', size: 2, content: Buffer.from('hi').toString('base64') }, 'a', 'b').content).toBe('hi')
    expect(() => mapFileData({ path: 'big.bin', size: 2000000 }, 'a', 'b')).toThrow(GithubError)
  })
})

describe('argument parsing and formatting', () => {
  it('validates and defaults search arguments', () => {
    expect(parseSearchArgs({ query: ' q ' }, 30)).toEqual({ query: 'q', kind: 'repositories', page: 1, perPage: 10 })
    expect(() => parseSearchArgs({ query: '' }, 30)).toThrow()
    expect(() => parseSearchArgs({ query: 'q', perPage: 31 }, 30)).toThrow()
  })

  it('validates get arguments per kind', () => {
    expect(parseGetArgs({ kind: 'repo', owner: 'a', repo: 'b' })).toEqual({ kind: 'repo', owner: 'a', repo: 'b' })
    expect(() => parseGetArgs({ kind: 'issue', owner: 'a', repo: 'b' })).toThrow()
    expect(() => parseGetArgs({ kind: 'file', owner: 'a', repo: 'b' })).toThrow()
    expect(() => parseGetArgs({ kind: 'gist', owner: 'a', repo: 'b' })).toThrow()
    expect(() => parseGetArgs({ kind: 'repo', owner: 'a b', repo: 'c' })).toThrow()
  })

  it('formats search, repo, issue, and file outputs', () => {
    const search = formatSearchOutput({ kind: 'repositories', totalCount: 1, page: 1, perPage: 10, hasMore: false, items: [{ kind: 'repository', htmlUrl: 'https://github.com/a/b', title: 'a/b', description: 'd', author: 'a', state: '', stars: 3, comments: 0, createdAt: '' }] })
    expect(search).toContain('[a/b](https://github.com/a/b)')
    expect(search).toContain('stars: 3')
    expect(formatSearchOutput({ kind: 'issues', totalCount: 0, page: 1, perPage: 10, hasMore: false, items: [] })).toBe('No issues found for this query on GitHub.')
    expect(formatRepoOutput(mapRepoData({ full_name: 'a/b' }))).toContain('Repository: a/b')
    expect(formatIssueOutput(mapIssueData({ number: 1, title: 't' }))).toContain('#1: t')
    const file = githubFileOutput({ path: 'x', htmlUrl: 'u', size: 5, content: '0123456789' }, 4)
    expect(file.truncated).toBe(true)
    expect(formatFileOutput(file)).toContain('(Content truncated')
  })
})

describe('provider request handling', () => {
  it('sends headers and maps status classes', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ total_count: 0, items: [] }))
    const provider = new GithubApiProvider({ token: 'tok' })
    await provider.search({ query: 'q', kind: 'repositories', page: 1, perPage: 10 })
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer tok')
    expect(headers['user-agent']).toBe('dsh-github')
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'no' }, { status: 404 }))
    await expect(new GithubApiProvider().repo({ owner: 'a', repo: 'b' })).rejects.toMatchObject({ code: 'GITHUB_NOT_FOUND' })
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('moved', { status: 301 }))
    await expect(new GithubApiProvider().repo({ owner: 'a', repo: 'b' })).rejects.toMatchObject({ code: 'GITHUB_REDIRECT_REFUSED' })
  })
})

describe('plugin composition', () => {
  it('registers both tools and executes end to end', async () => {
    const ctx = new Context()
    await (ctx.plugin(SystemPrompt, {})).await()
    await (ctx.plugin(ToolRuntime, {})).await()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ total_count: 1, items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', owner: { login: 'a' }, stargazers_count: 1 }] }))
    await (ctx.plugin(plugin, {})).await()
    const names = ctx.tools.schemas().map(s => s.name)
    expect(names).toEqual(['github_search', 'github_get'])
    const result = await ctx.tools.execute({ signal: new AbortController().signal, callId: 'c1' as never, name: 'github_search', arguments: { query: 'q' } })
    expect(result.isError).toBe(false)
  })
})

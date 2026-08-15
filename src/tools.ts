/**
 * The model-facing github_search and github_get tools, bounded at the
 * value level for file content.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolResult } from '@deepseek-ai/dsh-tools'
import type {
  GithubFileResult,
  GithubIssueDetail,
  GithubProviderLike,
  GithubRepoDetail,
  GithubSearchKind,
} from './types.ts'

/** Provider surface the tools execute against. */
export type { GithubProviderLike }

/** Default page size for one github_search call. */
export const GITHUB_SEARCH_DEFAULT_PER_PAGE = 10

/** Default cap on the file characters one call returns. */
export const GITHUB_FILE_MAX_CHARS = 200_000

/** The resource kinds github_get accepts. */
export type GithubGetKind = 'repo' | 'issue' | 'file'

/** The bounded file output value. */
export interface GithubFileOutput {
  path: string
  htmlUrl: string
  size: number
  truncated: boolean
  content: string
}

/** One search hit as the tool output schema projects it. */
export interface GithubSearchOutputItem {
  kind: string
  htmlUrl: string
  title: string
  description: string
  author: string
  state: string
  stars: number
  comments: number
  createdAt: string
}

/** One search page as the tool output schema projects it. */
export interface GithubSearchOutput {
  kind: string
  totalCount: number
  page: number
  perPage: number
  hasMore: boolean
  items: readonly GithubSearchOutputItem[]
}

/** Accepted GitHub owner and repository name characters. */
const NAME_PATTERN = new RegExp('^[A-Za-z0-9_.-]+$')

/** The search scopes github_search accepts. */
const SEARCH_KINDS: readonly GithubSearchKind[] = ['repositories', 'issues']

/** The kinds and their required optional arguments. */
const GET_KINDS: readonly GithubGetKind[] = ['repo', 'issue', 'file']

/**
 * Validate github_search arguments: a non-blank query, a known scope, and
 * positive bounded page numbers.
 */
export function parseSearchArgs(args: { query: string; kind?: string; page?: number; perPage?: number }, maxPerPage: number): { query: string; kind: GithubSearchKind; page: number; perPage: number } {
  if (args.query.trim().length === 0) throw new Error('query must be a non-empty string')
  const kind = args.kind ?? 'repositories'
  if (!SEARCH_KINDS.includes(kind as GithubSearchKind)) throw new Error('kind must be one of repositories, issues')
  const page = args.page ?? 1
  const perPage = args.perPage ?? GITHUB_SEARCH_DEFAULT_PER_PAGE
  if (!Number.isInteger(page) || page < 1) throw new Error('page must be a positive integer')
  if (!Number.isInteger(perPage) || perPage < 1) throw new Error('perPage must be a positive integer')
  if (perPage > maxPerPage) throw new Error('perPage exceeds the maximum of ' + maxPerPage)
  return { query: args.query.trim(), kind: kind as GithubSearchKind, page, perPage }
}

/**
 * Validate github_get arguments: the kind, the owner/repo names, and the
 * kind-specific fields.
 */
export function parseGetArgs(args: { kind: string; owner: string; repo: string; number?: number; path?: string; ref?: string }): { kind: GithubGetKind; owner: string; repo: string; number?: number; path?: string; ref?: string } {
  const kind = args.kind as GithubGetKind
  if (!GET_KINDS.includes(kind)) throw new Error('kind must be one of repo, issue, file')
  const owner = args.owner.trim()
  const repo = args.repo.trim()
  if (owner.length === 0) throw new Error('owner must be a non-empty string')
  if (repo.length === 0) throw new Error('repo must be a non-empty string')
  if (!NAME_PATTERN.test(owner)) throw new Error('owner must contain only letters, digits, dots, dashes, and underscores')
  if (!NAME_PATTERN.test(repo)) throw new Error('repo must contain only letters, digits, dots, dashes, and underscores')
  if (kind === 'issue') {
    if (args.number === undefined || !Number.isInteger(args.number) || args.number < 1) throw new Error('number must be a positive integer for kind issue')
    return { kind, owner, repo, number: args.number }
  }
  if (kind === 'file') {
    const path = args.path === undefined ? '' : args.path.trim()
    if (path.length === 0) throw new Error('path must be a non-empty string for kind file')
    return { kind, owner, repo, path, ...args.ref === undefined || args.ref.trim().length === 0 ? {} : { ref: args.ref.trim() } }
  }
  return { kind, owner, repo }
}

/**
 * Bound the file content at the value level, marking any cut.
 */
export function githubFileOutput(file: GithubFileResult, maxChars: number): GithubFileOutput {
  const truncated = file.content.length > maxChars
  return {
    path: file.path,
    htmlUrl: file.htmlUrl,
    size: file.size,
    truncated,
    content: truncated ? file.content.slice(0, maxChars) : file.content,
  }
}

/** Format one search result page as the model-facing text block. */
export function formatSearchOutput(result: GithubSearchOutput): string {
  if (result.items.length === 0) {
    return 'No ' + result.kind + ' found for this query on GitHub.'
  }
  const lines = result.items.map((item: GithubSearchOutputItem) => {
    const meta: string[] = []
    if (item.author.length > 0) meta.push('by ' + item.author)
    if (item.stars > 0) meta.push('stars: ' + item.stars)
    if (item.comments > 0) meta.push('comments: ' + item.comments)
    if (item.state.length > 0) meta.push(item.state)
    if (item.createdAt.length > 0) meta.push('created: ' + item.createdAt.slice(0, 10))
    const suffix = meta.length > 0 ? ' — ' + meta.join(', ') : ''
    const title = item.kind === 'repository' ? item.title : '#' + item.title
    const label = '[' + title + '](' + item.htmlUrl + ')'
    const body = item.description.length > 0 ? ' — ' + item.description.slice(0, 120) : ''
    return '- ' + label + suffix + body
  })
  const header = 'Found ' + result.totalCount + ' ' + result.kind + ' (page ' + result.page + ', ' + result.items.length + ' shown)'
  const footer = result.hasMore ? 'More pages follow: pass page: ' + (result.page + 1) + ' to continue.' : 'This is the last page.'
  return [header, lines.join('\n'), footer].join('\n\n')
}

/** Format a repository detail as the model-facing text block. */
export function formatRepoOutput(detail: GithubRepoDetail): string {
  const lines = [
    'Repository: ' + detail.fullName,
    'URL: ' + detail.htmlUrl,
    'Stars: ' + detail.stars + ' | Forks: ' + detail.forks + ' | Open issues: ' + detail.openIssues,
    'Language: ' + (detail.language.length > 0 ? detail.language : 'unknown'),
    'License: ' + (detail.license.length > 0 ? detail.license : 'none'),
    'Default branch: ' + detail.defaultBranch,
    'Archived: ' + detail.archived,
    'Created: ' + detail.createdAt.slice(0, 10) + ' | Last push: ' + detail.pushedAt.slice(0, 10),
  ]
  if (detail.topics.length > 0) lines.push('Topics: ' + detail.topics.join(', '))
  if (detail.homepage.length > 0) lines.push('Homepage: ' + detail.homepage)
  if (detail.description.length > 0) lines.push('Description: ' + detail.description)
  return lines.join('\n')
}

/** Format an issue detail as the model-facing text block. */
export function formatIssueOutput(detail: GithubIssueDetail): string {
  const kindLabel = detail.pullRequest ? 'Pull request' : 'Issue'
  const lines = [
    kindLabel + ' #' + detail.number + ': ' + detail.title,
    'URL: ' + detail.htmlUrl,
    'State: ' + detail.state + ' | Author: ' + detail.author + ' | Comments: ' + detail.comments,
    'Created: ' + detail.createdAt.slice(0, 10) + ' | Updated: ' + detail.updatedAt.slice(0, 10),
  ]
  if (detail.labels.length > 0) lines.push('Labels: ' + detail.labels.join(', '))
  if (detail.body.length > 0) lines.push('Body:\n' + detail.body)
  return lines.join('\n')
}

/** Format the bounded file output as the model-facing text block. */
export function formatFileOutput(output: GithubFileOutput): string {
  const header = 'File ' + output.path + ' (' + output.size + ' bytes)'
  const notice = output.truncated ? '\n\n(Content truncated. Fetch a specific file path for more.)' : ''
  return header + '\n\n' + output.content + notice
}

/**
 * Register the github_search tool.
 */
export function applyGithubSearchTool(ctx: Context, service: GithubProviderLike, maxPerPage: number, timeoutMs: number): void {
  ctx.tools.register(defineTool({
    name: 'github_search',
    description: 'Search GitHub repositories or issues by query (GitHub search syntax supported, e.g. repo:vercel/next.js is:issue). Returns hits with URL, description, author, and counts. Use github_get for full details.',
    parameters: {
      query: { type: 'string', required: true, description: 'The GitHub search query.' },
      kind: { type: 'string', enum: [...SEARCH_KINDS], description: 'Scope: repositories (default) or issues (includes pull requests).' },
      page: { type: 'number', description: '1-based result page. Defaults to 1.' },
      perPage: { type: 'number', description: 'Results per page. Defaults to 10.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true },
          totalCount: { type: 'number', required: true },
          page: { type: 'number', required: true },
          perPage: { type: 'number', required: true },
          hasMore: { type: 'boolean', required: true },
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true },
                htmlUrl: { type: 'string', required: true },
                title: { type: 'string', required: true },
                description: { type: 'string', required: true },
                author: { type: 'string', required: true },
                state: { type: 'string', required: true },
                stars: { type: 'number', required: true },
                comments: { type: 'number', required: true },
                createdAt: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatSearchOutput(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = parseSearchArgs(args, maxPerPage)
      const result = await service.search(input, exec.signal)
      return { ...result, items: [...result.items] }
    },
    presentCall: (args: { query: string }): GenericCallView => ({ card: 'generic', title: args.query, kind: 'search', rawInput: args.query }),
    presentResult: (_args: unknown, _result: ToolResult): undefined => undefined,
  }))
}

/**
 * Register the github_get tool.
 */
export function applyGithubGetTool(ctx: Context, service: GithubProviderLike, maxChars: number, timeoutMs: number): void {
  ctx.tools.register(defineTool({
    name: 'github_get',
    description: 'Fetch one GitHub resource: repository metadata (kind repo), an issue or pull request body (kind issue, requires number), or a file content (kind file, requires path, optional ref branch).',
    parameters: {
      kind: { type: 'string', required: true, enum: [...GET_KINDS], description: 'repo, issue, or file.' },
      owner: { type: 'string', required: true, description: 'Repository owner (user or org).' },
      repo: { type: 'string', required: true, description: 'Repository name.' },
      number: { type: 'number', description: 'Issue or PR number, required for kind issue.' },
      path: { type: 'string', description: 'File path, required for kind file.' },
      ref: { type: 'string', description: 'Branch or tag for kind file. Defaults to the default branch.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true },
          repo: {
            type: 'object',
            additionalProperties: false,
            properties: {
              fullName: { type: 'string', required: true },
              htmlUrl: { type: 'string', required: true },
              description: { type: 'string', required: true },
              stars: { type: 'number', required: true },
              forks: { type: 'number', required: true },
              openIssues: { type: 'number', required: true },
              language: { type: 'string', required: true },
              license: { type: 'string', required: true },
              topics: { type: 'array', required: true, items: { type: 'string' } },
              homepage: { type: 'string', required: true },
              defaultBranch: { type: 'string', required: true },
              archived: { type: 'boolean', required: true },
              createdAt: { type: 'string', required: true },
              pushedAt: { type: 'string', required: true },
            },
          },
          issue: {
            type: 'object',
            additionalProperties: false,
            properties: {
              number: { type: 'number', required: true },
              title: { type: 'string', required: true },
              body: { type: 'string', required: true },
              state: { type: 'string', required: true },
              author: { type: 'string', required: true },
              labels: { type: 'array', required: true, items: { type: 'string' } },
              comments: { type: 'number', required: true },
              htmlUrl: { type: 'string', required: true },
              createdAt: { type: 'string', required: true },
              updatedAt: { type: 'string', required: true },
              pullRequest: { type: 'boolean', required: true },
            },
          },
          file: {
            type: 'object',
            additionalProperties: false,
            properties: {
              path: { type: 'string', required: true },
              htmlUrl: { type: 'string', required: true },
              size: { type: 'number', required: true },
              truncated: { type: 'boolean', required: true },
              content: { type: 'string', required: true },
            },
          },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderGetOutput(value) }],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const input = parseGetArgs(args)
      if (input.kind === 'repo') {
        const repo = await service.repo({ owner: input.owner, repo: input.repo }, exec.signal)
        return { kind: input.kind, repo: { ...repo, topics: [...repo.topics] } }
      }
      if (input.kind === 'issue') {
        const issue = await service.issue({ owner: input.owner, repo: input.repo, number: input.number as number }, exec.signal)
        return { kind: input.kind, issue: { ...issue, labels: [...issue.labels] } }
      }
      const file = await service.file({ owner: input.owner, repo: input.repo, path: input.path as string, ...(input.ref === undefined ? {} : { ref: input.ref }) }, exec.signal)
      return { kind: input.kind, file: githubFileOutput(file, maxChars) }
    },
    presentCall: (args: { kind: string; owner: string; repo: string }): GenericCallView => ({ card: 'generic', title: args.kind + ' ' + args.owner + '/' + args.repo, kind: 'search', rawInput: args.kind + ' ' + args.owner + '/' + args.repo }),
    presentResult: (_args: unknown, _result: ToolResult): undefined => undefined,
  }))
}

/** Render the discriminated github_get output value. */
function renderGetOutput(value: { kind: string; repo?: GithubRepoDetail; issue?: GithubIssueDetail; file?: GithubFileOutput }): string {
  switch (value.kind) {
    case 'repo': return formatRepoOutput(value.repo as GithubRepoDetail)
    case 'issue': return formatIssueOutput(value.issue as GithubIssueDetail)
    default: return formatFileOutput(value.file as GithubFileOutput)
  }
}

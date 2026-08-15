/**
 * The GitHub REST API provider: repository/issue search, repository and
 * issue details, and base64 file content decoding. Anonymous by default;
 * an optional token unlocks code search and raises the rate limit. Every
 * request refuses redirects, and the token is only ever sent to the
 * configured API host.
 */

import type {
  GithubFileResult,
  GithubIssueDetail,
  GithubRepoDetail,
  GithubSearchItem,
  GithubSearchRequest,
  GithubSearchResult,
} from './types.ts'
import { GithubError } from './types.ts'

/** Provider registry id for the REST API implementation. */
export const GITHUB_PROVIDER_ID = 'github-api'

/** Default API base URL. */
export const GITHUB_DEFAULT_BASE_URL = 'https://api.github.com'

/** Default User-Agent header (GitHub requires one). */
export const GITHUB_DEFAULT_USER_AGENT = 'dsh-github'

/** Default per-request timeout (ms). */
export const GITHUB_DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/** The search endpoints' hard ceiling on page size (the API maximum). */
export const GITHUB_SEARCH_MAX_PER_PAGE = 100

/** Options for one provider instance. */
export interface GithubApiProviderOptions {
  /** API base URL; defaults to GITHUB_DEFAULT_BASE_URL. */
  baseUrl?: string
  /** Optional Bearer token; resolved by the plugin from the environment. */
  token?: string
  /** User-Agent header; defaults to GITHUB_DEFAULT_USER_AGENT. */
  userAgent?: string
  /** Per-request timeout (ms); defaults to GITHUB_DEFAULT_REQUEST_TIMEOUT_MS. */
  requestTimeoutMs?: number
}

/** The REST provider. Stateless beyond its options. */
export class GithubApiProvider {
  readonly id = GITHUB_PROVIDER_ID

  private readonly options: GithubApiProviderOptions

  constructor(options: GithubApiProviderOptions = {}) {
    this.options = options
  }

  /** Always usable: anonymous access needs no credentials. */
  available(): boolean {
    return true
  }

  /** Search repositories or issues. */
  async search(request: GithubSearchRequest, signal?: AbortSignal): Promise<GithubSearchResult> {
    const scope = request.kind === 'repositories' ? 'repositories' : 'issues'
    const data = await this.requestJson('/search/' + scope, {
      q: request.query,
      page: request.page,
      per_page: request.perPage,
    }, signal)
    return mapSearchData(data, request.kind, request.page, request.perPage)
  }

  /** Fetch one repository's metadata. */
  async repo(request: { readonly owner: string; readonly repo: string }, signal?: AbortSignal): Promise<GithubRepoDetail> {
    const data = await this.requestJson('/repos/' + request.owner + '/' + request.repo, {}, signal)
    return mapRepoData(data)
  }

  /** Fetch one issue or pull request. */
  async issue(request: { readonly owner: string; readonly repo: string; readonly number: number }, signal?: AbortSignal): Promise<GithubIssueDetail> {
    const data = await this.requestJson('/repos/' + request.owner + '/' + request.repo + '/issues/' + request.number, {}, signal)
    return mapIssueData(data)
  }

  /** Fetch one file's decoded text content. */
  async file(request: { readonly owner: string; readonly repo: string; readonly path: string; readonly ref?: string }, signal?: AbortSignal): Promise<GithubFileResult> {
    const params: Record<string, string | number> = {}
    if (request.ref !== undefined && request.ref.length > 0) params.ref = request.ref
    const data = await this.requestJson('/repos/' + request.owner + '/' + request.repo + '/contents/' + request.path, params, signal)
    return mapFileData(data, request.owner, request.repo)
  }

  /**
   * One GET against the API host. Refuses any redirect and maps HTTP
   * status classes into structured errors carrying the API's message.
   */
  private async requestJson(path: string, params: Readonly<Record<string, string | number>>, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(path, this.options.baseUrl ?? GITHUB_DEFAULT_BASE_URL)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
    const token = this.options.token
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': this.options.userAgent ?? GITHUB_DEFAULT_USER_AGENT,
    }
    if (token !== undefined && token.length > 0) headers.authorization = 'Bearer ' + token
    const timeoutMs = this.options.requestTimeoutMs ?? GITHUB_DEFAULT_REQUEST_TIMEOUT_MS
    const signals: AbortSignal[] = []
    if (signal !== undefined) signals.push(signal)
    signals.push(AbortSignal.timeout(timeoutMs))
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.any(signals), redirect: 'manual', headers })
    } catch (cause: unknown) {
      if (signal?.aborted === true) throw cause
      throw new GithubError('github request failed: ' + String(cause), 'GITHUB_REQUEST_FAILED', { cause })
    }
    if (response.status >= 300 && response.status < 400) {
      throw new GithubError('github refused a redirect (HTTP ' + response.status + ') from ' + url.host, 'GITHUB_REDIRECT_REFUSED', { statusCode: response.status })
    }
    let body: unknown
    try {
      body = await response.json()
    } catch (cause: unknown) {
      throw new GithubError('github response was not JSON (HTTP ' + response.status + ')', 'GITHUB_BAD_RESPONSE', { cause, statusCode: response.status })
    }
    if (response.status < 200 || response.status >= 300) throw httpError(response.status, body)
    return body
  }
}

/**
 * Map a search endpoint payload into one normalized result page.
 */
export function mapSearchData(data: unknown, kind: GithubSearchRequest['kind'], page: number, perPage: number): GithubSearchResult {
  const record = asRecord(data)
  const total = finiteNumber(record.total_count, 0)
  const items: GithubSearchItem[] = []
  for (const row of asRecordArray(record.items)) {
    if (kind === 'repositories') {
      const fullName = nonEmptyString(row.full_name)
      const htmlUrl = nonEmptyString(row.html_url)
      if (fullName === undefined || htmlUrl === undefined) continue
      const owner = asRecord(row.owner)
      items.push({
        kind: 'repository',
        htmlUrl,
        title: fullName,
        description: nonEmptyString(row.description) ?? '',
        author: nonEmptyString(owner.login) ?? '',
        state: '',
        stars: finiteNumber(row.stargazers_count, 0),
        comments: 0,
        createdAt: nonEmptyString(row.created_at) ?? '',
      })
      continue
    }
    const number = numeric(row.number)
    const htmlUrl = nonEmptyString(row.html_url)
    if (number === undefined || htmlUrl === undefined) continue
    const user = asRecord(row.user)
    items.push({
      kind: 'issue',
      htmlUrl,
      title: nonEmptyString(row.title) ?? '',
      description: nonEmptyString(row.body) ?? '',
      author: nonEmptyString(user.login) ?? '',
      state: issueState(row.state),
      stars: 0,
      comments: finiteNumber(row.comments, 0),
      createdAt: nonEmptyString(row.created_at) ?? '',
    })
  }
  return { kind, totalCount: total, page, perPage, hasMore: page * perPage < total, items }
}

/** Map a repository endpoint payload into the normalized detail. */
export function mapRepoData(data: unknown): GithubRepoDetail {
  const record = asRecord(data)
  const license = asRecord(record.license)
  return {
    fullName: nonEmptyString(record.full_name) ?? '',
    htmlUrl: nonEmptyString(record.html_url) ?? '',
    description: nonEmptyString(record.description) ?? '',
    stars: finiteNumber(record.stargazers_count, 0),
    forks: finiteNumber(record.forks_count, 0),
    openIssues: finiteNumber(record.open_issues_count, 0),
    language: nonEmptyString(record.language) ?? '',
    license: nonEmptyString(license.spdx_id) ?? nonEmptyString(license.name) ?? '',
    topics: stringArray(record.topics),
    homepage: nonEmptyString(record.homepage) ?? '',
    defaultBranch: nonEmptyString(record.default_branch) ?? '',
    archived: record.archived === true,
    createdAt: nonEmptyString(record.created_at) ?? '',
    pushedAt: nonEmptyString(record.pushed_at) ?? '',
  }
}

/** Map an issue endpoint payload into the normalized detail. */
export function mapIssueData(data: unknown): GithubIssueDetail {
  const record = asRecord(data)
  const user = asRecord(record.user)
  return {
    number: finiteNumber(record.number, 0),
    title: nonEmptyString(record.title) ?? '',
    body: nonEmptyString(record.body) ?? '',
    state: nonEmptyString(record.state) ?? '',
    author: nonEmptyString(user.login) ?? '',
    labels: stringArray(asRecordArray(record.labels).map(label => label.name)),
    comments: finiteNumber(record.comments, 0),
    htmlUrl: nonEmptyString(record.html_url) ?? '',
    createdAt: nonEmptyString(record.created_at) ?? '',
    updatedAt: nonEmptyString(record.updated_at) ?? '',
    pullRequest: record.pull_request !== undefined,
  }
}

/**
 * Map a contents endpoint payload into decoded text.
 * @throws GithubError GITHUB_FILE_TOO_LARGE when the API omits the content.
 */
export function mapFileData(data: unknown, owner: string, repo: string): GithubFileResult {
  const record = asRecord(data)
  const path = nonEmptyString(record.path) ?? ''
  const encoded = nonEmptyString(record.content)
  const size = finiteNumber(record.size, 0)
  if (encoded === undefined) {
    throw new GithubError('github did not inline this file (files over 1MB are not decoded)', 'GITHUB_FILE_TOO_LARGE')
  }
  return {
    path,
    htmlUrl: 'https://github.com/' + owner + '/' + repo + '/blob/HEAD/' + path,
    size,
    content: Buffer.from(encoded, 'base64').toString('utf8'),
  }
}

/** Map a non-2xx status plus error body into the structured error. */
function httpError(status: number, body: unknown): GithubError {
  const message = nonEmptyString(asRecord(body).message) ?? ''
  const detail = message.length > 0 ? ': ' + message : ''
  switch (status) {
    case 401: return new GithubError('github requires authentication for this data' + detail, 'GITHUB_UNAUTHORIZED', { statusCode: status })
    case 403: return new GithubError('github denied the request (rate limit or permissions)' + detail, 'GITHUB_FORBIDDEN', { statusCode: status })
    case 404: return new GithubError('github could not find the requested resource' + detail, 'GITHUB_NOT_FOUND', { statusCode: status })
    case 422: return new GithubError('github rejected the search query' + detail, 'GITHUB_API_ERROR', { statusCode: status })
    default: return new GithubError('github API error ' + status + detail, 'GITHUB_API_ERROR', { statusCode: status })
  }
}

/** The issue state narrowed to the vocabulary, empty for anything else. */
function issueState(value: unknown): GithubSearchItem['state'] {
  return value === 'open' || value === 'closed' ? value : ''
}

/** Wrap a record-like value; non-objects become an empty record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Wrap an array-like value; non-arrays become an empty array. */
function asRecordArray(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
}

/** Map array entries to their non-empty string readings. */
function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const entry of value) {
    const text = nonEmptyString(entry)
    if (text !== undefined) result.push(text)
  }
  return result
}

/** A finite number, with the supplied fallback for absent or non-numeric values. */
function finiteNumber(value: unknown, fallback: number): number {
  const parsed = numeric(value)
  return parsed === undefined ? fallback : parsed
}

/** A finite numeric reading of the value, when the value is numeric. */
function numeric(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

/** A non-blank string reading of the value, when it is one. */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

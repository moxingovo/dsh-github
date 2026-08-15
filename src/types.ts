/**
 * Vocabulary for the dsh-github plugin: repository and issue search,
 * repository and issue details, and file content over the public GitHub
 * REST API.
 */

/** The search scopes the provider supports. */
export type GithubSearchKind = 'repositories' | 'issues'

/** One search request. */
export interface GithubSearchRequest {
  /** Search query, forwarded verbatim (GitHub search syntax supported). */
  readonly query: string
  /** The scope to search. */
  readonly kind: GithubSearchKind
  /** 1-based result page. */
  readonly page: number
  /** Results per page (the provider ceiling is 100, the API maximum). */
  readonly perPage: number
}

/** One search hit, normalized across repositories and issues. */
export interface GithubSearchItem {
  readonly kind: 'repository' | 'issue'
  /** Canonical URL. */
  readonly htmlUrl: string
  /** Repository full name, or the issue title. */
  readonly title: string
  /** Repository description, or the issue body opening. */
  readonly description: string
  /** Owner login, or the issue author login. */
  readonly author: string
  readonly state: '' | 'open' | 'closed'
  /** Star count (repositories only). */
  readonly stars: number
  /** Comment count (issues only). */
  readonly comments: number
  /** ISO-8601 creation instant. */
  readonly createdAt: string
}

/** Normalized search outcome. */
export interface GithubSearchResult {
  readonly kind: GithubSearchKind
  readonly totalCount: number
  readonly page: number
  readonly perPage: number
  readonly hasMore: boolean
  readonly items: readonly GithubSearchItem[]
}

/** One repository's full metadata. */
export interface GithubRepoDetail {
  readonly fullName: string
  readonly htmlUrl: string
  readonly description: string
  readonly stars: number
  readonly forks: number
  readonly openIssues: number
  readonly language: string
  readonly license: string
  readonly topics: readonly string[]
  readonly homepage: string
  readonly defaultBranch: string
  readonly archived: boolean
  readonly createdAt: string
  readonly pushedAt: string
}

/** One issue or pull request's full detail. */
export interface GithubIssueDetail {
  readonly number: number
  readonly title: string
  readonly body: string
  readonly state: string
  readonly author: string
  readonly labels: readonly string[]
  readonly comments: number
  readonly htmlUrl: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly pullRequest: boolean
}

/** One file's decoded text content. */
export interface GithubFileResult {
  readonly path: string
  readonly htmlUrl: string
  readonly size: number
  readonly content: string
}

/**
 * The provider surface the tools execute against (the plugin's own
 * provider implements it; kept narrow so consumers see one contract).
 */
export interface GithubProviderLike {
  search(request: GithubSearchRequest, signal?: AbortSignal): Promise<GithubSearchResult>
  repo(request: { readonly owner: string; readonly repo: string }, signal?: AbortSignal): Promise<GithubRepoDetail>
  issue(request: { readonly owner: string; readonly repo: string; readonly number: number }, signal?: AbortSignal): Promise<GithubIssueDetail>
  file(request: { readonly owner: string; readonly repo: string; readonly path: string; readonly ref?: string }, signal?: AbortSignal): Promise<GithubFileResult>
}

/**
 * Typed plugin error with a machine-routable code and chained cause.
 */
export class GithubError extends Error {
  /** Machine-routable error code. */
  readonly code: string
  /** The HTTP status the API answered with, when one applied. */
  readonly statusCode?: number

  constructor(message: string, code: string, options: { cause?: unknown; statusCode?: number } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'GithubError'
    this.code = code
    if (options.statusCode !== undefined) this.statusCode = options.statusCode
  }
}

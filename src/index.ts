/**
 * dsh-github: one DeepSeek Harness plugin that registers the GitHub
 * capability (ctx.github provider) and the github_search / github_get
 * tools. Anonymous by default; an optional token from the environment
 * unlocks code search and raises the rate limit.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { GithubApiProvider, GITHUB_DEFAULT_BASE_URL, GITHUB_DEFAULT_REQUEST_TIMEOUT_MS, GITHUB_DEFAULT_USER_AGENT } from './provider.ts'
import { applyGithubGetTool, applyGithubSearchTool, GITHUB_FILE_MAX_CHARS } from './tools.ts'

export { GithubApiProvider, GITHUB_DEFAULT_BASE_URL, GITHUB_DEFAULT_REQUEST_TIMEOUT_MS, GITHUB_DEFAULT_USER_AGENT, GITHUB_PROVIDER_ID, GITHUB_SEARCH_MAX_PER_PAGE, mapFileData, mapIssueData, mapRepoData, mapSearchData } from './provider.ts'
export type { GithubApiProviderOptions } from './provider.ts'
export { GithubError } from './types.ts'
export type {
  GithubFileResult,
  GithubIssueDetail,
  GithubProviderLike,
  GithubRepoDetail,
  GithubSearchItem,
  GithubSearchKind,
  GithubSearchRequest,
  GithubSearchResult,
} from './types.ts'
export {
  GITHUB_FILE_MAX_CHARS,
  GITHUB_SEARCH_DEFAULT_PER_PAGE,
  applyGithubGetTool,
  applyGithubSearchTool,
  formatFileOutput,
  formatIssueOutput,
  formatRepoOutput,
  formatSearchOutput,
  githubFileOutput,
  parseGetArgs,
  parseSearchArgs,
} from './tools.ts'
export type { GithubFileOutput, GithubGetKind, GithubSearchOutput, GithubSearchOutputItem } from './tools.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-plugin-github'

/** Services required before the plugin starts. */
export const inject = ['tools', 'systemPrompt']

/** Default cooperative tool-call timeout budget (ms). */
export const DEFAULT_GITHUB_TOOL_TIMEOUT_MS = 30_000

/** Environment variable naming the optional GitHub access token. */
export const DEFAULT_TOKEN_ENV = 'GITHUB_TOKEN'

/** Plugin config; every field is optional with env and constant defaults. */
export interface Config {
  /** API base URL override; defaults to api.github.com. */
  baseUrl?: string
  /** Literal Bearer token; prefer tokenEnv so no secret enters config files. */
  token?: string
  /** Environment variable naming the token; defaults to GITHUB_TOKEN. */
  tokenEnv?: string
  /** User-Agent header. */
  userAgent?: string
  /** Per-request timeout (ms). */
  requestTimeoutMs?: number
  /** Page-size ceiling for github_search. */
  searchMaxPerPage?: number
  /** File character cap for github_get. */
  fileMaxChars?: number
  /** Cooperative timeout budget (ms) for each tool. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  baseUrl: z.string(),
  token: z.string().role('secret'),
  tokenEnv: z.string().default(DEFAULT_TOKEN_ENV),
  userAgent: z.string(),
  requestTimeoutMs: z.number().min(1).default(GITHUB_DEFAULT_REQUEST_TIMEOUT_MS),
  searchMaxPerPage: z.number().step(1).min(1).default(30),
  fileMaxChars: z.number().step(1).min(1).default(GITHUB_FILE_MAX_CHARS),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_GITHUB_TOOL_TIMEOUT_MS),
})

/** Complete config after schemastery applies every field default. */
type ResolvedConfig = Required<Config>

/** A non-blank string reading of an optional config value. */
function configured(value: string | undefined): string | undefined {
  return value !== undefined && value.length > 0 ? value : undefined
}

/** The model-facing guidance registered with the system prompt. */
const GUIDANCE = 'Use github_search to find GitHub repositories or issues by query; follow up with github_get to read one repository, issue, or file in full. Cite the GitHub URL as a markdown link when you use its content.'

/**
 * Register the GitHub provider and both tools. Provider reads are
 * effect-scoped, so they unregister with the plugin fiber.
 * @param ctx - context whose tools and systemPrompt registries receive the
 *   registrations.
 * @param config - schemastery-defaulted plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  const baseUrl = configured(resolved.baseUrl)
  if (baseUrl !== undefined) {
    try {
      const parsed = new URL(baseUrl)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('scheme must be http or https')
    } catch (cause: unknown) {
      throw new Error('dsh-github: baseUrl must be a valid http(s) URL: ' + String(cause))
    }
  }
  const literalToken = configured(resolved.token)
  const tokenEnvName = resolved.tokenEnv
  const tokenValue = literalToken ?? process.env[tokenEnvName] ?? undefined
  const provider = new GithubApiProvider({
    baseUrl: baseUrl ?? GITHUB_DEFAULT_BASE_URL,
    ...tokenValue === undefined ? {} : { token: tokenValue },
    userAgent: configured(resolved.userAgent) ?? GITHUB_DEFAULT_USER_AGENT,
    requestTimeoutMs: resolved.requestTimeoutMs,
  })
  ctx.systemPrompt.section({
    name: 'tool:github',
    order: 112,
    text: GUIDANCE,
  })
  applyGithubSearchTool(ctx, provider, resolved.searchMaxPerPage, resolved.timeoutMs)
  applyGithubGetTool(ctx, provider, resolved.fileMaxChars, resolved.timeoutMs)
}

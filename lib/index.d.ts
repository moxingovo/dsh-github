/**
 * dsh-github: one DeepSeek Harness plugin that registers the GitHub
 * capability (ctx.github provider) and the github_search / github_get
 * tools. Anonymous by default; an optional token from the environment
 * unlocks code search and raises the rate limit.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export { GithubApiProvider, GITHUB_DEFAULT_BASE_URL, GITHUB_DEFAULT_REQUEST_TIMEOUT_MS, GITHUB_DEFAULT_USER_AGENT, GITHUB_PROVIDER_ID, GITHUB_SEARCH_MAX_PER_PAGE, mapFileData, mapIssueData, mapRepoData, mapSearchData } from './provider.ts';
export type { GithubApiProviderOptions } from './provider.ts';
export { GithubError } from './types.ts';
export type { GithubFileResult, GithubIssueDetail, GithubProviderLike, GithubRepoDetail, GithubSearchItem, GithubSearchKind, GithubSearchRequest, GithubSearchResult, } from './types.ts';
export { GITHUB_FILE_MAX_CHARS, GITHUB_SEARCH_DEFAULT_PER_PAGE, applyGithubGetTool, applyGithubSearchTool, formatFileOutput, formatIssueOutput, formatRepoOutput, formatSearchOutput, githubFileOutput, parseGetArgs, parseSearchArgs, } from './tools.ts';
export type { GithubFileOutput, GithubGetKind, GithubSearchOutput, GithubSearchOutputItem } from './tools.ts';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "dsh-github";
/** Services required before the plugin starts. */
export declare const inject: string[];
/** Default cooperative tool-call timeout budget (ms). */
export declare const DEFAULT_GITHUB_TOOL_TIMEOUT_MS = 30000;
/** Environment variable naming the optional GitHub access token. */
export declare const DEFAULT_TOKEN_ENV = "GITHUB_TOKEN";
/** Plugin config; every field is optional with env and constant defaults. */
export interface Config {
    /** API base URL override; defaults to api.github.com. */
    baseUrl?: string;
    /** Literal Bearer token; prefer tokenEnv so no secret enters config files. */
    token?: string;
    /** Environment variable naming the token; defaults to GITHUB_TOKEN. */
    tokenEnv?: string;
    /** User-Agent header. */
    userAgent?: string;
    /** Per-request timeout (ms). */
    requestTimeoutMs?: number;
    /** Page-size ceiling for github_search. */
    searchMaxPerPage?: number;
    /** File character cap for github_get. */
    fileMaxChars?: number;
    /** Cooperative timeout budget (ms) for each tool. */
    timeoutMs?: number;
}
export declare const Config: z<Config>;
/**
 * Register the GitHub provider and both tools. Provider reads are
 * effect-scoped, so they unregister with the plugin fiber.
 * @param ctx - context whose tools and systemPrompt registries receive the
 *   registrations.
 * @param config - schemastery-defaulted plugin config.
 */
export declare function apply(ctx: Context, config: Config): void;

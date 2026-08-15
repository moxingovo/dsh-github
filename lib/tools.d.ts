/**
 * The model-facing github_search and github_get tools, bounded at the
 * value level for file content.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GithubFileResult, GithubIssueDetail, GithubProviderLike, GithubRepoDetail, GithubSearchKind } from './types.ts';
/** Provider surface the tools execute against. */
export type { GithubProviderLike };
/** Default page size for one github_search call. */
export declare const GITHUB_SEARCH_DEFAULT_PER_PAGE = 10;
/** Default cap on the file characters one call returns. */
export declare const GITHUB_FILE_MAX_CHARS = 200000;
/** The resource kinds github_get accepts. */
export type GithubGetKind = 'repo' | 'issue' | 'file';
/** The bounded file output value. */
export interface GithubFileOutput {
    path: string;
    htmlUrl: string;
    size: number;
    truncated: boolean;
    content: string;
}
/** One search hit as the tool output schema projects it. */
export interface GithubSearchOutputItem {
    kind: string;
    htmlUrl: string;
    title: string;
    description: string;
    author: string;
    state: string;
    stars: number;
    comments: number;
    createdAt: string;
}
/** One search page as the tool output schema projects it. */
export interface GithubSearchOutput {
    kind: string;
    totalCount: number;
    page: number;
    perPage: number;
    hasMore: boolean;
    items: readonly GithubSearchOutputItem[];
}
/**
 * Validate github_search arguments: a non-blank query, a known scope, and
 * positive bounded page numbers.
 */
export declare function parseSearchArgs(args: {
    query: string;
    kind?: string;
    page?: number;
    perPage?: number;
}, maxPerPage: number): {
    query: string;
    kind: GithubSearchKind;
    page: number;
    perPage: number;
};
/**
 * Validate github_get arguments: the kind, the owner/repo names, and the
 * kind-specific fields.
 */
export declare function parseGetArgs(args: {
    kind: string;
    owner: string;
    repo: string;
    number?: number;
    path?: string;
    ref?: string;
}): {
    kind: GithubGetKind;
    owner: string;
    repo: string;
    number?: number;
    path?: string;
    ref?: string;
};
/**
 * Bound the file content at the value level, marking any cut.
 */
export declare function githubFileOutput(file: GithubFileResult, maxChars: number): GithubFileOutput;
/** Format one search result page as the model-facing text block. */
export declare function formatSearchOutput(result: GithubSearchOutput): string;
/** Format a repository detail as the model-facing text block. */
export declare function formatRepoOutput(detail: GithubRepoDetail): string;
/** Format an issue detail as the model-facing text block. */
export declare function formatIssueOutput(detail: GithubIssueDetail): string;
/** Format the bounded file output as the model-facing text block. */
export declare function formatFileOutput(output: GithubFileOutput): string;
/**
 * Register the github_search tool.
 */
export declare function applyGithubSearchTool(ctx: Context, service: GithubProviderLike, maxPerPage: number, timeoutMs: number): void;
/**
 * Register the github_get tool.
 */
export declare function applyGithubGetTool(ctx: Context, service: GithubProviderLike, maxChars: number, timeoutMs: number): void;

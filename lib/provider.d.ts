/**
 * The GitHub REST API provider: repository/issue search, repository and
 * issue details, and base64 file content decoding. Anonymous by default;
 * an optional token unlocks code search and raises the rate limit. Every
 * request refuses redirects, and the token is only ever sent to the
 * configured API host.
 */
import type { GithubFileResult, GithubIssueDetail, GithubRepoDetail, GithubSearchRequest, GithubSearchResult } from './types.ts';
/** Provider registry id for the REST API implementation. */
export declare const GITHUB_PROVIDER_ID = "github-api";
/** Default API base URL. */
export declare const GITHUB_DEFAULT_BASE_URL = "https://api.github.com";
/** Default User-Agent header (GitHub requires one). */
export declare const GITHUB_DEFAULT_USER_AGENT = "dsh-github";
/** Default per-request timeout (ms). */
export declare const GITHUB_DEFAULT_REQUEST_TIMEOUT_MS = 30000;
/** The search endpoints' hard ceiling on page size (the API maximum). */
export declare const GITHUB_SEARCH_MAX_PER_PAGE = 100;
/** Options for one provider instance. */
export interface GithubApiProviderOptions {
    /** API base URL; defaults to GITHUB_DEFAULT_BASE_URL. */
    baseUrl?: string;
    /** Optional Bearer token; resolved by the plugin from the environment. */
    token?: string;
    /** User-Agent header; defaults to GITHUB_DEFAULT_USER_AGENT. */
    userAgent?: string;
    /** Per-request timeout (ms); defaults to GITHUB_DEFAULT_REQUEST_TIMEOUT_MS. */
    requestTimeoutMs?: number;
}
/** The REST provider. Stateless beyond its options. */
export declare class GithubApiProvider {
    readonly id = "github-api";
    private readonly options;
    constructor(options?: GithubApiProviderOptions);
    /** Always usable: anonymous access needs no credentials. */
    available(): boolean;
    /** Search repositories or issues. */
    search(request: GithubSearchRequest, signal?: AbortSignal): Promise<GithubSearchResult>;
    /** Fetch one repository's metadata. */
    repo(request: {
        readonly owner: string;
        readonly repo: string;
    }, signal?: AbortSignal): Promise<GithubRepoDetail>;
    /** Fetch one issue or pull request. */
    issue(request: {
        readonly owner: string;
        readonly repo: string;
        readonly number: number;
    }, signal?: AbortSignal): Promise<GithubIssueDetail>;
    /** Fetch one file's decoded text content. */
    file(request: {
        readonly owner: string;
        readonly repo: string;
        readonly path: string;
        readonly ref?: string;
    }, signal?: AbortSignal): Promise<GithubFileResult>;
    /**
     * One GET against the API host. Refuses any redirect and maps HTTP
     * status classes into structured errors carrying the API's message.
     */
    private requestJson;
}
/**
 * Map a search endpoint payload into one normalized result page.
 */
export declare function mapSearchData(data: unknown, kind: GithubSearchRequest['kind'], page: number, perPage: number): GithubSearchResult;
/** Map a repository endpoint payload into the normalized detail. */
export declare function mapRepoData(data: unknown): GithubRepoDetail;
/** Map an issue endpoint payload into the normalized detail. */
export declare function mapIssueData(data: unknown): GithubIssueDetail;
/**
 * Map a contents endpoint payload into decoded text.
 * @throws GithubError GITHUB_FILE_TOO_LARGE when the API omits the content.
 */
export declare function mapFileData(data: unknown, owner: string, repo: string): GithubFileResult;

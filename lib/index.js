/**
 * dsh-github: one DeepSeek Harness plugin that registers the GitHub
 * capability (ctx.github provider) and the github_search / github_get
 * tools. Anonymous by default; an optional token from the environment
 * unlocks code search and raises the rate limit.
 */
import z from '@deepseek-ai/schemastery';
import { GithubApiProvider, GITHUB_DEFAULT_BASE_URL, GITHUB_DEFAULT_REQUEST_TIMEOUT_MS, GITHUB_DEFAULT_USER_AGENT } from "./provider.js";
import { applyGithubGetTool, applyGithubSearchTool, GITHUB_FILE_MAX_CHARS } from "./tools.js";
export { GithubApiProvider, GITHUB_DEFAULT_BASE_URL, GITHUB_DEFAULT_REQUEST_TIMEOUT_MS, GITHUB_DEFAULT_USER_AGENT, GITHUB_PROVIDER_ID, GITHUB_SEARCH_MAX_PER_PAGE, mapFileData, mapIssueData, mapRepoData, mapSearchData } from "./provider.js";
export { GithubError } from "./types.js";
export { GITHUB_FILE_MAX_CHARS, GITHUB_SEARCH_DEFAULT_PER_PAGE, applyGithubGetTool, applyGithubSearchTool, formatFileOutput, formatIssueOutput, formatRepoOutput, formatSearchOutput, githubFileOutput, parseGetArgs, parseSearchArgs, } from "./tools.js";
/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-plugin-github';
/** Services required before the plugin starts. */
export const inject = ['tools', 'systemPrompt'];
/** Default cooperative tool-call timeout budget (ms). */
export const DEFAULT_GITHUB_TOOL_TIMEOUT_MS = 30_000;
/** Environment variable naming the optional GitHub access token. */
export const DEFAULT_TOKEN_ENV = 'GITHUB_TOKEN';
export const Config = z.object({
    baseUrl: z.string(),
    token: z.string().role('secret'),
    tokenEnv: z.string().default(DEFAULT_TOKEN_ENV),
    userAgent: z.string(),
    requestTimeoutMs: z.number().min(1).default(GITHUB_DEFAULT_REQUEST_TIMEOUT_MS),
    searchMaxPerPage: z.number().step(1).min(1).default(30),
    fileMaxChars: z.number().step(1).min(1).default(GITHUB_FILE_MAX_CHARS),
    timeoutMs: z.number().step(1).min(1).default(DEFAULT_GITHUB_TOOL_TIMEOUT_MS),
});
/** A non-blank string reading of an optional config value. */
function configured(value) {
    return value !== undefined && value.length > 0 ? value : undefined;
}
/** The model-facing guidance registered with the system prompt. */
const GUIDANCE = 'Use github_search to find GitHub repositories or issues by query; follow up with github_get to read one repository, issue, or file in full. Cite the GitHub URL as a markdown link when you use its content.';
/**
 * Register the GitHub provider and both tools. Provider reads are
 * effect-scoped, so they unregister with the plugin fiber.
 * @param ctx - context whose tools and systemPrompt registries receive the
 *   registrations.
 * @param config - schemastery-defaulted plugin config.
 */
export function apply(ctx, config) {
    const resolved = config;
    const baseUrl = configured(resolved.baseUrl);
    if (baseUrl !== undefined) {
        try {
            const parsed = new URL(baseUrl);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
                throw new Error('scheme must be http or https');
        }
        catch (cause) {
            throw new Error('dsh-github: baseUrl must be a valid http(s) URL: ' + String(cause));
        }
    }
    const literalToken = configured(resolved.token);
    const tokenEnvName = resolved.tokenEnv;
    const tokenValue = literalToken ?? process.env[tokenEnvName] ?? undefined;
    const provider = new GithubApiProvider({
        baseUrl: baseUrl ?? GITHUB_DEFAULT_BASE_URL,
        ...tokenValue === undefined ? {} : { token: tokenValue },
        userAgent: configured(resolved.userAgent) ?? GITHUB_DEFAULT_USER_AGENT,
        requestTimeoutMs: resolved.requestTimeoutMs,
    });
    ctx.systemPrompt.section({
        name: 'tool:github',
        order: 112,
        text: GUIDANCE,
    });
    applyGithubSearchTool(ctx, provider, resolved.searchMaxPerPage, resolved.timeoutMs);
    applyGithubGetTool(ctx, provider, resolved.fileMaxChars, resolved.timeoutMs);
}
//# sourceMappingURL=index.js.map
/**
 * Vocabulary for the dsh-github plugin: repository and issue search,
 * repository and issue details, and file content over the public GitHub
 * REST API.
 */
/**
 * Typed plugin error with a machine-routable code and chained cause.
 */
export class GithubError extends Error {
    /** Machine-routable error code. */
    code;
    /** The HTTP status the API answered with, when one applied. */
    statusCode;
    constructor(message, code, options = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'GithubError';
        this.code = code;
        if (options.statusCode !== undefined)
            this.statusCode = options.statusCode;
    }
}
//# sourceMappingURL=types.js.map
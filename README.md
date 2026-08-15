# dsh-plugin-github

[中文](README.zh.md) | English

A GitHub retrieval plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). After install the agent gains two tools:

- `github_search` — find repositories and issues/PRs with native GitHub search syntax (e.g. `repo:vercel/next.js is:issue`).
- `github_get` — read one resource in full: repository metadata, an issue or pull-request body, or a decoded file.

Anonymous by default (60 requests per hour per IP). Set a read-only fine-grained token to unlock code search and raise the limit to 5000 per hour. Read-only by design: the plugin never creates issues, comments, or code.

## Install

```sh
dsh plugin --profile web add dsh-plugin-github

# or directly from Git:
dsh plugin --profile web add git+https://github.com/moxingovo/dsh-github
```

Restart `dsh web`. New conversations gain `github_search` and `github_get` automatically.

## Optional token

Create a fine-grained personal access token with Repository access = Public Repositories (read-only) and put it in the environment (or in your `$DSH_HOME/.env`):

```sh
GITHUB_TOKEN=github_pat_...
```

Without a token everything still works anonymously; only code search and the higher rate limit need the token.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `tokenEnv` | `GITHUB_TOKEN` | Environment variable naming the optional token. |
| `requestTimeoutMs` | `30000` | Per-request timeout (ms). |
| `searchMaxPerPage` | `30` | Page-size ceiling for `github_search` (API maximum 100). |
| `fileMaxChars` | `200000` | File character cap for `github_get` (value-level, with a `truncated` flag). |

Override any field in `profiles/web/cordis.patch.yml` — later layers win per row.

## Error codes

Tools fail with structured errors carrying these codes: `GITHUB_UNAUTHORIZED` (401, typically code search without a token), `GITHUB_FORBIDDEN` (403, rate limit or permissions), `GITHUB_NOT_FOUND` (404), `GITHUB_API_ERROR` (422 or other non-2xx), `GITHUB_BAD_RESPONSE` (non-JSON body), `GITHUB_REDIRECT_REFUSED` (credential-safety guard), `GITHUB_REQUEST_FAILED` (network), `GITHUB_FILE_TOO_LARGE` (files over 1MB are not inlined by the API).

## Security

- The token is read from the environment only; it never enters configuration files, logs, or tool output.
- Every request refuses redirects, so the token can never be forwarded to another origin.
- The token is sent only to `api.github.com`.

## Skills

Two companion skills ship in `skills/`: `plugin-tool-github` (tool usage) and `plugin-web-github` (service configuration and error codes). Copy them into your harness skills directory to make the agent consult them before calling the tools.

## Development

Node 22 or newer:

```sh
npm ci
npm test
```

The repo pins its dependency tree in package-lock.json. The test suite runs fully offline (mocked HTTP); the typecheck runs against the published DeepSeek Harness packages.

## Known issue

Early rc releases of the official DeepSeek Harness packages declare an unpublished peer dependency: dsh-agent 0.0.1-rc.1/rc.2 and dsh-session 0.0.1-rc.1/rc.2 list @deepseek-ai/dsh-type-meta, which is not on the npm registry. A fresh install whose resolver lands on those versions fails with a 404 for @deepseek-ai/dsh-type-meta (reproduced with pnpm 11 and the npmmirror mirror; npm resolves 0.0.1-rc.5 and succeeds). Workarounds: npm with the committed package-lock.json (npm ci), or dsh plugin add inside an already-installed harness workspace, whose lockfile pins resolvable versions. This is an upstream rc-stage publishing issue and disappears once upstream fixes the metadata.

## License

[MIT](LICENSE)

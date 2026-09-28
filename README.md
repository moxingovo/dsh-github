# dsh-plugin-github

[中文](README.zh.md) | **English** · [Changelog](CHANGELOG.md) · [Releases](https://github.com/moxingovo/dsh-github/releases)

A **GitHub retrieval plugin** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
After install the agent gains two tools:

- `github_search` — find repositories and issues/PRs with native GitHub search syntax
  (e.g. `repo:vercel/next.js is:issue`, `agent harness language:typescript`).
- `github_get` — read one resource in full: repository metadata, an issue or pull-request body, or a
  decoded file (optionally at a specific branch or tag).

Anonymous by default (60 requests per hour per IP). Set a read-only fine-grained token to unlock code
search and raise the limit to 5000 per hour. Read-only by design: the plugin never creates issues,
comments, or code.

> Unofficial community plugin — not affiliated with DeepSeek or GitHub.
>
> **Harness compatibility**: **0.1.4** is verified on **DeepSeek Harness 0.1.7-rc.2**, and 0.1.3 on
> **0.1.6-alpha.2** — **no runtime code change was needed for either**. The 0.1.0–0.1.7 lines all work.
> Version map in [Compatibility](#compatibility).

## Install

```sh
dsh plugin --profile web add dsh-plugin-github

# or directly from Git:
dsh plugin --profile web add git+https://github.com/moxingovo/dsh-github
```

Restart `dsh web`. New conversations gain `github_search` and `github_get`.

Mount it in an agent preset instead when only that preset should see the tools:

```yaml
- id: dsh-plugin-github
  name: 'dsh-plugin-github'
```

## Optional token

Create a fine-grained personal access token with **Repository access = Public Repositories
(read-only)**, then put it in the environment or in your `$DSH_HOME/.env` (the launcher injects every
`KEY=VALUE` line of that file into the server process):

```sh
GITHUB_TOKEN=github_pat_...
```

Without a token everything still works anonymously; only code search and the higher rate limit need it.
The token is never written to configuration files, logs, or tool output.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `baseUrl` | `https://api.github.com` | API host (must be an http/https URL). |
| `token` | — | Literal token (secret; prefer `tokenEnv`). |
| `tokenEnv` | `GITHUB_TOKEN` | Environment variable naming the optional token. |
| `userAgent` | `dsh-github` | User-Agent header. |
| `requestTimeoutMs` | `30000` | Per-request timeout (ms). |
| `searchMaxPerPage` | `30` | Page-size ceiling for `github_search` (API maximum 100). |
| `fileMaxChars` | `200000` | File character cap for `github_get` (value-level, with a `truncated` flag). |
| `timeoutMs` | `30000` | Cooperative tool-call timeout budget. |

Override any field in `profiles/web/cordis.patch.yml` — later layers win per row:

```yaml
- id: github
  name: 'dsh-plugin-github'
  config:
    searchMaxPerPage: 50
```

This package is self-contained: it registers the tools and carries its own GitHub REST provider
(`github-api`). It does **not** publish a `ctx.github` service, so no other plugin can consume it by
service key (an earlier in-tree line did — see [Compatibility](#compatibility)).

## Tools and error codes

`github_search` takes `query` (required), `kind` (`repositories` default, or `issues` — which includes
pull requests), `page`, and `perPage` (≤ 30). `github_get` takes `kind` (`repo` | `issue` | `file`),
`owner`, `repo`, plus `number` for issues and `path` (with optional `ref`) for files. File paths are
percent-encoded segment by segment, so spaces, non-ASCII names and `#`/`?` work; with `ref` the returned
`htmlUrl` points at that revision rather than HEAD.

Tools fail with structured errors carrying these codes:

| Code | Meaning |
|---|---|
| `GITHUB_UNAUTHORIZED` | 401 — needs a token (typically code search). |
| `GITHUB_FORBIDDEN` | 403 — rate limit or insufficient permissions. |
| `GITHUB_NOT_FOUND` | 404 — repository, issue or path does not exist. |
| `GITHUB_API_ERROR` | 422 invalid search syntax, or another non-2xx status. |
| `GITHUB_BAD_RESPONSE` | Non-JSON response body. |
| `GITHUB_REDIRECT_REFUSED` | A redirect was refused — the credential-safety guard. |
| `GITHUB_REQUEST_FAILED` | Network failure, including timeouts. |
| `GITHUB_FILE_TOO_LARGE` | The API does not inline files over 1MB, so no content is returned. |

Two independent boundaries apply to file reads: the API inlines at most 1MB (`GITHUB_FILE_TOO_LARGE`
above), and the tool truncates at `fileMaxChars` (default 200000) with `truncated: true`.

## Skills

Two companion skills ship in `skills/`:

- `plugin-tool-github` — tool usage: arguments, search syntax, error routing, fallbacks.
- `plugin-web-github` — the host-side provider: config keys, the `GITHUB_TOKEN` credential, rate
  limits, the 1MB boundary, the TLS-interception caveat, and the full error-code table.

**DeepSeek Harness does not auto-load skills that live inside a plugin package.** Copy them into your
user skill root, or point a preset's `skill-filesystem` at the installed package:

```sh
# user root — available to every preset that mounts skill-filesystem
cp -r node_modules/dsh-plugin-github/skills/* ~/.dsh/skills/
```

```yaml
# or, in an agent preset: keep the skills in the package and reference them
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - '<DSH_HOME>/profiles/web/node_modules/dsh-plugin-github/skills'
```

Either way the agent consults the matching skill before calling the tools.

## Security

- The token is read from the environment (or an explicit literal config value) only; it never enters
  logs or tool output.
- Every request refuses redirects, so the token can never be forwarded to another origin.
- The token is sent only to the configured API host (`api.github.com` by default).
- No write operations of any kind: the plugin cannot create issues, comment, or push code.

## Development

Node 22 or newer:

```sh
npm ci
npm test          # 7 tests, fully offline (mocked HTTP)
npm run typecheck # runs against the published DeepSeek Harness packages
npm run build
```

The repo pins its dependency tree in `package-lock.json`, and CI runs exactly these four commands
(`.github/workflows/ci.yml`). Release steps live in [RELEASE.md](RELEASE.md).

## Known issue

Early rc releases of the official DeepSeek Harness packages declare an unpublished peer dependency:
dsh-agent 0.0.1-rc.1/rc.2 and dsh-session 0.0.1-rc.1/rc.2 list @deepseek-ai/dsh-type-meta, which is not
on the npm registry. A fresh install whose resolver lands on those versions fails with a 404 for
@deepseek-ai/dsh-type-meta (reproduced with pnpm 11 and the npmmirror mirror; npm resolves 0.0.1-rc.5
and succeeds). Workarounds: npm with the committed package-lock.json (`npm ci`), or `dsh plugin add`
inside an already-installed harness workspace, whose lockfile pins resolvable versions. This is an
upstream rc-stage publishing issue and disappears once upstream fixes the metadata.

## Compatibility

| Plugin | DeepSeek Harness | Notes |
|---|---|---|
| 0.1.4 | **0.1.7-rc.2** | Verified; runtime unchanged. `devDependencies` now target `@deepseek-ai/*@0.1.7-rc.2`, so the typecheck is the compatibility check. |
| 0.1.3 | 0.1.6-alpha.2 | Verified; runtime unchanged (the plugin uses no typert codec API). |
| 0.1.2 | 0.1.0 – 0.1.6 | Path encoding + ref-aware `htmlUrl`. |
| 0.1.0–0.1.1 | 0.1.0 line | `github_search` / `github_get`. |

Live-verified on 0.1.7-rc.2: `github_search` (repositories and issues) and `github_get`
(`repo` and `file`). Typecheck, build and all 7 tests pass against `@deepseek-ai/*@0.1.7-rc.2`.

## License

MIT — see [LICENSE](LICENSE).

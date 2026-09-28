# dsh-plugin-github

**简体中文** | [English](README.md) · [更新日志](CHANGELOG.md) · [下载](https://github.com/moxingovo/dsh-github/releases)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的 **GitHub 检索插件**。
安装后 Agent 获得两个工具：

- `github_search` —— 用 GitHub 原生搜索语法查找仓库与 issue/PR（例如
  `repo:vercel/next.js is:issue`、`agent harness language:typescript`）。
- `github_get` —— 完整读取一项资源：仓库元数据、issue 或拉取请求正文、或文件解码内容
  （可指定分支/标签）。

默认匿名可用（每 IP 每小时 60 次）。配置只读 fine-grained token 后解锁代码搜索并提升到每小时
5000 次。只读设计：插件不会创建 issue、发评论或写代码。

> 非官方社区插件，与 DeepSeek、GitHub 官方均无关。
>
> **Harness 兼容性**：**0.1.4** 已在 **DeepSeek Harness 0.1.7-rc.2** 上验证，0.1.3 已在
> **0.1.6-alpha.2** 上验证 —— **两条线都无需改动运行时代码**。0.1.0–0.1.7 全线可用。
> 版本对照见[兼容性](#兼容性)。

## 安装

```sh
dsh plugin --profile web add dsh-plugin-github

# 或直接从 Git 安装：
dsh plugin --profile web add git+https://github.com/moxingovo/dsh-github
```

重启 `dsh web`，新会话即获得 `github_search` 与 `github_get`。

只让某个 preset 看见这些工具时，改为在 preset 里挂载：

```yaml
- id: dsh-plugin-github
  name: 'dsh-plugin-github'
```

## 可选 token

创建 fine-grained personal access token（**Repository access 选 Public Repositories，只读**），
写入环境变量或 `$DSH_HOME/.env`（launcher 会把该文件里每一条 `KEY=VALUE` 注入服务器进程环境）：

```sh
GITHUB_TOKEN=github_pat_...
```

不配置 token 时全部功能仍可匿名使用；只有代码搜索和更高速率需要它。token 绝不写入配置文件、
日志或工具输出。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `baseUrl` | `https://api.github.com` | API 主机（必须是 http/https URL）。 |
| `token` | — | 字面量 token（secret；优先用 `tokenEnv`）。 |
| `tokenEnv` | `GITHUB_TOKEN` | 存放可选 token 的环境变量名。 |
| `userAgent` | `dsh-github` | User-Agent 头。 |
| `requestTimeoutMs` | `30000` | 单请求超时（毫秒）。 |
| `searchMaxPerPage` | `30` | `github_search` 页大小上限（API 上限 100）。 |
| `fileMaxChars` | `200000` | `github_get` 文件字符上限（值层截断并带 `truncated` 标记）。 |
| `timeoutMs` | `30000` | 工具协作超时预算。 |

可在 `profiles/web/cordis.patch.yml` 中覆盖任意字段 —— 按行后层覆盖前层：

```yaml
- id: github
  name: 'dsh-plugin-github'
  config:
    searchMaxPerPage: 50
```

本包是自包含的：它注册工具并自带 GitHub REST 提供方（`github-api`），**不发布** `ctx.github`
服务，因此其它插件无法按服务名取用（早期内置包那条线会发布，见[兼容性](#兼容性)）。

## 工具与错误码

`github_search` 参数：`query`（必填）、`kind`（默认 `repositories`，或 `issues` —— 含拉取请求）、
`page`、`perPage`（≤ 30）。`github_get` 参数：`kind`（`repo` | `issue` | `file`）、`owner`、
`repo`，issue 另需 `number`，file 另需 `path`（可带 `ref`）。文件路径逐段百分号编码，含空格、
中文、`#`、`?` 的文件名都能读；带 `ref` 时返回的 `htmlUrl` 指向该版本而不是 HEAD。

工具以结构化错误失败并携带下列代码：

| 代码 | 含义 |
|---|---|
| `GITHUB_UNAUTHORIZED` | 401 —— 需要 token（典型是代码搜索）。 |
| `GITHUB_FORBIDDEN` | 403 —— 速率限制或权限不足。 |
| `GITHUB_NOT_FOUND` | 404 —— 仓库、issue 或路径不存在。 |
| `GITHUB_API_ERROR` | 422 搜索语法非法，或其它非 2xx。 |
| `GITHUB_BAD_RESPONSE` | 非 JSON 响应体。 |
| `GITHUB_REDIRECT_REFUSED` | 出现重定向被拒 —— 凭据安全保护生效。 |
| `GITHUB_REQUEST_FAILED` | 网络失败，含超时。 |
| `GITHUB_FILE_TOO_LARGE` | API 不下发超过 1MB 的文件内容。 |

读文件有两条互不相干的边界：API 最多内联 1MB（超过即 `GITHUB_FILE_TOO_LARGE`），工具层在
`fileMaxChars`（默认 200000）处截断并置 `truncated: true`。

## 技能

`skills/` 下附带两份技能：

- `plugin-tool-github` —— 工具用法：参数、搜索语法、错误分流、回退方案。
- `plugin-web-github` —— 宿主侧提供方：配置键、`GITHUB_TOKEN` 凭据、速率限制、1MB 边界、
  TLS 中间层注意事项、完整错误码表。

**DeepSeek Harness 不会自动加载插件包内的技能。** 把它们复制到用户技能根目录，或在 preset 的
`skill-filesystem` 里指向已安装的包：

```sh
# 用户根目录 —— 每个挂载了 skill-filesystem 的 preset 都能看到
cp -r node_modules/dsh-plugin-github/skills/* ~/.dsh/skills/
```

```yaml
# 或：把技能留在包里，在 agent preset 里引用
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - '<DSH_HOME>/profiles/web/node_modules/dsh-plugin-github/skills'
```

两种方式都能让 Agent 在调用工具前先查阅对应技能。

## 安全

- token 只从环境变量（或显式的字面量配置）读取，绝不进入日志或工具输出。
- 每次请求拒绝重定向，token 不可能被转发到其他源。
- token 只发送给配置的 API 主机（默认 `api.github.com`）。
- 没有任何写操作：插件不能创建 issue、不能评论、不能推送代码。

## 开发

需要 Node 22 或更新：

```sh
npm ci
npm test          # 7 项，完全离线（HTTP 全部 mock）
npm run typecheck # 针对已发布的 DeepSeek Harness 包执行
npm run build
```

仓库用 `package-lock.json` 钉死依赖树，CI 跑的就是上面这四条命令
（`.github/workflows/ci.yml`）。发布流程见 [RELEASE.md](RELEASE.md)。

## 已知问题

DeepSeek Harness 官方包的早期 rc 版本声明了未发布的 peer 依赖：dsh-agent 0.0.1-rc.1/rc.2 与
dsh-session 0.0.1-rc.1/rc.2 引用了 @deepseek-ai/dsh-type-meta，该包不在 npm 注册表上。全新安装
时若解析器落到这些版本，会以 @deepseek-ai/dsh-type-meta 的 404 失败（已在 pnpm 11 与
npmmirror 镜像复现；npm 解析到 0.0.1-rc.5 所以成功）。对策：用 npm 配合仓库内的
`package-lock.json`（`npm ci`），或在已装好 harness 的工作区内执行 `dsh plugin add` —— 其
lockfile 已锁定可用版本。这是上游 rc 阶段的发布问题，上游修复元数据后自动消失。

## 兼容性

| 插件版本 | DeepSeek Harness | 说明 |
|---|---|---|
| 0.1.4 | **0.1.7-rc.2** | 已验证，运行时代码无需改动；`devDependencies` 指向 `@deepseek-ai/*@0.1.7-rc.2`，typecheck 即为兼容性验证。 |
| 0.1.3 | 0.1.6-alpha.2 | 已验证，运行时代码无需改动（本插件不使用 typert codec API）。 |
| 0.1.2 | 0.1.0 – 0.1.6 | 路径编码 + ref 感知的 `htmlUrl`。 |
| 0.1.0–0.1.1 | 0.1.0 线 | `github_search` / `github_get`。 |

0.1.7-rc.2 上实测：`github_search`（repositories 与 issues 两种 kind）与 `github_get`
（`repo` 与 `file`）可用。typecheck、build 与全部 7 项测试针对 `@deepseek-ai/*@0.1.7-rc.2` 通过。

## 许可证

MIT，见 [LICENSE](LICENSE)。

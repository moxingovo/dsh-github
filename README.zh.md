# dsh-plugin-github

[English](README.md) | 中文

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的 GitHub 检索插件。安装后 Agent 获得两个工具：

- `github_search` —— 用 GitHub 原生搜索语法查找仓库与 issue/PR（例如 `repo:vercel/next.js is:issue`）。
- `github_get` —— 完整读取一项资源：仓库元数据、issue 或拉取请求正文、或文件解码内容。

默认匿名可用（每 IP 每小时 60 次）。配置只读 fine-grained token 后解锁代码搜索并提升到每小时 5000 次。只读设计：插件不会创建 issue、发评论或写代码。

## 安装

```sh
dsh plugin --profile web add dsh-plugin-github

# 或直接从 Git 安装：
dsh plugin --profile web add git+https://github.com/moxingovo/dsh-github
```

重启 `dsh web`，新会话自动获得 `github_search` 与 `github_get`。

## 可选 token

创建 fine-grained token（Repository access 选 Public Repositories 只读），写入环境变量或 `$DSH_HOME/.env`：

```sh
GITHUB_TOKEN=github_pat_...
```

不配置 token 时全部功能仍可匿名使用；只有代码搜索和更高速率需要 token。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `tokenEnv` | `GITHUB_TOKEN` | 存放可选 token 的环境变量名。 |
| `requestTimeoutMs` | `30000` | 单请求超时（毫秒）。 |
| `searchMaxPerPage` | `30` | `github_search` 页大小上限（API 上限 100）。 |
| `fileMaxChars` | `200000` | `github_get` 文件字符上限（值层截断并带 `truncated` 标记）。 |

可在 `profiles/web/cordis.patch.yml` 中覆盖任意字段——按行后层覆盖前层。

## 错误码

工具以结构化错误失败并携带下列代码：`GITHUB_UNAUTHORIZED`（401，通常是无 token 的代码搜索）、`GITHUB_FORBIDDEN`（403，速率或权限）、`GITHUB_NOT_FOUND`（404）、`GITHUB_API_ERROR`（422 或其他非 2xx）、`GITHUB_BAD_RESPONSE`（非 JSON 响应体）、`GITHUB_REDIRECT_REFUSED`（凭据安全保护）、`GITHUB_REQUEST_FAILED`（网络）、`GITHUB_FILE_TOO_LARGE`（API 不下发超过 1MB 的文件内容）。

## 安全

- token 只从环境变量读取，绝不进入配置文件、日志或工具输出。
- 每次请求拒绝重定向，token 不可能被转发到其他源。
- token 只发送给 `api.github.com`。

## Skills

随仓库附带两份技能：`skills/plugin-tool-github`（工具用法）与 `skills/plugin-web-github`（服务配置与错误码）。把它们复制进你的 harness 技能目录，Agent 便会在调用工具前先查阅。

## 开发

需要 Node 22 或更新：

```sh
npm ci
npm test
```

仓库用 package-lock.json 钉死依赖树。测试套件完全离线运行（HTTP 全部 mock）；类型检查针对已发布的 DeepSeek Harness 包执行。

## 已知问题

DeepSeek Harness 官方包的早期 rc 版本声明了未发布的 peer 依赖：dsh-agent 0.0.1-rc.1/rc.2 与 dsh-session 0.0.1-rc.1/rc.2 引用了 @deepseek-ai/dsh-type-meta，该包不在 npm 注册表上。全新安装时若解析器落到这些版本，会以 @deepseek-ai/dsh-type-meta 的 404 失败（已在 pnpm 11 与 npmmirror 镜像复现；npm 解析到 0.0.1-rc.5 所以成功）。对策：用 npm 配合仓库内的 package-lock.json（npm ci），或在已装好 harness 的工作区内执行 dsh plugin add——其 lockfile 已锁定可用版本。这是上游 rc 阶段的发布问题，上游修复元数据后自动消失。

## 许可证

[MIT](LICENSE)

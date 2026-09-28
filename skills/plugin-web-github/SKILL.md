---
name: plugin-web-github
description: Use when configuring or diagnosing the GitHub provider inside dsh-plugin-github — the plugin's own config keys, the GITHUB_TOKEN credential, rate limits, the 1MB file boundary, the TLS interception caveat, and the GithubError code table.
---

# GitHub 提供方与故障排查（plugin-web-github）

插件版本：0.1.3（独立插件 dsh-plugin-github，已在 DeepSeek Harness 0.1.7-rc.2 与 0.1.6-alpha.2 上验证）。关联技能：plugin-tool-github（模型侧工具用法，正常使用时先看它）。

## 功能概述

宿主侧是 **GithubApiProvider**（提供方 id：`github-api`），它**随插件一起加载，不发布独立的 `ctx.github` 服务**，因此不能从别的插件按服务名取用。它负责：仓库与 issue 搜索、仓库/issue 详情、文件 base64 解码、HTTP 状态到错误码的映射与超时。插件声明的依赖只有 `tools` 与 `systemPrompt` 两个服务；模型通过 plugin-tool-github 的两个工具间接使用它。

## 适用场景

该用：排查工具报错原因、理解错误码、配置 token 或端点。
不该用：当成可调用工具；用于写操作（提供方只实现读取）。
易误用：把匿名 60 次/小时的速率限制当成故障；在 TLS 中间层环境下不带 `--use-system-ca` 重启服务器；把 token 当成能从 GUI 里配的东西（本插件只读环境变量，见下）。

## 关键行为

- 默认匿名访问，每 IP 每小时 60 次请求；配置 token 后提升到 5000 次并解锁代码搜索。
- 所有请求拒绝重定向；token 只发给配置的 API 主机（默认 `https://api.github.com`）。
- 文件路径请求逐段 URL 编码（含空格/中文/`#`/`?` 的文件名不受影响）；指定 ref 时返回的 htmlUrl 携带该 ref，保证链接指向对应版本而非 HEAD。
- 超过 1MB 的文件 API 不下发内容，报 GITHUB_FILE_TOO_LARGE；1MB 以内的文件由工具层在 `fileMaxChars`（默认 200000）处截断并置 `truncated=true`。两层边界独立生效：超 1MB 时根本到不了截断步骤。
- 用户代理默认 `dsh-github`；单请求超时默认 30000 ms。

## 凭据与配置键

凭据解析顺序**只有两步**：插件配置里的字面量 `token`，然后是启动环境变量 `process.env[tokenEnv]`。这条插件**不接 harness 的 credentials seam**（那是内置 `ctx.github` 服务的做法，已随内置包移除）。实践中把 `GITHUB_TOKEN=...` 写进 `~/.dsh/.env`：launcher/watchdog 会把 .env 的每个 KEY=VALUE 注入服务器进程环境，插件由此读到。

插件配置键（宿主 profile 的 cordis patch 里给，或由 bundle 自带的 `cordis.patch.yml` 提供默认）：

- `baseUrl`：API 主机，默认 `https://api.github.com`（必须是 http/https URL，否则插件启动即报错）。
- `token`：字面量 fine-grained 只读 token（secret，不建议直接写进配置文件）。
- `tokenEnv`：凭据所在的环境变量名，默认 `GITHUB_TOKEN`。
- `userAgent`：默认 `dsh-github`。
- `requestTimeoutMs`：单请求超时，默认 30000。
- `searchMaxPerPage`：`github_search` 每页上限，默认 30（API 上限 100）。
- `fileMaxChars`：`github_get` 读文件时的字符上限，默认 200000。
- `timeoutMs`：工具协作超时预算，默认 30000。

没有 `provider` 选择键：本插件只带 github-api 这一个提供方。

## 错误码表

- GITHUB_UNAUTHORIZED：401，需要 token（典型是代码搜索）。
- GITHUB_FORBIDDEN：403，速率限制或权限不足。
- GITHUB_NOT_FOUND：404，资源不存在。
- GITHUB_API_ERROR：422 搜索语法非法，或其他非 2xx。
- GITHUB_BAD_RESPONSE：非 JSON 响应。
- GITHUB_REDIRECT_REFUSED：出现重定向，凭据安全保护生效。
- GITHUB_REQUEST_FAILED：网络失败，含超时。
- GITHUB_FILE_TOO_LARGE：文件超过 1MB，API 不下发内容。

## 异常与回退

工具报错时按错误码分类再决定重试或换路径（详见 plugin-tool-github）。凭据问题检查 `~/.dsh/.env` 里的 `GITHUB_TOKEN`；本插件不负责创建或续期 token（GitHub fine-grained token 最长一年，到期需人工更换）。

## 环境相关

- 若该机器存在 TLS 中间层（公司代理、杀软 HTTPS 扫描），服务器需以 `NODE_OPTIONS=--use-system-ca` 运行，否则请求可能报 GITHUB_REQUEST_FAILED——这是环境问题，不是插件缺陷。
- 本机代理为 fake-IP/TUN 模式时，`curl` 之类工具可能解析到保留地址而失败，但 Node 的 `fetch`（本插件用的路径）走系统解析正常；判断"GitHub 连不上"时要用 Node 实际发一次请求，别用 curl 的失败下结论。

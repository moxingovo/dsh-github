---
name: plugin-web-github
description: Use when configuring or diagnosing the GitHub provider inside dsh-plugin-github — the plugin's own config keys, the GITHUB_TOKEN credential, rate limits, the 1MB file boundary, the TLS interception caveat, and the GithubError code table.
---

# GitHub 提供方与故障排查（plugin-web-github）

插件版本：0.1.6（独立插件 dsh-plugin-github，已在 DeepSeek Harness 0.2.0-rc.2 —— 官方桌面端内置的那个运行时 —— 上验证；0.1.6 只改了失败映射）。关联技能：plugin-tool-github（模型侧工具用法，正常使用时先看它）。

## 功能概述

宿主侧是 **GithubApiProvider**（提供方 id：`github-api`），它**随插件一起加载，不发布独立的 `ctx.github` 服务**，因此不能从别的插件按服务名取用。它负责：仓库与 issue 搜索、仓库/issue 详情、文件 base64 解码、HTTP 状态到错误码的映射与超时。插件声明的依赖只有 `tools` 与 `systemPrompt` 两个服务；模型通过 plugin-tool-github 的两个工具间接使用它。

## 适用场景

该用：排查工具报错原因、理解错误码、配置 token 或端点。
不该用：当成可调用工具；用于写操作（提供方只实现读取）。
易误用：把匿名 60 次/小时的速率限制当成故障；**把 TLS 中间层造成的证书失败当成「网络不通」**；试图用 `~/.dsh/.env` 传 `NODE_OPTIONS` 这类启动期变量（会让 dsh 起不来，见「环境相关」）；把 token 当成能从 GUI 里配的东西（本插件只读环境变量，见下）。

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
- GITHUB_TLS_UNTRUSTED：连接的证书不被本运行时信任 —— 有东西在中间重签 HTTPS（代理、杀软扫描、本地加速器）；消息里带底层 code。见下方「环境相关」的完整排查。
- GITHUB_REQUEST_FAILED：网络失败，含超时；0.1.6 起消息里附底层 code（如 `[ECONNREFUSED]`）。
- GITHUB_FILE_TOO_LARGE：文件超过 1MB，API 不下发内容。

## 异常与回退

工具报错时按错误码分类再决定重试或换路径（详见 plugin-tool-github）。凭据问题检查 `~/.dsh/.env` 里的 `GITHUB_TOKEN`；本插件不负责创建或续期 token（GitHub fine-grained token 最长一年，到期需人工更换）。

## 环境相关

### TLS 中间层：唯一一种「错误信息指向不了原因」的失败

症状：0.1.6 起报 `GITHUB_TLS_UNTRUSTED`，消息里带被重签的 host 与底层 code；0.1.5 及以前只会报
`github request failed: TypeError: fetch failed` —— 真正的原因在 undici 包了两层的 `cause.cause.code`
里，而那句 `String(cause)` 恰好把它丢掉。

成因：本机有东西在中间重签 HTTPS —— 公司代理、杀软 HTTPS 扫描，或**本地 GitHub 加速器**
（Watt Toolkit / FastGithub 这类：改 hosts 把 `api.github.com` 指向 `127.0.0.1`，再在本地 443
完成 TLS 握手、用自己的根证书签名）。**Node 与 Electron 只信内置 CA 清单，不读 Windows 证书库**，
所以同一台机器上浏览器和 `curl` 一切正常，只有本插件挂在证书校验上。

判定：浏览器能开 GitHub、`curl https://api.github.com` 有响应，而插件失败 —— 基本就是它。
（别拿 `curl` 的失败下结论：它的解析与信任路径跟 Node 不同，本机就出现过 curl 报 000、
而 `tls.connect` 直连真实 IP + 正确 SNI 拿到的是 GitHub 真证书。）

两条出路，任选其一：

1. **让运行时信任那个根 CA**（保留加速器）。把根证书导出成 PEM，再由**启动环境**导出
   `NODE_EXTRA_CA_CERTS=<pem 路径>`，或用 `NODE_OPTIONS=--use-system-ca`（Node ≥ 22.15 / 现代 Electron）。
   ⚠️ **这两个变量只能来自启动环境**（Windows 用户环境变量、启动脚本、watchdog 那条链）。
   **绝对不要写进 `~/.dsh/.env`**：`.env` 层禁止启动期变量，`dsh-app-boot` 的 `readEnvLayer`
   会直接 fatal —— app 停在启动阶段、界面只弹「could not start」，日志里留一条 crash-host.log
   （2026-10-15 真踩过）。同理 `reg add HKCU\Environment` 在受限令牌下可能被拒。
2. **让插件的请求绕开中间人**（不依赖加速器证书）。把 `baseUrl` 指到一个你自己控制的端点
   （本地中转 / 反向代理），由它去访问真正的 `api.github.com`。注意插件用
   `new URL(path, baseUrl)` 拼地址而 `path` 是 `/repos/...` 这种绝对路径 —— `baseUrl` 只能是
   **没有路径前缀的**主机地址；填 `https://gh-proxy.com/https://api.github.com` 这类带前缀的反代
   会被整段替换，前缀直接丢失。

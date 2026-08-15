---
name: plugin-web-github
description: Use when configuring or diagnosing the ctx.github host service behind the github tools — provider selection, the GITHUB_TOKEN credential, rate limits, the TLS interception caveat, and the full GithubError code table.
---

# GitHub 宿主服务与故障排查（plugin-web-github）

插件版本：0.1.0-rc.5。关联插件：plugin-tool-github（模型侧工具用法，正常使用时先看它）。

## 功能概述

本插件是宿主侧服务 ctx.github 与 REST 提供方 github-api：负责仓库/issue 搜索、仓库与 issue 详情、文件 base64 解码、HTTP 状态映射与超时。它不是模型工具，不能直接调用；模型通过 plugin-tool-github 的两个工具间接使用它。

## 适用场景

该用：排查工具报错原因、理解错误码、配置 token 或端点。
不该用：当成可调用工具；用于写操作（本服务只实现读取）。
易误用：把匿名 60 次/小时的速率限制当成故障；在 TLS 中间层环境下不带 --use-system-ca 重启服务器。

## 关键行为

- 默认匿名访问，每 IP 每小时 60 次请求；配置 token 后提升到 5000 次并解锁代码搜索。
- token 解析顺序：字面量 token 配置，然后凭据 seam，然后启动环境变量 GITHUB_TOKEN（以 Bearer 头发送）。
- 所有请求拒绝重定向；token 只发给配置的 API 主机。
- 超过 1MB 的文件不下发内容，报 GITHUB_FILE_TOO_LARGE；1MB 以内的文件由工具层在 200000 字符处截断（见 plugin-tool-github 的 truncated 说明）。两层边界独立生效。

## 配置键（部署层）

provider（默认取环境变量 DSH_GITHUB_PROVIDER）、baseUrl（默认 api.github.com）、token（字面量，secret）、tokenEnv（默认 GITHUB_TOKEN）、userAgent（默认 dsh-web-github）、requestTimeoutMs（默认 30000）。

## 错误码表

- GITHUB_UNAUTHORIZED：401，需要 token（典型是代码搜索）。
- GITHUB_FORBIDDEN：403，速率限制或权限不足。
- GITHUB_NOT_FOUND：404，资源不存在。
- GITHUB_API_ERROR：422 搜索语法非法，或其他非 2xx。
- GITHUB_BAD_RESPONSE：非 JSON 响应。
- GITHUB_REDIRECT_REFUSED：出现重定向，凭据安全保护生效。
- GITHUB_REQUEST_FAILED：网络失败；若该机器存在 TLS 中间层，服务端需以 NODE_OPTIONS=--use-system-ca 运行。
- GITHUB_FILE_TOO_LARGE：文件超过 1MB。
- GITHUB_PROVIDER_*：提供方选择错误，属部署配置问题。

## 异常与回退

工具报错时按错误码分类再决定重试或换路径（详见 plugin-tool-github）。凭据问题检查部署端 DSH_HOME 下 .env 文件的 GITHUB_TOKEN；本插件不负责创建或续期 token（GitHub fine-grained token 最长一年，到期需人工更换）。

---
name: plugin-tool-github
description: Use before calling github_search or github_get — find GitHub repositories and issues, read repo metadata, issue bodies, and file content; covers argument formats, search syntax, error codes, and fallbacks.
---

# GitHub 工具套件使用指南（plugin-tool-github）

插件版本：0.1.0-rc.5。关联插件：plugin-web-github（宿主服务与凭据背景）、plugin-tool-bilibili（B 站侧对应工具，可联合做跨源信息核实）。

## 功能概述

本插件提供两个工具：github_search 搜 GitHub 仓库与 issue（支持 GitHub 原生搜索语法）；github_get 按 kind 读取一个仓库元数据、一个 issue 或拉取请求的正文、或一个文件的解码文本。不能做：创建 issue、评论、提交代码等任何写操作；不能搜代码内容（该接口需要 token，无 token 时报错）。

## 适用场景

该用：调研开源生态（有没有人做过 X）、找实现参考、读某个仓库的 README 或源码文件、读 issue 讨论了解项目痛点。
不该用：通用网页搜索请用 web_search；写操作；下载大文件。
易误用：把 owner/repo 写反或带空格；kind 与参数不匹配（如 kind=issue 却不给 number）；对超过 1MB 的文件用 github_get。

## 调用时机

需要「找」时先 github_search，锁定仓库或 issue 后按需 github_get 读详情或文件。已有精确坐标（owner/repo/path）时直接 github_get。

## 参数详解

github_search：
- query：必填，字符串。支持 GitHub 搜索语法，例如 repo:vercel/next.js is:issue、agent harness language:typescript、stars:>1000。
- kind：可选，repositories（默认）或 issues（含拉取请求）。
- page：可选，正整数，默认 1。
- perPage：可选，正整数，1 到 30，默认 10。超过 30 会报错。
返回：totalCount、hasMore、items 数组，每项含 kind、htmlUrl、title（仓库为全名、issue 为标题）、description、author、state（issue 为 open/closed，仓库为空串）、stars（仅仓库）、comments（仅 issue）、createdAt。

github_get：
- kind：必填，只能是 repo、issue、file。
- owner：必填，仓库所有者名，只允许字母数字、点、横线、下划线。
- repo：必填，仓库名，规则同上。
- number：kind=issue 时必填，正整数。
- path：kind=file 时必填，文件路径，如 README.md、src/index.ts。
- ref：可选，分支或标签名，默认走默认分支。
返回：按 kind 不同——repo 返回 fullName、stars、forks、openIssues、language、license、topics、defaultBranch、archived、createdAt、pushedAt、description；issue 返回 number、title、body、state、author、labels、comments、pullRequest、createdAt、updatedAt；file 返回 path、size、content、truncated。文件内容的两层边界：工具层在超过 200000 字符时截断并置 truncated=true；提供方层对超过 1MB 的文件直接报 GITHUB_FILE_TOO_LARGE 且不下发任何内容（此时根本到不了截断步骤）。

## 最小调用示例

调研「有没有人做过 agent harness」：github_search，query 传 agent harness language:typescript，kind 传 repositories。
读仓库详情：github_get，kind 传 repo，owner 传 vercel，repo 传 next.js。
读 issue 正文：github_get，kind 传 issue，owner 传 vercel，repo 传 next.js，number 传 86184。
读文件：github_get，kind 传 file，owner 传 open-webui，repo 传 open-webui，path 传 README.md。
引用时用返回的 htmlUrl 字段。

## 常见错误与规避

- GITHUB_UNAUTHORIZED：该数据需要 token（典型是代码搜索）；换用仓库/issue 搜索或明确告知需要 token。
- GITHUB_FORBIDDEN：速率限制（匿名每 IP 每小时 60 次）或权限不足；减少调用次数、合并查询。
- GITHUB_NOT_FOUND：仓库、issue 或路径不存在；核对 owner/repo 拼写与默认分支。
- GITHUB_FILE_TOO_LARGE：文件超过 1MB，API 不下发内容；改读更小的文件或子路径。
- GITHUB_API_ERROR 带 422：搜索语法不合法；简化 query。
- 搜索结果少时换更宽泛的关键词，或去掉 stars: 这类过滤条件。
- 带引号或超长短语的精确查询经常返回 0 结果——这是搜索语法特性，不是工具故障；拆成 2 到 3 个宽泛关键词重试即可。

## 异常与回退

- 网络失败（GITHUB_REQUEST_FAILED）：重试一次；仍失败则提示稍后。若该环境存在 TLS 中间层，服务端需以 NODE_OPTIONS=--use-system-ca 运行——这类错误不是本工具能修的，直接告知用户环境问题。
- 匿名速率耗尽：优先用搜索结果里的 snippet 与 htmlUrl 引用，把 github_get 留给最关键的目标。
- 拿不到正文：引用 htmlUrl 让用户自查，不编造仓库内容。

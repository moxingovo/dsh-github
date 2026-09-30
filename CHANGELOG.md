# Changelog

本文件是发布正文的唯一来源:CI 按 tag 名(`v<version>`)抓 `## <version>` 这一节作为
GitHub Release 正文。因此**顶部那一节的标题必须正好等于 `package.json` 的 version**
(例如 `## 0.1.4`),并且这一节要自带完整叙述 —— 正文会一直取到下一个 `## ` 为止。

## 0.1.5

(2026-09-30) 在 **DeepSeek Harness 0.2.0-rc.2** 上验证通过 —— 也就是**官方桌面端内置的那个
运行时**(macOS/Windows 桌面端自带 dsh 运行时与插件管理,不再需要另装 Node 或 pnpm)。
**运行时代码零改动**;本版只是把 `devDependencies` 指向 `@deepseek-ai/*@0.2.0-rc.2`,让
`npm run typecheck` 从此就是对桌面端运行时的真实兼容性验证。

### 为什么可以断定兼容

逐个包比对过 0.1.7-rc.2 与 0.2.0-rc.2 的源码,本插件用到的接口一处没变:
`@deepseek-ai/dsh-tools`(defineTool、`ctx.tools.register`)、`@deepseek-ai/dsh-system-prompt`
(`section`)零改动。本插件的两个工具都是纯读取型、不注入上下文,因此也避开了 0.2.0
在会话/消息投影方向上的所有改动。

### 验证

- `npm run typecheck`:针对 `@deepseek-ai/*@0.2.0-rc.2` 通过。
- `npm test`:7 项全过(HTTP 全部 mock,离线可跑)。
- `npm run build`:产物随本提交更新。
- 依赖面:`dsh-tools@0.2.0-rc.2` 要求 `@deepseek-ai/cordis ~4.0.4`,本插件声明
  `>=4.0.0` 且 devDeps 用 `4.0.4`,满足。

### 桌面端注意事项

桌面端用**同一套 profile 机制**(`~/.dsh`)加载外部插件,因此本插件照常出现在它的插件管理里;
它默认监听 **19387** 而不是 Web 的 3080,但本插件不碰宿主端口,无需配置。

## 0.1.4

(2026-09-28) 在 **DeepSeek Harness 0.1.7-rc.2** 上完成验证:**运行时代码无需任何改动**。
本插件只使用 `defineTool`、`ctx.tools.register` 与 `ctx.systemPrompt.section`,0.1.7 对这三个
接口只有增量改动(新增可选的 `projectContent` / `deferLoading` / `displayReason`);
`typecheck`、`build` 与 7 项测试全过,`github_search` 与 `github_get` 已在 0.1.7-rc.2 上实测。

### 兼容性
- `devDependencies` 指向 `@deepseek-ai/*@0.1.7-rc.2`:因此 `npm run typecheck` 本身就是对
  0.1.7 的真实兼容性验证。`peerDependencies` 保持 `>=0.0.1-rc.1` 之类的下界不变 ——
  本插件在 0.1.0–0.1.7 各线上都能用。
- 0.1.7 的破坏性改动集中在别处(消息来源 kind、`tool-result` 块与 `tool` 角色、工具结果内容
  投影),本插件的两个工具都是纯读取型、不注入上下文,因此不受影响。

### 实测(0.1.7-rc.2)
- `github_search`(repositories / issues 两种 kind)与 `github_get`(repo / file;
  issue 走同一路径)实测可用。
- 匿名速率上限与 token 加成不变(每 IP 每小时 60 → 5000 次);token 从 `GITHUB_TOKEN`
  环境变量读取(通常写在 `$DSH_HOME/.env`,由 launcher 注入进程环境)。

### 文档与技能
- README(中英)按 DSH Sidebar 同一套门面重构:顶部语言互链与 Changelog/Releases 入口、
  兼容性提示与免责声明、安装/配置/工具与错误码/技能/安全/开发分节、版本对照表。
- 两个 `SKILL.md` 按**独立插件**的真实架构重写。原先它们描述的是内置包时代的宿主服务
  (`ctx.github`、provider 选择键、credentials seam、`GITHUB_PROVIDER_*` 错误码)——
  这些随内置包一起移除了,照旧文档排查会得出错误结论。现在:提供方 `GithubApiProvider`
  随插件加载、不发布服务;凭据只有「字面量 `token` → `process.env[tokenEnv]`」两步;
  配置键以插件 Config schema 为准;错误码表按源码逐个核对,并补上 1MB 文件边界与
  fake-IP/TUN 代理下「curl 失败但 Node fetch 正常」的判断提醒。
- 新增 `RELEASE.md`(发布指南)与 `.github/workflows/release.yml`(tag 驱动的发布流程)。

### 测试
- `npm test`:7 项全过(HTTP 全部 mock,离线可跑)。
- `npm run typecheck`:针对 `@deepseek-ai/*@0.1.7-rc.2` 通过。
- `npm run build`:产物(`lib/`、`dist/`)已随本次提交更新。

## 0.1.3

(2026-09-22) 在 DeepSeek Harness 0.1.6-alpha.2(Typert API Gateway)上验证:无需改代码
(本插件不使用 typert codec API)。随后修复 `package.json` 带 BOM 导致 harness 解析插件清单
JSON 失败的问题。

## 0.1.2

(2026-09-20) 两处取回修复:
- **文件路径逐段 URL 编码**:含空格、中文、`#`、`?` 的文件名不再请求失败。
- **ref 感知的 `htmlUrl`**:指定 `ref` 时返回的链接指向该分支/标签版本,而不是固定的 HEAD。

## 0.1.1

(2026-09-16) 包名改为 `dsh-plugin-github`;修复 README 编码;加入 CI(install / test /
typecheck / build,Node 22)。

## 0.1.0

(2026-09-15) 首个版本:`github_search`(仓库与 issue/PR 搜索,GitHub 原生搜索语法)与
`github_get`(仓库元数据、issue/PR 正文、文件解码内容)两个工具,REST 提供方、
拒绝重定向、可选只读 token。

# 发布指南 / Release Guide

把 dsh-plugin-github 发布到 GitHub（带 npm 打包产物）的全流程。

**现在的发布是 tag 驱动的**：本地打 tag → push → CI 自动跑验证、打包、建 Release。
手工产物不再需要上传，第 3 节末尾留给 CI 不可用时的兜底。

## 0. 发布前自查（每次都要过一遍）

- 只提交 **dsh-github 这个文件夹** 里的内容。git 仓库必须建在 `dsh-github` 内，不能建在上一级
  `dsh-plugin-publish` 目录 —— 上一级还有另一个插件的仓库。
- `node_modules/` 在 `.gitignore` 里，别用 `git add -f` 把它带上去。
- ⚠️ **`package.json` 不能带 BOM**：harness 解析插件清单时按 UTF-8 读取该文件，带 BOM 会让整个
  插件挂载失败（0.1.3 之后专门修过）。编辑后可用
  `node -e "const b=require('fs').readFileSync('package.json');console.log(b[0],b[1],b[2])"`
  确认头三字节不是 `239 187 191`。
- `~/.dsh` 下的 GITHUB_TOKEN 与 API key 永远不会进入本项目。
- 提交前 `git status` 干净、`git log` 上没有误提交的凭据或机器路径。

## 1. 改版本号与 CHANGELOG（顺序不能颠倒）

1. 改 `package.json` 的 `version`。**这是版本号唯一的权威来源**：README 的安装示例、
   CHANGELOG 的标题、git tag、Release 名都跟它走。
2. 在 `CHANGELOG.md` **顶部**加一节，标题必须正好是 `## <version>`（例如 `## 0.1.5`）。
   CI 用 `awk` 从 CHANGELOG 抓这一节当 Release 正文：
   - 抓不到 → CI 报 `No CHANGELOG section found for <version>` 并失败；
   - 正文从下一个 `^## ` 开始截断，所以这一节要自带完整叙述（兼容性 / 实测 / 文档 / 测试分段是惯例）。
3. 顺带核对 README（中英）里的数字：测试条数、工具条数、错误码表条目都要跟着源码走。

## 2. 本地验证

```powershell
cd C:\Users\20906\dsh-plugin-publish\dsh-github

npm ci --registry=https://registry.npmjs.org/   # 与 CI 一样的干净安装
npm test                                        # 7 项，离线（HTTP 全部 mock）
npm run typecheck                               # 对着 @deepseek-ai/* 的类型验证兼容性
npm run build                                   # 产物进 lib/ 与 dist/，随提交一起走
```

> `typecheck` 就是「这条 harness 线能不能用」的本地答案：`devDependencies` 指向哪个
> `@deepseek-ai/*` 版本，验的就是哪一条线。本插件在 0.1.6 与 0.1.7 上都不需要改代码，
> 升级时通常只需把这三个 devDependencies 跟着抬上去再跑一遍。

## 3. 打 tag 并推送（CI 自动发布）

```powershell
cd C:\Users\20906\dsh-plugin-publish\dsh-github
git add .
git commit -m "release: v0.1.5 — <一句话说明>"
git tag v0.1.5
git push && git push --tags
```

push 时会弹浏览器让你登录 GitHub（Git Credential Manager，Git for Windows 自带）；
若弹窗失败：github.com → Settings → Developer settings → Personal access tokens (classic)
→ 生成一个勾选 `repo` 的 token，登录时用户名填 moxingovo、密码粘贴 token。

推上去之后 `.github/workflows/release.yml` 会依次做：

1. `npm ci --registry=https://registry.npmjs.org/`；
2. `npm test`（7 项）；
3. `npm run typecheck`（对着 `@deepseek-ai/*` 的类型）；
4. `npm run build`；
5. `npm pack` 出 `.tgz` 并上传 artifact；
6. 从 CHANGELOG 抓 `<tag 去掉 v>` 那一节当正文，先删同 tag 的旧 Release（重发安全），
   再用 `softprops/action-gh-release` 建/更新 Release 并挂上 `.tgz`。

只看进度、不发布：仓库页 **Actions → Release → Run workflow**
（`workflow_dispatch`，只出 artifact，不建 Release）。

### 兜底：CI 不可用或要手工发

```powershell
npm pack                       # 产出 dsh-plugin-github-<version>.tgz
```

然后在仓库页 **Releases → Draft a new release** → 选/建 tag `v<version>` → 贴 CHANGELOG 那一节
→ 把 `.tgz` 拖进附件区 → **Publish release**。tag 名必须是 `v<version>`，否则用户按版本号找不到包。

发到 npm（可选）：

```powershell
npm publish --access public --registry=https://registry.npmjs.org/
```

## 4. 仓库首页与上架

**About**（仓库页右侧齿轮改，上限 350 字符）：建议

> Unofficial DeepSeek Harness plugin: GitHub repository/issue search plus repo, issue and file
> reading tools (github_search / github_get). Anonymous by default, optional read-only token.
> 非官方社区插件。

**Topics**：`ai-agent` `deepseek` `deepseek-harness` `dsh-plugin` `github` `github-api` `llm-tools`
（`dsh-plugin` 会被官方生态收录）。

## 5. 版本线备忘

- `0.1.0`–`0.1.1`：两个工具与 REST 提供方。
- `0.1.2`：文件路径逐段编码 + ref 感知的 `htmlUrl`。
- `0.1.3`：DSH 0.1.6-alpha.2 验证（无需改代码）+ `package.json` BOM 修复。
- `0.1.4`：DSH 0.1.7-rc.2 验证（运行时代码零改动）；skills 与 README 按独立插件架构重写。
- 两个工具的参数/返回结构是对模型与用户的契约，改动时 `skills/plugin-tool-github/SKILL.md`、
  README（中英）与 `tests/` 要同改。

# SkillsBox

<p align="center">
  <img src="src/assets/logo.png" alt="SkillsBox" width="96" height="96" />
</p>

<p align="center">
  <strong>本地 Agent Skill 管理器</strong><br />
  集中存放 · 按项目启用 · 常用一键挂载
</p>

<p align="center">
  <a href="https://github.com/xiaozuoyou/SkillsBox/stargazers"><img src="https://img.shields.io/github/stars/xiaozuoyou/SkillsBox?style=flat&logo=github" alt="Stars" /></a>
  <a href="https://github.com/xiaozuoyou/SkillsBox/issues"><img src="https://img.shields.io/github/issues/xiaozuoyou/SkillsBox" alt="Issues" /></a>
  <a href="https://github.com/xiaozuoyou/SkillsBox/network/members"><img src="https://img.shields.io/github/forks/xiaozuoyou/SkillsBox?style=flat" alt="Forks" /></a>
  <a href="https://github.com/xiaozuoyou/SkillsBox"><img src="https://img.shields.io/badge/platform-macOS-black?logo=apple" alt="Platform" /></a>
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri 2" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-backend-DEA584?logo=rust&logoColor=black" alt="Rust" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <img src="https://img.shields.io/badge/version-0.1.0-informational" alt="Version" />
</p>

---

## 这是什么

**SkillsBox** 是一款桌面应用，用来管理 Agent Skills（带 `SKILL.md` 的指令包）。

Agent 工具常把 skill 装进 `~/.agents`、`~/.grok` 等**全局目录**：项目之间互相干扰，难备份、难复用，换机器更麻烦。

SkillsBox 把职责拆成两层：

| | 放哪里 | 做什么 |
|--|--------|--------|
| **本机库** | 默认 `~/.skillsbox/`（可改） | 创建、导入、浏览、收藏、禁用 |
| **项目启用** | `<项目>/.agents/skills/<name>` | 软链接或复制，只影响当前仓库 |

同一 skill 可给多个项目用；新开仓库也能一键挂上「常用」列表。默认启用到 **`.agents/skills`**，方便 Grok 等会扫描项目 skill 的工具优先加载。

```text
本机库  ~/.skillsbox/skills/*
              │
              │  启用（symlink / copy）
              ▼
项目侧  YourProject/.agents/skills/my-skill
```

---

## 功能

| 能力 | 说明 |
|------|------|
| **库浏览** | 按来源仓库分组、搜索；侧栏 **全部 / 常用 / 禁用** |
| **常用** | 星标收藏；**一键把常用 skill 启用到新项目** |
| **创建** | 本地新建 skill（生成 `SKILL.md`） |
| **导入** | Git 仓库（默认）或本地文件夹；重名自动跳过 |
| **启用 / 卸载** | 软链接（推荐）或复制到项目；可从项目移除 |
| **禁用 / 删除** | 从库中禁用或删除；支持按仓库批量删除 |
| **设置** | 外观、语言（多语言架构，当前：简体中文 / English / 跟随系统）、数据存放位置、关于 |
| **应用更新** | 通过 [GitHub Releases](https://github.com/xiaozuoyou/SkillsBox/releases) 检测 / 下载安装（当前 macOS；见 [docs/UPDATES.md](docs/UPDATES.md)） |

**刻意不做**：不写全局 `~/.agents` / `~/.grok`；无技能商店；无 CLI。

---

## 快速上手

### 环境

- [Rust](https://www.rust-lang.org/) + [Tauri 2 前置依赖](https://v2.tauri.app/start/prerequisites/)
- Node 18+、[pnpm](https://pnpm.io/)
- 用 Git 导入时，本机需可用的 `git`

### 开发与打包

```bash
pnpm install
pnpm tauri dev     # 桌面应用（推荐）
# pnpm dev         # 仅前端，无文件系统 / 对话框能力

pnpm tauri build   # 打包
```

macOS 产物示例：

```text
src-tauri/target/release/bundle/macos/SkillsBox.app
```

### 发布与应用内更新

打版本 tag 后，GitHub Actions 会构建 macOS（Apple Silicon）并发布到
[Releases](https://github.com/xiaozuoyou/SkillsBox/releases)，同时生成 updater 用的 `latest.json`。

维护者需配置 Secret `TAURI_SIGNING_PRIVATE_KEY`（步骤见 [docs/UPDATES.md](docs/UPDATES.md)）。

用户：设置 → 关于 → **检查更新** → 有新版本可下载安装并重启。

### 推荐用法

1. **导入或创建** skill，集中放在本机数据目录  
2. 给常用的点 **星标**  
3. 新项目 → 侧栏 **常用** → **「常用启用到项目…」** → 选仓库根目录  
4. 在该项目里打开兼容的 Agent，即可读到 `.agents/skills` 下的 skill  

单个 skill 也可在详情里 **启用到项目…**。

启用后大致结构：

```text
YourProject/
  .agents/
    skills/
      my-skill  →  ~/.skillsbox/skills/my-skill   # 软链接
```

| 模式 | 适合 | 注意 |
|------|------|------|
| **软链接** | 日常开发 | 本机库更新，项目侧立刻生效 |
| **复制** | 要把 skill 提交进 Git | 之后本机库变更不会自动同步到项目 |

---

## 数据目录

默认：`~/.skillsbox/`（**设置 → 通用 → 数据存放位置** 可改）

```text
~/.skillsbox/
  registry.json       # 索引 +「启用到哪些项目」记录
  skills/
    <name>/
      SKILL.md
```

切换路径**不会自动搬家**；新位置若为空会重新初始化。早期路径（`~/.SkillsBox` 或 Application Support 下的旧目录）在默认位置为空时会尝试自动迁移。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | [Tauri 2](https://v2.tauri.app/) |
| 后端 | Rust（文件、symlink、git clone、系统对话框） |
| 前端 | Vite 6 · React 19 · TypeScript |
| 包管理 | pnpm |

```text
src/              前端
src/i18n/         多语言（registry + locales/*，见 src/i18n/README.md）
src-tauri/        Rust / Tauri
```

开发时前端：`http://localhost:1420`

---

## 贡献与反馈

开源仓库：<https://github.com/xiaozuoyou/SkillsBox>

欢迎 Issue / PR。使用上优先反馈：导入失败、启用路径、多项目场景等问题。

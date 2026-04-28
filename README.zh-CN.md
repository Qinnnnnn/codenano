# codenano · v0.3.1

[![npm version](https://img.shields.io/npm/v/codenano.svg)](https://www.npmjs.com/package/codenano)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-374%20passing-brightgreen.svg)](https://github.com/Adamlixi/codenano)

**轻量级 AI 编码代理 SDK，受 Claude Code 架构启发。**

从 Claude Code 生产代理引擎中提取的经过实战检验的代码模式。约 8,000 行专注代码，零膨胀。开源、完全可定制、生产就绪。

> 💡 **受 Claude Code 启发** — 与驱动 Anthropic 官方编码助手的相同实战检验代理循环架构，现作为独立 SDK 提供。

## 为什么选择 codenano？

### 🚀 **轻量且专注**
- **约 8,000 行**纯粹、专注的代码
- 零膨胀，零开销
- **Claude Code 的代理引擎**

### ⚡ **快速构建 AI 编码代理**
```bash
npm install codenano
```
60 秒内构建你自己的 AI 编码代理。无需 IDE。无限制。

### 🎯 **经过实战检验的架构**
生产级代理模式。经过大规模验证，为开发者优化。

---

## 快速开始

**3 行代码运行你的第一个代理：**

```typescript
import { createAgent, coreTools } from 'codenano'

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),  // Read, Edit, Write, Glob, Grep, Bash
})

const result = await agent.ask('读取 package.json 并总结它')
console.log(result.text)
```

**就这样。**无需复杂设置。无需配置地狱。只有纯粹的生产力。

### 流式输出？内置。

```typescript
for await (const event of agent.stream('这里有什么文件？')) {
  if (event.type === 'text') process.stdout.write(event.text)
}
```

### 多轮对话？简单。

```typescript
const session = agent.session()
await session.send('读取 main.ts')
await session.send('现在解释它做什么')
```

### 会话持久化？内置。

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),
  persistence: { enabled: true },  // 保存到 ~/.agent-core/sessions/
})

const session = agent.session()
console.log(session.id)  // 保存这个 UUID
await session.send('分析代码库')

// 之后 — 从中断处恢复
const resumed = agent.session(session.id)
await resumed.send('我们发现了什么？')
```

### 跨会话记忆？自动。

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: {
    autoLoad: true,           // 将保存的记忆注入系统提示词
    extractStrategy: 'auto',  // 每轮对话后提取记忆
  },
})

// 代理从对话中学习并跨会话记住：
// - 用户偏好和角色
// - 方法反馈（避免什么/重复什么）
// - 项目上下文和决策
// - 外部系统指针
```

记忆以带 frontmatter 的 markdown 文件形式存储，由 `MEMORY.md` 索引。可通过独立 API 直接访问：

```typescript
import { saveMemory, scanMemories, loadMemoryIndex } from 'codenano'

saveMemory({
  name: 'user_role',
  description: '用户是后端工程师',
  type: 'user',
  content: '精通 Go 和 Python，React 新手',
}, '/path/to/memory')

const memories = scanMemories('/path/to/memory')
```

### 存储路径

记忆和会话持久化都有合理的默认值并支持自定义路径。目录不存在时会自动创建。

| 功能 | 默认路径 | 自定义配置 |
|---------|-------------|---------------|
| **记忆** | `~/.agent-core/memory/<cwd-hash>/` | `memory.memoryDir` |
| **会话** | `~/.agent-core/sessions/` | `persistence.storageDir` |

```typescript
// 使用默认值 — 零配置
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: { autoLoad: true, extractStrategy: 'auto' },
  persistence: { enabled: true },
})

// 或指定自定义路径
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: { memoryDir: './my-project/memory', autoLoad: true },
  persistence: { enabled: true, storageDir: './my-project/sessions' },
})
```

### 成本追踪？自动。

每个 `Result` 都包含 `costUSD` — 基于模型定价的估算 API 成本。

```typescript
const result = await agent.ask('解释这段代码')
console.log(`成本: $${result.costUSD.toFixed(4)}`)  // 例如 $0.0047
```

使用独立 API 进行预算管理：

```typescript
import { CostTracker, calculateCostUSD } from 'codenano'

const tracker = new CostTracker()
tracker.add('claude-sonnet-4-6', result.usage)
console.log(`总计: $${tracker.summary.totalUSD.toFixed(4)}`)
```

### Git 集成？内置。

自动检测 git 仓库状态以注入系统提示词：

```typescript
import { getGitState, buildGitPromptSection } from 'codenano'

const state = getGitState()
// { isGit: true, branch: 'main', commitHash: 'abc123...', isClean: false, ... }

const section = buildGitPromptSection(state)
// "- Is a git repository: true\n- Current branch: main\n..."
```

### 生命周期钩子？8 个。

在每个生命周期点观察和控制代理行为：

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),

  onTurnStart: ({ turnNumber }) => console.log(`回合 ${turnNumber}`),

  // 阻止危险工具
  onPreToolUse: ({ toolName, toolInput }) => {
    if (toolName === 'Bash' && toolInput.command?.includes('rm -rf'))
      return { block: '破坏性命令已被阻止' }
  },

  onPostToolUse: ({ toolName, output }) => console.log(`${toolName}: ${output.slice(0, 50)}`),
  onCompact: ({ messagesBefore, messagesAfter }) => console.log(`压缩: ${messagesBefore} → ${messagesAfter}`),
  onError: ({ error }) => console.error(error.message),
  onMaxTurns: () => console.warn('达到最大回合数'),
})
```

所有钩子都是尽力执行 — 钩子中的错误不会导致代理崩溃。

### 会话中止？安全可靠。

处理用户主动中止而不产生状态损坏：

```typescript
const session = agent.session()
for await (const event of session.stream('分析代码库')) {
  if (event.type === 'aborted') {
    console.log('用户中止，会话仍可使用')
    await session.send('从中断处继续')
  }
}
```

中止时会触发消息修复 — 取消未完成的 tool_use 结果，确保消息历史完整性，支持后续查询。

### 子代理生成？一个函数。

```typescript
import { createAgent, createAgentTool, coreTools } from 'codenano'

const config = { model: 'claude-sonnet-4-6', tools: coreTools() }
const agentTool = createAgentTool(config)

const agent = createAgent({
  ...config,
  tools: [...coreTools(), agentTool],  // 模型现在可以生成子代理
})
```

### 沙箱工具？隔离执行。

为不受信任代码提供路径隔离的工具：

```typescript
import { sandboxTools, createAgent } from 'codenano'

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: sandboxTools(),  // 带路径限制的 File/Bash 工具
})
```

沙箱工具将文件访问和命令执行限制在可配置的根目录内，防止意外或恶意访问沙箱外的资源。

### 上下文分析？就绪。

分析对话上下文以识别压缩机会：

```typescript
import { analyzeContext, classifyTool } from 'codenano'

const analysis = analyzeContext(session.history)
// { toolCalls: 5, duplicateFileReads: { '/a.ts': 3 }, collapsibleResults: 4, ... }

classifyTool('Grep')   // 'search'
classifyTool('Bash')   // 'execute'
```

### 技能？从磁盘加载。

技能是带 YAML frontmatter 的 Markdown 文件：

```typescript
import { loadSkills, createSkillTool, createAgent } from 'codenano'

// 从 .claude/skills/ 目录加载技能
const skills = loadSkills()

// 创建功能性 SkillTool
const skillTool = createSkillTool(skills)

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: [skillTool],  // 模型可以通过 Skill 工具调用技能
})
```

技能文件格式 (`.claude/skills/my-skill/SKILL.md`)：
```markdown
---
name: review-pr
description: Review a pull request
arguments: [pr_number]
context: inline
---
Review PR #$pr_number. Focus on bugs and security.
```

### MCP 协议？支持。

连接任何 MCP 服务器并使用其工具：

```typescript
import { createAgent, connectMCPServers } from 'codenano'

const { tools, connections } = await connectMCPServers([
  { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
])

const agent = createAgent({ model: 'claude-sonnet-4-6', tools })
const result = await agent.ask('列出 open issues')

// 清理
await disconnectAll(connections)
```

### 自定义工具

```typescript
import { defineTool } from 'codenano'
import { z } from 'zod'

const readFile = defineTool({
  name: 'ReadFile',
  description: 'Read a file from disk',
  input: z.object({ path: z.string() }),
  execute: async ({ path }) => fs.readFileSync(path, 'utf-8'),
  isReadOnly: true,
})

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: [readFile],
})
```

---

## codenano vs 其他框架

**轻量级，受 Claude Code 实战检验模式启发。**

| 特性 | codenano | Vercel AI SDK | LangChain |
|---------|----------|---------------|-----------|
| **理念** | 受生产级 AI 编码系统启发 | 通用 AI SDK | 通用代理框架 |
| **代码行数** | ~8,000（专注） | ~15,000+ | 100,000+ |
| **包含内容** | 代理引擎 + 15 个工具 | 多模型 + 流式 | 万物 + 厨房水槽 |
| **设置时间** | < 1 分钟 | < 1 分钟 | 10+ 分钟 |
| **使用场景** | 构建编码代理 | 构建任意 AI 应用 | 构建复杂工作流 |
| **生产强化** | ✅ 完整（压缩、恢复、预算） | ⚠️ 基础 | ⚠️ 基础 |
| **流式工具执行** | ✅ 是 | ❌ 否 | ❌ 否 |
| **开源** | ✅ MIT 许可证 | ✅ Apache 2.0 | ✅ MIT 许可证 |

**何时使用 codenano：**
- 构建 AI 编码工具或代理
- 需要 Claude Code 验证过的可靠性（自动压缩、413 恢复、工具预算）
- 想要轻量级、专注的架构
- 偏好实战检验模式而非实验性功能

---

## 你得到的

### 🛠️ **15 个内置工具**
零配置即可使用：
- **文件操作：** Read、Edit、Write
- **代码搜索：** Glob（模式匹配）、Grep（正则搜索）
- **执行：** Bash 命令
- **高级：** Web 搜索、web 获取、LSP 等

### 🎨 **三种工具预设**
```typescript
coreTools()      // 核心 6 工具
extendedTools()  // 核心 + 5 个额外工具
allTools()       // 全部 15 个工具
```

### 🔧 **生产特性**
- ✅ 自动压缩（处理上下文溢出）
- ✅ 重试与回退（弹性 API 调用）
- ✅ Token 预算（成本控制）
- ✅ 权限系统（安全）
- ✅ 钩子系统（生命周期事件）
- ✅ 流式支持（实时输出）
- ✅ 记忆系统（跨会话持久化）
- ✅ 查询追踪（调试/分析）
- ✅ 会话持久化（基于 JSONL 的保存/恢复）
- ✅ 扩展钩子（8 个生命周期钩子：onTurnStart、onPreToolUse、onPostToolUse、onCompact、onError 等）

---

## 系统结构

**清晰、模块化的架构：**

```
codenano/
  src/
    agent.ts           # 核心代理循环
    session.ts         # 多轮对话
    session-storage.ts # 会话持久化（JSONL）
    hooks.ts           # 生命周期钩子辅助函数
    cost-tracker.ts    # 基于 Token 的成本追踪
    git.ts             # Git 状态检测
    context-analysis.ts # 工具分类和上下文分析
    tools/             # 15 个内置工具 + createAgentTool
    prompt/            # 系统提示词构建器
    memory/            # 持久化记忆系统
    provider.ts        # Anthropic SDK + Bedrock
    compact.ts         # 自动压缩逻辑
  tests/               # 374 个测试
  examples/            # 可直接运行的演示
  docs/                # 全面的指南
```

**374 个测试。100% 生产就绪。**

---

## 文档

| 文档 | 你将学到什么 |
|-----|-------------------|
| [Architecture](docs/architecture.md) | 代理循环、交互模式、流事件 |
| [Tools](docs/tools.md) | 内置工具、自定义工具、权限 |
| [Configuration](docs/configuration.md) | 完整配置参考、CLAUDE.md 支持 |
| [Reliability](docs/reliability.md) | 自动压缩、重试、回退、预算 |
| [Prompt System](docs/prompt-system.md) | 系统提示词架构 |
| [Gap Analysis](docs/gap-analysis.md) | SDK 与 Claude Code 对比 |

---

## 测试

```bash
# 单元测试（374 个测试）
npm test

# 带覆盖率
npx vitest run --coverage

# 集成测试（需要 API key）
ANTHROPIC_API_KEY=sk-xxx npm run test:integration
```

---

## 路线图

**已实现：**
- [x] 记忆系统（跨会话持久化）
- [x] 任务管理工具
- [x] 查询追踪（调试/分析）
- [x] 停止钩子（生命周期回调）
- [x] 工具结果预算
- [x] 会话持久化（JSONL 保存/恢复）
- [x] 扩展钩子（8 个生命周期钩子）
- [x] 成本追踪（基于 token 的 USD 估算）
- [x] Git 集成（状态检测、提示词注入）
- [x] 子代理生成（createAgentTool）
- [x] 上下文折叠（工具分类、上下文分析）
- [x] MCP 协议支持（stdio/SSE/HTTP 传输）
- [x] 会话中止处理（消息修复实现干净中断）
- [x] 沙箱运行时（为不受信任代码提供路径隔离工具）

**路线图完成！**

---

## 为什么选择 codenano？

### 对于初创公司
**更快交付你的 AI 编码产品。**不再与膨胀的框架搏斗。几天内上市，而非几个月。

### 对于企业
**从第一天起就生产就绪。**实战检验的架构、全面的测试、对堆栈的完全控制。

### 对于开发者
**真正好用。**清晰的 API、优秀的文档、零魔法。按你想要的方式构建。

---

## 许可证

MIT 许可证。

---

## 立即开始

```bash
npm install codenano
```

**有问题？**查看[文档](docs/)或提交 issue。

---

*最后更新: 2026-04-28 · [Changelog](CHANGELOG.md)*

**准备构建？**查看[示例](examples/)获取灵感。

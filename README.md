# codenano

[![npm version](https://img.shields.io/npm/v/codenano.svg)](https://www.npmjs.com/package/codenano)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-374%20passing-brightgreen.svg)](https://github.com/Adamlixi/codenano)

**The lightweight AI coding agent SDK extracted from Claude Code.**

Built by extracting Claude Code's production architecture. All the power, none of the bloat. Open source, fully customizable, production-ready.

> 💡 **Based on Claude Code** — The same battle-tested engine that powers Anthropic's official coding assistant, now available as a standalone SDK.

## Why codenano?

### 🚀 **Claude Code's Core, 96% Lighter**
- **~6,500 lines** of pure, focused code
- Claude Code: 150,000+ lines (IDE integration, UI, etc.)
- **Same agent engine, zero overhead**

### ⚡ **What Claude Code Does, You Can Do**
```bash
npm install codenano
```
Build your own Claude Code in 60 seconds. No IDE required. No restrictions.

### 🎯 **Battle-Tested Architecture**
Extracted from Claude Code's production engine. Proven at scale, optimized for developers.

---

## Quick Start

**Get your first agent running in 3 lines:**

```typescript
import { createAgent, coreTools } from 'codenano'

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),  // Read, Edit, Write, Glob, Grep, Bash
})

const result = await agent.ask('Read package.json and summarize it')
console.log(result.text)
```

**That's it.** No complex setup. No configuration hell. Just pure productivity.

### Streaming? Built-in.

```typescript
for await (const event of agent.stream('What files are here?')) {
  if (event.type === 'text') process.stdout.write(event.text)
}
```

### Multi-turn conversations? Easy.

```typescript
const session = agent.session()
await session.send('Read main.ts')
await session.send('Now explain what it does')
```

### Session persistence? Built-in.

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),
  persistence: { enabled: true },  // saves to ~/.agent-core/sessions/
})

const session = agent.session()
console.log(session.id)  // save this UUID
await session.send('Analyze the codebase')

// Later — resume from where you left off
const resumed = agent.session(session.id)
await resumed.send('What did we find?')
```

### Cross-session memory? Automatic.

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: {
    autoLoad: true,           // inject saved memories into system prompt
    extractStrategy: 'auto',  // extract memories after every turn
  },
})

// The agent learns from conversations and remembers across sessions:
// - User preferences and role
// - Feedback on approach (what to avoid/repeat)
// - Project context and decisions
// - Pointers to external systems
```

Memories are stored as markdown files with frontmatter, indexed by `MEMORY.md`. Use the standalone API for direct access:

```typescript
import { saveMemory, scanMemories, loadMemoryIndex } from 'codenano'

saveMemory({
  name: 'user_role',
  description: 'User is a backend engineer',
  type: 'user',
  content: 'Expert in Go and Python, new to React',
}, '/path/to/memory')

const memories = scanMemories('/path/to/memory')
```

### Storage paths

Both memory and session persistence have sensible defaults and support custom paths. Directories are created automatically if they don't exist.

| Feature | Default Path | Custom Config |
|---------|-------------|---------------|
| **Memory** | `~/.agent-core/memory/<cwd-hash>/` | `memory.memoryDir` |
| **Session** | `~/.agent-core/sessions/` | `persistence.storageDir` |

```typescript
// Use defaults — zero config
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: { autoLoad: true, extractStrategy: 'auto' },
  persistence: { enabled: true },
})

// Or specify custom paths
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: { memoryDir: './my-project/memory', autoLoad: true },
  persistence: { enabled: true, storageDir: './my-project/sessions' },
})
```

### Cost tracking? Automatic.

Every `Result` includes `costUSD` — estimated API cost based on model pricing.

```typescript
const result = await agent.ask('Explain this code')
console.log(`Cost: $${result.costUSD.toFixed(4)}`)  // e.g. $0.0047
```

Use the standalone API for budget management:

```typescript
import { CostTracker, calculateCostUSD } from 'codenano'

const tracker = new CostTracker()
tracker.add('claude-sonnet-4-6', result.usage)
console.log(`Total: $${tracker.summary.totalUSD.toFixed(4)}`)
```

### Git integration? Built-in.

Auto-detect git repo state for system prompt injection:

```typescript
import { getGitState, buildGitPromptSection } from 'codenano'

const state = getGitState()
// { isGit: true, branch: 'main', commitHash: 'abc123...', isClean: false, ... }

const section = buildGitPromptSection(state)
// "- Is a git repository: true\n- Current branch: main\n..."
```

### Lifecycle hooks? 8 of them.

Observe and control agent behavior at every lifecycle point:

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),

  onTurnStart: ({ turnNumber }) => console.log(`Turn ${turnNumber}`),

  // Block dangerous tools
  onPreToolUse: ({ toolName, toolInput }) => {
    if (toolName === 'Bash' && toolInput.command?.includes('rm -rf'))
      return { block: 'Destructive commands blocked' }
  },

  onPostToolUse: ({ toolName, output }) => console.log(`${toolName}: ${output.slice(0, 50)}`),
  onCompact: ({ messagesBefore, messagesAfter }) => console.log(`Compacted: ${messagesBefore} → ${messagesAfter}`),
  onError: ({ error }) => console.error(error.message),
  onMaxTurns: () => console.warn('Max turns reached'),
})
```

All hooks are best-effort — errors in hooks never crash the agent.

### Sub-agent spawning? One function.

```typescript
import { createAgent, createAgentTool, coreTools } from 'codenano'

const config = { model: 'claude-sonnet-4-6', tools: coreTools() }
const agentTool = createAgentTool(config)

const agent = createAgent({
  ...config,
  tools: [...coreTools(), agentTool],  // model can now spawn sub-agents
})
```

### Context analysis? Ready.

Analyze conversation context to identify compression opportunities:

```typescript
import { analyzeContext, classifyTool } from 'codenano'

const analysis = analyzeContext(session.history)
// { toolCalls: 5, duplicateFileReads: { '/a.ts': 3 }, collapsibleResults: 4, ... }

classifyTool('Grep')   // 'search'
classifyTool('Bash')   // 'execute'
```

### Skills? Load from disk.

Skills are Markdown files with YAML frontmatter — same format as Claude Code:

```typescript
import { loadSkills, createSkillTool, createAgent } from 'codenano'

// Load skills from .claude/skills/ directories
const skills = loadSkills()

// Create a functional SkillTool
const skillTool = createSkillTool(skills)

const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: [skillTool],  // model can invoke skills via the Skill tool
})
```

Skill file format (`.claude/skills/my-skill/SKILL.md`):
```markdown
---
name: review-pr
description: Review a pull request
arguments: [pr_number]
context: inline
---
Review PR #$pr_number. Focus on bugs and security.
```

### MCP protocol? Supported.

Connect to any MCP server and use its tools:

```typescript
import { createAgent, connectMCPServers } from 'codenano'

const { tools, connections } = await connectMCPServers([
  { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
])

const agent = createAgent({ model: 'claude-sonnet-4-6', tools })
const result = await agent.ask('List open issues')

// Cleanup
await disconnectAll(connections)
```

### Custom Tools

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

## codenano vs Claude Code

**Same engine. Different philosophy.**

| Feature | codenano | Claude Code |
|---------|----------|-------------|
| **Based On** | Claude Code core | Official Anthropic product |
| **Lines of Code** | ~6,500 (core only) | 150,000+ (full app) |
| **What's Included** | Agent engine | Engine + IDE + UI |
| **Setup Time** | < 1 minute | Install IDE extension |
| **Use Case** | Build custom agents | Use as-is in IDE |
| **Customizable** | ✅ Fully open | ⚠️ Closed source |
| **Standalone** | ✅ Yes | ❌ Requires IDE |
| **Production Ready** | ✅ Yes | ✅ Yes |
| **Open Source** | ✅ MIT License | ❌ Proprietary |

**Think of it this way:**
- **Claude Code** = Complete car (engine + body + interior)
- **codenano** = Just the engine (build your own car)

**When to use codenano:**
- Building custom AI coding tools
- Integrating agents into your product
- Need full control over behavior
- Want to understand how it works

**When to use Claude Code:**
- Just want to code with AI assistance
- Prefer official Anthropic support
- Happy with IDE integration

---

## What You Get

### 🛠️ **17 Built-in Tools**
Ready to use, zero configuration:
- **File Operations:** Read, Edit, Write
- **Code Search:** Glob (pattern matching), Grep (regex search)
- **Execution:** Bash commands
- **Advanced:** Web search, web fetch, notebooks, LSP, and more

### 🎨 **Three Tool Presets**
```typescript
coreTools()      // Essential 6 tools
extendedTools()  // Core + 5 more
allTools()       // All 17 tools
```

### 🔧 **Production Features**
- ✅ Auto-compact (handles context overflow)
- ✅ Retry & fallback (resilient API calls)
- ✅ Token budgeting (cost control)
- ✅ Permission system (security)
- ✅ Hook system (lifecycle events)
- ✅ Streaming support (real-time output)
- ✅ Memory system (cross-session persistence)
- ✅ Query tracking (debugging/analytics)
- ✅ Session persistence (JSONL-based save/resume)
- ✅ Extended hooks (8 lifecycle hooks: onTurnStart, onPreToolUse, onPostToolUse, onCompact, onError, etc.)

---

## System Structure

**Clean, modular architecture:**

```
codenano/
  src/
    agent.ts           # Core agent loop
    session.ts         # Multi-turn conversations
    session-storage.ts # Session persistence (JSONL)
    hooks.ts           # Lifecycle hook helpers
    cost-tracker.ts    # Token-based cost tracking
    git.ts             # Git state detection
    context-analysis.ts # Tool classification & context analysis
    tools/             # 17 built-in tools + createAgentTool
    prompt/            # System prompt builder
    memory/            # Persistent memory system
    provider.ts        # Anthropic SDK + Bedrock
    compact.ts         # Auto-compact logic
  tests/               # 374 tests
  examples/            # Ready-to-run demos
  docs/                # Comprehensive guides
```

**374 tests. 100% production-ready.**

---

## Documentation

| Doc | What You'll Learn |
|-----|-------------------|
| [Architecture](docs/architecture.md) | Agent loop, interaction modes, stream events |
| [Tools](docs/tools.md) | Built-in tools, custom tools, permissions |
| [Configuration](docs/configuration.md) | Full config reference, CLAUDE.md support |
| [Reliability](docs/reliability.md) | Auto-compact, retry, fallback, budgeting |
| [Prompt System](docs/prompt-system.md) | System prompt architecture |
| [Gap Analysis](docs/gap-analysis.md) | SDK vs Claude Code comparison |

---

## Testing

```bash
# Unit tests (374 tests)
npm test

# With coverage
npx vitest run --coverage

# Integration tests (requires API key)
ANTHROPIC_API_KEY=sk-xxx npm run test:integration
```

---

## Roadmap

**Implemented:**
- [x] Memory system (cross-session persistence)
- [x] Task management tools
- [x] Query tracking (debugging/analytics)
- [x] Stop hooks (lifecycle callbacks)
- [x] Tool result budgeting
- [x] Session persistence (JSONL save/resume)
- [x] Extended hooks (8 lifecycle hooks)
- [x] Cost tracking (token-based USD estimation)
- [x] Git integration (state detection, prompt injection)
- [x] Sub-agent spawning (createAgentTool)
- [x] Context collapse (tool classification, context analysis)
- [x] MCP protocol support (stdio/SSE/HTTP transports)

**Roadmap complete!**

---

## Why Choose codenano?

### For Startups
**Ship your AI coding product faster.** Stop wrestling with bloated frameworks. Get to market in days, not months.

### For Enterprises
**Production-ready from day one.** Battle-tested architecture, comprehensive testing, full control over your stack.

### For Developers
**Actually enjoyable to use.** Clean APIs, great docs, zero magic. Build what you want, how you want.

---

## License

MIT License.

---

## Get Started Now

```bash
npm install codenano
```

**Questions?** Check the [docs](docs/) or open an issue.

**Ready to build?** See [examples/](examples/) for inspiration.

# Configuration

## Full Reference

```typescript
interface AgentConfig {
  // -- Required ---------------------------------
  model: string                        // e.g. 'claude-sonnet-4-6'

  // -- API --------------------------------------
  apiKey?: string                      // default: ANTHROPIC_API_KEY env var
  baseURL?: string                     // custom API endpoint (proxy)
  provider?: 'anthropic' | 'bedrock'   // default: auto-detected
  awsRegion?: string                   // for Bedrock

  // -- Tools ------------------------------------
  tools?: ToolDef[]                    // available tools
  canUseTool?: PermissionFn            // permission callback
  toolResultBudget?: boolean           // truncate oversized results (default: true)

  // -- Prompt -----------------------------------
  systemPrompt?: string                // custom system prompt
  identity?: string                    // agent identity for prompt builder
  language?: string                    // response language preference
  overrideSystemPrompt?: string        // override everything
  appendSystemPrompt?: string          // append to any prompt
  autoLoadInstructions?: boolean       // load CLAUDE.md files (default: false)

  // -- Behavior ---------------------------------
  maxTurns?: number                    // default: 30
  maxOutputTokens?: number             // default: 16384
  thinkingConfig?: 'adaptive' | 'disabled'
  onTurnEnd?: StopHookFn              // stop hook

  // -- Memory -----------------------------------
  memory?: {
    memoryDir?: string                 // custom memory directory
    autoLoad?: boolean                 // load into system prompt (default: true)
    extractStrategy?: ExtractStrategy  // 'disabled' | 'auto' | { interval: N }
    extractMaxTurns?: number           // extraction agent max turns (default: 3)
    useForkedAgent?: boolean           // forked agent with prompt caching (default: false)
  }

  // -- Session Persistence ----------------------
  persistence?: {
    enabled: boolean                   // enable JSONL persistence (default: false)
    storageDir?: string                // custom storage dir (default: ~/.agent-core/sessions/)
    resumeSessionId?: string           // resume an existing session by ID
  }

  // -- Reliability ------------------------------
  autoCompact?: boolean                // compress on context overflow (default: true)
  fallbackModel?: string               // switch on 3x 529 errors
  maxOutputRecoveryAttempts?: number   // resume on max_tokens (default: 3)
  maxOutputTokensCap?: boolean         // 8K->64K escalation (default: false)
  streamingToolExecution?: boolean     // start tools during stream (default: true)
}
```

## Cost Tracking

Every `Result` now includes `costUSD` — the estimated API cost based on model pricing and token usage.

```typescript
const result = await agent.ask('Explain this code')
console.log(`Cost: $${result.costUSD.toFixed(4)}`)
console.log(`Tokens: ${result.usage.inputTokens + result.usage.outputTokens}`)
```

**Standalone API:**

```typescript
import { CostTracker, calculateCostUSD, getModelPricing } from 'codenano'

// One-off calculation
const cost = calculateCostUSD('claude-sonnet-4-6', {
  inputTokens: 10000, outputTokens: 5000,
  cacheReadInputTokens: 2000, cacheCreationInputTokens: 1000,
})

// Accumulate across calls
const tracker = new CostTracker()
tracker.add('claude-sonnet-4-6', result.usage)
tracker.add('claude-opus-4-6', result2.usage)
console.log(tracker.summary) // { totalUSD, totalTokens, byModel }
```

**Supported models:** claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5-20251001 (and aliases). Unknown models fall back to sonnet pricing.

## Git Integration

Detect git repository state and inject it into the system prompt.

```typescript
import { getGitState, buildGitPromptSection } from 'codenano'

const state = getGitState()
// { isGit, root, branch, commitHash, defaultBranch, remoteUrl, isClean, ... }

const section = buildGitPromptSection(state)
// "- Is a git repository: true\n- Current branch: main\n..."
```

Git root discovery is cached. Handles regular repos, worktrees, and submodules.

## Sub-Agent Spawning

Create functional `AgentTool` instances that spawn child agents:

```typescript
import { createAgent, createAgentTool, coreTools } from 'codenano'

const config = {
  model: 'claude-sonnet-4-6',
  tools: coreTools(),
}

const agentTool = createAgentTool(config)
const agent = createAgent({ ...config, tools: [...coreTools(), agentTool] })

// The model can now spawn sub-agents via the Agent tool
const result = await agent.ask('Read all .ts files and summarize the architecture')
```

Sub-agents inherit the parent's tools and API settings. They run with a scoped system prompt that keeps them focused on the assigned task.

## Context Analysis

Analyze conversation context to identify compression opportunities:

```typescript
import { analyzeContext, classifyTool } from 'codenano'

const analysis = analyzeContext(session.history)
// { totalMessages, toolCalls, toolCallsByName, duplicateFileReads, collapsibleResults, ... }

classifyTool('Grep')  // 'search'
classifyTool('Read')  // 'read'
classifyTool('Bash')  // 'execute'
```

## MCP Protocol

Connect to MCP (Model Context Protocol) servers and use their tools. Supports stdio, SSE, and streamable HTTP transports.

```typescript
import { createAgent, connectMCPServers, disconnectAll } from 'codenano'

// Connect to MCP servers
const { tools, connections } = await connectMCPServers([
  {
    name: 'github',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: 'ghp_...' },
  },
  {
    name: 'slack',
    transport: 'sse',
    url: 'https://mcp.slack.com/sse',
    headers: { Authorization: 'Bearer xoxb-...' },
  },
])

// MCP tools are auto-prefixed: mcp__github__list_issues, mcp__slack__search_messages
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: [...coreTools(), ...tools],  // combine with built-in tools
})

const result = await agent.ask('List open issues and post a summary to #dev')

// Cleanup connections on shutdown
await disconnectAll(connections)
```

**Transport types:**

| Transport | Config | Use Case |
|-----------|--------|----------|
| `stdio` | `command`, `args`, `env` | Local CLI tools (npx, python, etc.) |
| `sse` | `url`, `headers` | Remote servers with SSE |
| `http` | `url`, `headers` | Remote servers with streamable HTTP |

**Standalone API:**

```typescript
import { connectMCPServer, listMCPTools, mcpToolsToToolDefs, callMCPTool } from 'codenano'

// Connect to a single server
const conn = await connectMCPServer({ name: 'fs', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] })

// List available tools
const tools = await listMCPTools(conn)

// Call a tool directly
const result = await callMCPTool(conn, 'read_file', { path: '/tmp/hello.txt' })

// Convert to ToolDefs for use with createAgent
const toolDefs = await mcpToolsToToolDefs(conn)

// Cleanup
await conn.close()
```
```

## Provider Auto-Detection

| Condition | Provider |
|-----------|----------|
| `CLAUDE_CODE_USE_BEDROCK=1` | Bedrock |
| `ANTHROPIC_BEDROCK_BASE_URL` set | Bedrock |
| `AWS_PROFILE` set, no `ANTHROPIC_API_KEY` | Bedrock |
| Otherwise | Anthropic (direct) |

## Prompt Priority Chain

```
overrideSystemPrompt  ->  replaces everything (highest priority)
    | (not set)
systemPrompt          ->  replaces default built prompt
    | (not set)
buildSystemPrompt()   ->  auto-built from sections (default)
    | (always)
appendSystemPrompt    ->  appended at the end (always applied)
    | (if autoLoadInstructions)
CLAUDE.md             ->  project instructions appended
```

## CLAUDE.md Instructions

Auto-load project instructions from the filesystem:

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  autoLoadInstructions: true,  // opt-in
})
```

**Discovery order** (lowest to highest priority):
1. `~/.claude/CLAUDE.md` -- user-level global instructions
2. `~/.claude/rules/*.md` -- user-level rules
3. Walk from root to cwd: `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`
4. Walk from root to cwd: `CLAUDE.local.md` (gitignored, private)

Standalone API:

```typescript
import { loadInstructions, discoverInstructionFiles } from 'codenano'

const instructions = await loadInstructions({ cwd: '/my/project' })
const files = await discoverInstructionFiles({
  loadUserInstructions: true,
  loadProjectInstructions: true,
  loadLocalInstructions: false,
})
```

## Stop Hooks

Intercept the agent before it finishes to add follow-up behavior:

```typescript
const agent = createAgent({
  onTurnEnd: ({ messages, lastResponse }) => {
    if (!lastResponse.includes('DONE'))
      return { continueWith: 'You forgot to mark the task as DONE.' }
    return {}
  },
})
```

## Extended Hooks

Beyond `onTurnEnd`, the SDK provides 7 additional lifecycle hooks inspired by Claude Code's hook system. All hooks are best-effort — errors in hooks never crash the agent loop.

| Hook | When | Can Control? |
|------|------|-------------|
| `onSessionStart` | Session created | No |
| `onTurnStart` | Each turn begins | No |
| `onTurnEnd` | Turn ends without tool use | Yes (continueWith / prevent) |
| `onPreToolUse` | Before each tool executes | Yes (block tool) |
| `onPostToolUse` | After each tool executes | No |
| `onCompact` | Auto-compact summarizes history | No |
| `onError` | Error in agent loop | No |
| `onMaxTurns` | Max turns limit reached | No |

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),

  // Observe every turn
  onTurnStart: ({ turnNumber }) => {
    console.log(`Turn ${turnNumber} starting...`)
  },

  // Block dangerous tools
  onPreToolUse: ({ toolName, toolInput }) => {
    if (toolName === 'Bash' && toolInput.command?.includes('rm -rf')) {
      return { block: 'Destructive commands are not allowed' }
    }
  },

  // Log tool results
  onPostToolUse: ({ toolName, output, isError }) => {
    console.log(`${toolName}: ${isError ? 'ERROR' : 'OK'} — ${output.slice(0, 100)}`)
  },

  // Track compaction
  onCompact: ({ messagesBefore, messagesAfter }) => {
    console.log(`Compacted: ${messagesBefore} → ${messagesAfter} messages`)
  },

  // Handle errors
  onError: ({ error }) => {
    console.error('Agent error:', error.message)
  },

  // Alert on max turns
  onMaxTurns: ({ turnNumber }) => {
    console.warn(`Agent hit max turns limit (${turnNumber})`)
  },
})
```

**PreToolUse blocking:** When `onPreToolUse` returns `{ block: reason }`, the tool is skipped and the model receives an error result: `"Tool blocked: <reason>"`. This mirrors Claude Code's PreToolUse exit code 2 behavior.

Persistent cross-session memory. The agent can save learnings and load them in future sessions.

**Default path:** `~/.agent-core/memory/<cwd-hash>/` (auto-created, isolated per project via md5 hash of `process.cwd()`)

**Custom path:** Set `memory.memoryDir` to any directory.

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  memory: {
    memoryDir: './my-memory',     // optional — defaults to ~/.agent-core/memory/<hash>/
    autoLoad: true,               // inject memories into system prompt
    extractStrategy: 'auto',      // extract after every turn
  },
})
```

**Extract strategies:**
- `'disabled'` (default) -- no automatic extraction
- `'auto'` -- extract after every completed turn (fire-and-forget)
- `{ interval: N }` -- extract every N completed turns

**Memory types:**
- `user` -- user's role, preferences, knowledge
- `feedback` -- guidance on approach (what to avoid or repeat)
- `project` -- project state, goals, events (not derivable from code)
- `reference` -- pointers to external systems

**Storage format:** Each memory is a `.md` file with frontmatter (`name`, `description`, `type`) plus content. An auto-maintained `MEMORY.md` index links all memories.

**Standalone API:**

```typescript
import { saveMemory, loadMemory, scanMemories, loadMemoryIndex, getMemoryDir } from 'codenano'

// Save a memory (creates .md file + updates MEMORY.md index)
saveMemory({
  name: 'user_role',
  description: 'User is a backend engineer',
  type: 'user',
  content: 'Expert in Go and Python, new to React',
}, '/path/to/memory')

// Load a single memory from file
const memory = loadMemory('/path/to/memory/user_role.md')
// => { name, description, type, content }

// Scan all memories in a directory
const memories = scanMemories('/path/to/memory')
// => Memory[]

// Load the MEMORY.md index
const index = loadMemoryIndex('/path/to/memory')
// => string | null

// Get default memory directory (based on cwd hash)
const dir = getMemoryDir()
// => ~/.agent-core/memory/<hash>/
```

## Session Persistence

Save and resume multi-turn sessions using JSONL files. Inspired by Claude Code's session storage design.

**Default path:** `~/.agent-core/sessions/` (auto-created, shared across all projects)

**Custom path:** Set `persistence.storageDir` to any directory.

```typescript
const agent = createAgent({
  model: 'claude-sonnet-4-6',
  tools: coreTools(),
  persistence: {
    enabled: true,                    // enable JSONL persistence
    storageDir: './my-sessions',      // optional — defaults to ~/.agent-core/sessions/
  },
})

// Start a new session — messages auto-save after each turn
const session = agent.session()
console.log(session.id)  // UUID — save this to resume later
await session.send('Analyze the codebase')

// Resume an existing session by ID
const resumed = agent.session(session.id)
// resumed.history contains all previous messages
await resumed.send('What did we find?')
```

**Storage format:** Each session is a `<sessionId>.jsonl` file. The first line is metadata, subsequent lines are messages. Append-only writes, line-by-line reads for restore.

**Standalone API:**

```typescript
import { listSessions, loadSession, getSessionStorageDir } from 'codenano'

// List all saved sessions
const sessions = listSessions({ storageDir: './my-sessions' })

// Load a specific session
const loaded = loadSession('session-uuid', { storageDir: './my-sessions' })
console.log(loaded.metadata)   // { sessionId, model, createdAt }
console.log(loaded.messages)   // MessageParam[]

// Get the storage directory path
const dir = getSessionStorageDir()  // ~/.agent-core/sessions/
```

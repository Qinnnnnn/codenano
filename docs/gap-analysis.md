# Gap Analysis: codenano Architecture

This SDK implements production-grade agent patterns inspired by AI coding systems. ~8,000 lines of focused code implementing the core agent loop, tool execution, and production hardening features.

## What's Equivalent

| System | Detail |
|--------|--------|
| **Agent loop** | `while(true) -> call model -> extract tool_use -> execute -> repeat` |
| **Streaming** | `callModelStreaming()` yields same event types, `stream()` is the primitive |
| **System prompt** | All 11 sections faithfully reproduced with static/dynamic boundary and caching |
| **Prompt priority** | `override > agent > custom > default > append` |
| **Session** | Multi-turn with persistent history via `session.send()` / `session.stream()` |
| **Session persistence** | JSONL-based save/resume via `persistence` config, `session.id` + `agent.session(id)` |
| **Tool builder** | `defineTool()` with Zod schemas, validation, `isReadOnly`/`isConcurrencySafe` |
| **Provider** | Anthropic direct + Bedrock auto-detection, `baseURL` proxy support |
| **Tool concurrency** | `partitionToolCalls()` groups consecutive safe tools, runs in parallel (max 10) |
| **Auto-compact** | Token threshold check -> LLM summarization -> continuation message |
| **413 recovery** | Detect prompt-too-long -> compact -> retry once |
| **Max output recovery** | `stop_reason: 'max_tokens'` -> inject resume -> retry (up to 3x) |
| **Model fallback** | 3x consecutive 529 -> switch to `fallbackModel` |
| **Retry/backoff** | Exponential backoff + jitter (500ms base, 32s cap, 3 retries) |
| **Tool result budget** | Per-tool 50KB cap, per-message 200KB aggregate, 2KB preview |
| **CLAUDE.md loading** | Discovers user/project/local/rules files from directory hierarchy |
| **Streaming tool executor** | Tools start executing as content blocks complete during stream |
| **Max output escalation** | 8K cap -> 64K escalation before recovery inject (opt-in) |
| **Memory system** | `saveMemory()`, `scanMemories()`, MEMORY.md index, auto-extraction with forked agent |
| **Cost tracking** | `costUSD` in every Result, `CostTracker` class, per-model pricing |
| **Git integration** | `getGitState()`, `findGitRoot()`, `buildGitPromptSection()` with caching |
| **Hook system** | 8 lifecycle hooks: onTurnStart, onPreToolUse (blocking), onPostToolUse, onCompact, onError, onMaxTurns, onSessionStart, onTurnEnd |
| **Sub-agent spawning** | `createAgentTool(parentConfig)` spawns child agents with inherited tools |
| **MCP protocol** | `connectMCPServer()` with stdio/SSE/HTTP transports, `mcpToolsToToolDefs()` auto-wrapping |
| **Skill system** | `loadSkills()` from `.claude/skills/` directories, `createSkillTool()`, inline + fork execution |
| **Context analysis** | `analyzeContext()`, `classifyTool()`, `isCollapsible()` — duplicate read detection |

## What's Simplified (by design)

| Claude Code | codenano | Rationale |
|-------------|-----|-----------|
| 6 permission modes + rule layers + ML classifier | Single `canUseTool` callback + `onPreToolUse` blocking | SDK users implement their own policy |
| 26 hook event types + shell/http/agent executors | 8 callback hooks (TypeScript functions only) | SDK doesn't need shell/http hook executors |
| Zustand app state + React Context | Stateless — config in, result out | SDK doesn't own the UI |
| 101 slash commands | Skills loaded from disk via `loadSkills()` | SDK, not CLI |
| Terminal UI (146 Ink components) | Headless — `StreamEvent` only | Users build their own UI |
| Analytics (Datadog, Growthbook) | None | Users bring their own observability |
| 6-layer compaction + context collapse | 2-layer: auto-compact + 413 reactive + context analysis | Covers 90% of use cases |
| 2-tier budgeting (per-tool disk persist + per-message aggregate) | Single-tier inline truncation | No disk persistence needed |
| CLAUDE.md 1480-line pipeline (@include, conditional, frontmatter) | ~200 lines, core discovery only | SDK needs discovery, not enterprise features |
| Full MCP: OAuth, resources, prompts, elicitation | Tool listing + calling only | SDK users add auth if needed |
| Fork subagent with prompt-cache sharing, worktree isolation | Basic child agent via `createAgent()` | No worktree/cache complexity |
| Skill marketplace + plugin system + conditional activation | Disk-based skill loading + inline/fork execution | SDK needs loading, not marketplace |

## Remaining Gaps

| Gap | Claude Code | codenano | Impact |
|-----|-------------|---------|--------|
| **Auto-dream consolidation** | Periodic memory summarization + pattern extraction | No consolidation — only save/load/extract | Long-running agents may accumulate redundant memories |
| **MCP OAuth** | Full OAuth flow with token refresh | No auth — users pass static headers | Requires manual token management for OAuth servers |
| **MCP resources/prompts** | `listResources()`, `readResource()`, `listPrompts()`, `getPrompt()` | Tool listing + calling only | No access to MCP resource/prompt APIs |
| **Fork with prompt-cache sharing** | Byte-identical system prompt prefix for cache reuse | Fresh `createAgent()` per sub-agent | Higher cost for parallel sub-agents |
| **Worktree isolation** | Git worktree per sub-agent | No isolation | Sub-agents share filesystem |
| **Permission rule engine** | Source-layered rules, always-allow/deny lists, bash classifier | Callback + hook only | SDK users must build their own rule engine |
| **Abort mid-stream** | Synthetic tool_results for orphaned tool_use blocks | Loop break, partial result | Orphaned tool_use blocks on abort |
| **Conditional skills** | `paths` field activates skills when matching files are touched | All loaded skills always available | No file-pattern-based activation |
| **Skill hooks** | Skills can define PreToolUse/PostToolUse hooks in frontmatter | No per-skill hooks | Skills can't customize tool behavior |

## Systems Intentionally Excluded

| System | Why |
|--------|-----|
| Terminal UI (Ink, 146 components) | SDK is headless |
| Voice mode (STT/TTS) | Application-layer concern |
| Desktop bridge (REPL-desktop IPC) | IDE integration, not SDK |
| Remote sessions (WebSocket) | Application-layer concern |
| Analytics (Datadog, Growthbook) | Users bring their own observability |
| Slash commands (101 built-in) | CLI concern — skills cover the extensibility need |

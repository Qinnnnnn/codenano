# System Prompt Architecture

The prompt system is faithfully reproduced from Claude Code's internal architecture. It composes a system prompt from independent, cacheable sections.

## Section Layout

```
+-------------------------------------+
| Static Sections (cached once)       |
|  +-- Intro (identity)               |
|  +-- System (tool model, hooks)     |
|  +-- Tasks (coding best practices)  |
|  +-- Actions (risk/reversibility)   |
|  +-- Tools (dynamic per tool set)   |
|  +-- Tone (communication style)     |
|  +-- Efficiency (conciseness)       |
+--- DYNAMIC BOUNDARY ----------------+
| Dynamic Sections (per-turn)         |
|  +-- Environment (cwd, platform)    |
|  +-- Language (if set)              |
|  +-- Output Style (if set)          |
|  +-- Memory (if autoLoad enabled)   |
|  +-- Custom Sections (developer)    |
+--- INSTRUCTIONS (opt-in) -----------+
|  +-- CLAUDE.md project instructions |
+--- CONTEXT (auto-injected) ---------+
|  +-- Memory (loaded memories)       |
|  +-- Git state (if detected)        |
|  +-- Skills (if loaded, via tools)  |
+-------------------------------------+
```

## Static Sections

Built once and cached for the lifetime of the agent:

| Section | Content |
|---------|---------|
| **intro** | Agent identity, output style preferences |
| **system** | Tool execution model, permissions, hooks |
| **tasks** | Coding best practices, security, simplicity |
| **actions** | Risk assessment, reversibility guidance |
| **tools** | Dynamic tool usage hints (generated per tool set) |
| **tone** | Emoji rules, file references, markdown style |
| **efficiency** | Output conciseness guidance |

## Dynamic Sections

Rebuilt each turn to reflect current state:

| Section | Content |
|---------|---------|
| **environment** | cwd, platform, model, git status |
| **language** | Response language preference (if set) |
| **outputStyle** | Custom output style configuration (if set) |
| **memory** | Loaded memories from memory system (if `autoLoad` enabled) |
| **custom** | Developer-provided custom sections |

## Context Injections

Additional context injected into the system prompt based on configuration:

| Source | When | How |
|--------|------|-----|
| **CLAUDE.md** | `autoLoadInstructions: true` | Appended after all sections |
| **Memory** | `memory.autoLoad: true` (default) | `getMemorySection()` injects loaded memories with type descriptions |
| **Git** | `getGitState()` detects a repo | `buildGitPromptSection()` adds branch, commit, clean status |
| **Skills** | Skills loaded via `createSkillTool()` | Available tools listed in SkillTool description |
| **MCP** | MCP servers connected | MCP tools appear as `mcp__<server>__<tool>` in tool list |

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
    | (if memory.autoLoad)
memory section        ->  loaded memories appended
```

## Source Files

```
src/prompt/
  +-- index.ts          # barrel export
  +-- types.ts          # SystemPrompt branded type, PromptSection, EnvironmentInfo
  +-- builder.ts        # buildSystemPrompt(), buildEffectiveSystemPrompt()
  +-- sections.ts       # caching: systemPromptSection(), uncachedSection(), clearSections()
  +-- utils.ts          # prependBullets(), joinSections()
  +-- sections/         # individual section generators
      +-- intro.ts      #   identity + output style
      +-- system.ts     #   tool execution model, permissions, hooks
      +-- tasks.ts      #   coding best practices, security, simplicity
      +-- actions.ts    #   risk assessment, reversibility guidance
      +-- tools.ts      #   dynamic tool usage hints
      +-- tone.ts       #   emoji rules, file references, markdown style
      +-- efficiency.ts #   output conciseness guidance
      +-- environment.ts#   runtime info (cwd, platform, model)
      +-- language.ts   #   response language preference
      +-- outputStyle.ts#   custom output style configuration
      +-- memory.ts     #   loaded memories (via getMemorySection)
      +-- custom.ts     #   developer custom sections

src/memory/
  +-- prompt.ts         # buildMemoryPrompt() — formats memories for injection

src/git.ts              # buildGitPromptSection() — git state for injection
src/skills.ts           # skill content expansion for SkillTool
```

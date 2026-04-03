/**
 * context-analysis.ts — Context analysis and tool classification for collapse
 *
 * Inspired by Claude Code's contextAnalysis.ts and classifyForCollapse.ts.
 * Provides analysis of conversation context to identify compression opportunities.
 */

// ─── Tool Classification ───────────────────────────────────────────────────

export type ToolCategory = 'search' | 'read' | 'write' | 'execute' | 'other'

const SEARCH_TOOLS = new Set(['Grep', 'WebSearch', 'WebFetch', 'Glob'])
const READ_TOOLS = new Set(['Read', 'FileRead', 'TaskGet', 'TaskList', 'LSP', 'Brief'])
const WRITE_TOOLS = new Set(['Write', 'FileWrite', 'Edit', 'FileEdit', 'NotebookEdit', 'TaskCreate', 'TaskUpdate', 'TodoWrite'])
const EXECUTE_TOOLS = new Set(['Bash', 'Agent'])

export function classifyTool(toolName: string): ToolCategory {
  if (SEARCH_TOOLS.has(toolName)) return 'search'
  if (READ_TOOLS.has(toolName)) return 'read'
  if (WRITE_TOOLS.has(toolName)) return 'write'
  if (EXECUTE_TOOLS.has(toolName)) return 'execute'
  return 'other'
}

/** Check if a tool's results can be safely collapsed (search/read are safe) */
export function isCollapsible(toolName: string): boolean {
  const cat = classifyTool(toolName)
  return cat === 'search' || cat === 'read'
}

// ─── Context Analysis ──────────────────────────────────────────────────────

export interface ContextAnalysis {
  totalMessages: number
  userMessages: number
  assistantMessages: number
  toolCalls: number
  toolCallsByName: Record<string, number>
  duplicateFileReads: Record<string, number>
  collapsibleResults: number
  estimatedTokens: number
}

/**
 * Analyze conversation context to identify compression opportunities.
 * Returns stats about tool usage, duplicate reads, and collapsible content.
 */
export function analyzeContext(messages: readonly any[]): ContextAnalysis {
  const analysis: ContextAnalysis = {
    totalMessages: messages.length,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: 0,
    toolCallsByName: {},
    duplicateFileReads: {},
    collapsibleResults: 0,
    estimatedTokens: 0,
  }

  const fileReadPaths = new Map<string, number>()

  for (const msg of messages) {
    if (msg.role === 'user') analysis.userMessages++
    if (msg.role === 'assistant') analysis.assistantMessages++

    const content = Array.isArray(msg.content) ? msg.content : []
    for (const block of content) {
      if (block.type === 'tool_use') {
        analysis.toolCalls++
        analysis.toolCallsByName[block.name] = (analysis.toolCallsByName[block.name] ?? 0) + 1

        // Track file reads for duplicate detection
        if (block.name === 'Read' || block.name === 'FileRead') {
          const path = block.input?.file_path ?? block.input?.path
          if (path) {
            fileReadPaths.set(path, (fileReadPaths.get(path) ?? 0) + 1)
          }
        }

        if (isCollapsible(block.name)) {
          analysis.collapsibleResults++
        }
      }

      // Rough token estimate
      if (block.type === 'text' && block.text) {
        analysis.estimatedTokens += Math.ceil(block.text.length / 4)
      }
      if (block.type === 'tool_result' && typeof block.content === 'string') {
        analysis.estimatedTokens += Math.ceil(block.content.length / 4)
      }
    }

    // Handle string content
    if (typeof msg.content === 'string') {
      analysis.estimatedTokens += Math.ceil(msg.content.length / 4)
    }
  }

  // Record duplicates (files read more than once)
  for (const [path, count] of fileReadPaths) {
    if (count > 1) {
      analysis.duplicateFileReads[path] = count
    }
  }

  return analysis
}

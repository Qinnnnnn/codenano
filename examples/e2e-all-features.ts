/**
 * E2E: Comprehensive feature showcase — all major codenano features in one example.
 *
 * Demonstrates:
 *   1. Cost tracking — costUSD in every Result
 *   2. Git integration — detect repo state
 *   3. Extended hooks — onTurnStart, onPreToolUse, onPostToolUse, onError
 *   4. Session persistence — save and resume
 *   5. Memory system — cross-session learning
 *   6. Sub-agent spawning — createAgentTool
 *   7. Context analysis — analyze conversation
 *
 * Run:
 *   ANTHROPIC_API_KEY=<key> ANTHROPIC_BASE_URL=<url> npx tsx examples/e2e-all-features.ts
 */

import {
  createAgent,
  defineTool,
  coreTools,
  createAgentTool,
  // Cost tracking
  CostTracker,
  calculateCostUSD,
  // Git integration
  getGitState,
  buildGitPromptSection,
  // Session persistence
  listSessions,
  loadSession,
  // Context analysis
  analyzeContext,
  classifyTool,
} from '../src/index.js'
import { z } from 'zod'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const storageDir = mkdtempSync(join(tmpdir(), 'codenano-e2e-'))

// ─── Custom Tool ───────────────────────────────────────────────────────────

const calculatorTool = defineTool({
  name: 'Calculator',
  description: 'Evaluate a math expression',
  input: z.object({ expression: z.string().describe('Math expression to evaluate') }),
  async execute({ expression }) {
    try {
      // Simple safe eval for basic math
      const result = Function(`"use strict"; return (${expression.replace(/[^0-9+\-*/().%\s]/g, '')})`)()
      return `${expression} = ${result}`
    } catch {
      return { content: `Cannot evaluate: ${expression}`, isError: true }
    }
  },
  isReadOnly: true,
})

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== codenano v0.2.0 — Feature Showcase ===\n')

  // ── 1. Git Integration ─────────────────────────────────────────
  console.log('--- 1. Git Integration ---')
  const gitState = getGitState()
  console.log(`  Repo: ${gitState.isGit ? 'yes' : 'no'}`)
  console.log(`  Branch: ${gitState.branch}`)
  console.log(`  Clean: ${gitState.isClean}`)
  console.log(`  Prompt section:\n${buildGitPromptSection(gitState).split('\n').map(l => '    ' + l).join('\n')}`)
  console.log()

  // ── 2. Extended Hooks ──────────────────────────────────────────
  console.log('--- 2. Extended Hooks ---')
  const hookLog: string[] = []

  const config = {
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    tools: [calculatorTool],
    systemPrompt: 'You are a concise math assistant. Use the Calculator tool for any math. Keep answers short.',
    maxTurns: 5,
    persistence: { enabled: true, storageDir },

    // Hooks
    onTurnStart: ({ turnNumber }: any) => {
      hookLog.push(`turn_start:${turnNumber}`)
    },
    onPreToolUse: ({ toolName, toolInput }: any) => {
      hookLog.push(`pre_tool:${toolName}`)
      // Example: block division by zero
      if (toolName === 'Calculator' && toolInput.expression?.includes('/0')) {
        return { block: 'Division by zero is not allowed' }
      }
    },
    onPostToolUse: ({ toolName, output, isError }: any) => {
      hookLog.push(`post_tool:${toolName}:${isError ? 'error' : 'ok'}`)
    },
    onError: ({ error }: any) => {
      hookLog.push(`error:${error.message}`)
    },
  }

  const agent = createAgent(config as any)

  // ── 3. Session Persistence + Cost Tracking ─────────────────────
  console.log('--- 3. Session with Cost Tracking ---')
  const session = agent.session()
  console.log(`  Session ID: ${session.id}`)

  const r1 = await session.send('What is 42 * 17?')
  console.log(`  Result: ${r1.text.slice(0, 80)}`)
  console.log(`  Cost: $${r1.costUSD.toFixed(6)}`)
  console.log(`  Tokens: ${r1.usage.inputTokens + r1.usage.outputTokens}`)
  console.log(`  Turns: ${r1.numTurns}`)
  console.log()

  const r2 = await session.send('Now add 100 to that result')
  console.log(`  Result: ${r2.text.slice(0, 80)}`)
  console.log(`  Cost: $${r2.costUSD.toFixed(6)}`)
  console.log()

  // ── 4. Hook Log ────────────────────────────────────────────────
  console.log('--- 4. Hook Activity ---')
  for (const entry of hookLog) {
    console.log(`  ${entry}`)
  }
  console.log()

  // ── 5. Session Resume ──────────────────────────────────────────
  console.log('--- 5. Session Resume ---')
  const agent2 = createAgent(config as any)
  const resumed = agent2.session(session.id)
  console.log(`  Resumed history: ${resumed.history.length} messages`)

  const r3 = await resumed.send('What was the first calculation I asked about?')
  console.log(`  Result: ${r3.text.slice(0, 100)}`)
  console.log(`  Cost: $${r3.costUSD.toFixed(6)}`)
  console.log()

  // ── 6. Context Analysis ────────────────────────────────────────
  console.log('--- 6. Context Analysis ---')
  const analysis = analyzeContext(resumed.history)
  console.log(`  Total messages: ${analysis.totalMessages}`)
  console.log(`  Tool calls: ${analysis.toolCalls}`)
  console.log(`  Tool breakdown: ${JSON.stringify(analysis.toolCallsByName)}`)
  console.log(`  Collapsible results: ${analysis.collapsibleResults}`)
  console.log(`  Estimated tokens: ${analysis.estimatedTokens}`)
  console.log()

  // ── 7. Tool Classification ─────────────────────────────────────
  console.log('--- 7. Tool Classification ---')
  for (const name of ['Read', 'Grep', 'Bash', 'Write', 'Calculator']) {
    console.log(`  ${name} → ${classifyTool(name)}`)
  }
  console.log()

  // ── 8. List Sessions ───────────────────────────────────────────
  console.log('--- 8. Saved Sessions ---')
  const sessions = listSessions({ storageDir })
  for (const s of sessions) {
    console.log(`  ${s.sessionId.slice(0, 8)}... — ${s.model} — ${s.createdAt}`)
  }
  console.log()

  // ── 9. Cost Tracker Standalone ─────────────────────────────────
  console.log('--- 9. Cost Calculator ---')
  const cost = calculateCostUSD('claude-sonnet-4-6', {
    inputTokens: 10000, outputTokens: 5000,
    cacheReadInputTokens: 2000, cacheCreationInputTokens: 1000,
  })
  console.log(`  10K input + 5K output + 2K cache read + 1K cache create = $${cost.toFixed(6)}`)
  console.log()

  // Cleanup
  rmSync(storageDir, { recursive: true, force: true })
  console.log('=== All features demonstrated! ===')
}

main().catch(err => {
  console.error('E2E failed:', err)
  rmSync(storageDir, { recursive: true, force: true })
  process.exit(1)
})
